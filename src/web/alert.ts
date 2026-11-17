import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { html } from 'hono/html';
import { cancelAlert, confirmAlert, createAlert, findAlertProduct } from '../alerts/alerts.ts';
import { parseCountry } from '../api/compare-route.ts';
import type { Country } from '../compare/schema.ts';
import type { AppDeps } from '../deps.ts';
import { formatPrice } from '../format.ts';
import { normalizeSource, type Source } from '../source.ts';
import { page, type Html } from './layout.ts';

type AlertProduct = NonNullable<Awaited<ReturnType<typeof findAlertProduct>>>;

interface FormValues {
  country: Country;
  target: string;
  email: string;
  source: Source;
}

/** „439,90“ aj „439.90“; všetko ostatné je NaN. */
function parsePrice(raw: string): number {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

function alertForm(product: AlertProduct, values: FormValues, error?: string): Html {
  return html`<h1>Strážiť cenu</h1>
    <p>
      <strong>${product.name}</strong><br />
      ${product.currentMin === null
        ? 'Tento produkt teraz nikto z našich partnerov nepredáva.'
        : `Najnižšia cena teraz: ${formatPrice(product.currentMin, product.currency)}`}
    </p>
    ${error ? html`<div class="box warn" role="alert">${error}</div>` : ''}
    <form action="/alert" method="post">
      <input type="hidden" name="ean" value="${product.ean}" />
      <input type="hidden" name="country" value="${values.country}" />
      <input type="hidden" name="source" value="${values.source}" />
      <div style="position:absolute;left:-9999px" aria-hidden="true">
        <label for="website">Toto pole nevypĺňajte</label>
        <input type="text" id="website" name="website" tabindex="-1" autocomplete="off" />
      </div>
      <label for="target">Dajte mi vedieť, keď cena klesne na (${product.currency === 'EUR' ? '€' : 'Kč'})</label>
      <input type="text" inputmode="decimal" id="target" name="target" value="${values.target}" required />
      <label for="email">Váš e-mail</label>
      <input type="email" id="email" name="email" value="${values.email}" autocomplete="email" required />
      <p class="muted">
        Pošleme vám potvrdzovací e-mail a potom jednu správu, keď cena klesne. Žiadna reklama; stráženie
        zrušíte jedným klikom. <a href="/ochrana-sukromia">Ochrana súkromia</a>
      </p>
      <button type="submit">Strážiť cenu</button>
    </form>`;
}

export function registerAlertRoutes(app: OpenAPIHono, deps: AppDeps): void {
  const { siteName } = deps.config;
  const render = (c: Context, title: string, body: Html, status: 200 | 400 | 404 = 200) =>
    c.html(page({ siteName, title, noindex: true, body }), status);

  const productNotFound = (c: Context) =>
    render(
      c,
      'Produkt sme nenašli',
      html`<h1>Produkt sme nenašli</h1>
        <p>Stráženie sa dá nastaviť len pre produkt, ktorý evidujeme.</p>
        <p><a class="button" href="/hladat">Hľadať produkt</a></p>`,
      404,
    );

  const linkExpired = (c: Context) =>
    render(
      c,
      'Odkaz už neplatí',
      html`<h1>Odkaz už neplatí</h1>
        <p>Stráženie už bolo ukončené alebo zrušené, prípadne je odkaz neúplný. Nové stráženie si nastavíte na stránke produktu.</p>
        <p><a class="button" href="/hladat">Hľadať produkt</a></p>`,
      404,
    );

  app.get('/alert', async (c) => {
    const country = parseCountry(c.req.query('country'));
    const product = await findAlertProduct(deps.sql, c.req.query('ean') ?? '', country);
    if (!product) return productNotFound(c);

    const requested = parsePrice(c.req.query('target') ?? '');
    const suggested = product.currentMin === null ? '' : String(Math.max(1, Math.floor(product.currentMin * 0.9)));
    const source = c.req.query('source');
    return render(
      c,
      `Strážiť cenu: ${product.name}`,
      alertForm(product, {
        country,
        target: Number.isFinite(requested) ? String(requested) : suggested,
        email: '',
        source: source === undefined ? 'web' : normalizeSource(source),
      }),
    );
  });

  app.post('/alert', async (c) => {
    const body = await c.req.parseBody();
    const field = (name: string) => (typeof body[name] === 'string' ? (body[name] as string) : '');
    const sent = () =>
      render(
        c,
        'Skontrolujte si e-mail',
        html`<h1>Skontrolujte si e-mail</h1>
          <p>
            Poslali sme vám správu s odkazom na potvrdenie. Stráženie začne platiť až po kliknutí naň. Ak správu
            nevidíte, pozrite sa do priečinka so spamom.
          </p>`,
      );
    // Skryté pole vypĺňajú len roboty; odpovieme ako pri úspechu, ale nič neurobíme.
    if (field('website') !== '') return sent();

    const values: FormValues = {
      country: parseCountry(field('country')),
      target: field('target').trim(),
      email: field('email').trim(),
      source: normalizeSource(field('source')),
    };
    const result = await createAlert(deps, {
      ean: field('ean'),
      country: values.country,
      email: values.email,
      targetPrice: parsePrice(values.target),
      source: values.source,
    });
    if (result.ok) return sent();
    if (result.field === 'product') return productNotFound(c);

    const product = await findAlertProduct(deps.sql, field('ean'), values.country);
    if (!product) return productNotFound(c);
    return render(c, `Strážiť cenu: ${product.name}`, alertForm(product, values, result.message), 400);
  });

  app.get('/alert/potvrdit', async (c) => {
    const confirmed = await confirmAlert(deps.sql, c.req.query('token') ?? '');
    if (!confirmed) return linkExpired(c);
    return render(
      c,
      'Stráženie je aktívne',
      html`<h1>Stráženie je aktívne</h1>
        <p>
          Keď cena produktu <strong>${confirmed.productName}</strong> klesne na
          ${formatPrice(confirmed.targetPrice, confirmed.currency)} alebo nižšie, pošleme vám e-mail.
        </p>`,
    );
  });

  // Odhlásenie potvrdzuje až tlačidlo: e-mailové filtre odkazy v správach
  // otvárajú automaticky a samotné otvorenie nesmie stráženie zrušiť.
  app.get('/alert/odhlasit', (c) =>
    render(
      c,
      'Zrušiť stráženie',
      html`<h1>Zrušiť stráženie ceny?</h1>
        <form action="/alert/odhlasit" method="post">
          <input type="hidden" name="token" value="${c.req.query('token') ?? ''}" />
          <button type="submit">Áno, zrušiť stráženie</button>
        </form>`,
    ),
  );

  app.post('/alert/odhlasit', async (c) => {
    const body = await c.req.parseBody();
    const cancelled = await cancelAlert(deps.sql, typeof body.token === 'string' ? body.token : '');
    if (!cancelled) return linkExpired(c);
    return render(
      c,
      'Stráženie je zrušené',
      html`<h1>Stráženie je zrušené</h1>
        <p>Na tento produkt vám už nič nepošleme. Váš e-mail do 30 dní zmažeme.</p>`,
    );
  });
}
