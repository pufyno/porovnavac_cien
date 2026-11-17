import type { OpenAPIHono } from '@hono/zod-openapi';
import { html } from 'hono/html';
import { parseCountry } from '../api/compare-route.ts';
import { compareProduct } from '../compare/compare.ts';
import type { CompareResponse, Country } from '../compare/schema.ts';
import type { Verdict } from '../compare/verdict.ts';
import type { AppDeps } from '../deps.ts';
import { formatDays, formatPrice, formatShops } from '../format.ts';
import { normalizeEan } from '../ingest/gtin.ts';
import { loadPriceHistory } from '../stats/history.ts';
import { historyChart } from './chart.ts';
import { searchForm } from './components.ts';
import { page, type Html } from './layout.ts';

type Ok = Extract<CompareResponse, { status: 'ok' }>;

const VERDICT_LABEL: Record<Verdict, string> = {
  BUY_NOW: 'Dobrá cena',
  FAIR_PRICE: 'Bežná cena',
  WAIT: 'Radšej počkať',
  INSUFFICIENT_DATA: 'Zatiaľ málo údajov',
};

const countrySuffix = (country: Country) => (country === 'SK' ? '' : `?country=${country}`);

function availability(offer: Ok['offers'][number]): string {
  if (offer.in_stock) return 'Skladom';
  if (offer.delivery_days === null) return 'Dostupnosť neuvedená';
  return `Dodanie: ${formatDays(offer.delivery_days)}`;
}

function productBody(result: Ok, chart: Html | null, alertPath: string): Html {
  const { price_analysis: analysis, currency } = result;
  const price = (value: number | null) => (value === null ? 'nevieme' : formatPrice(value, currency));

  return html`<h1>${result.product_name}</h1>
    <p class="muted">EAN ${result.ean} · porovnané ${formatShops(result.shops_compared)}</p>

    <div class="box verdict-${analysis.verdict}">
      <strong>${VERDICT_LABEL[analysis.verdict]}.</strong> ${analysis.verdict_reason}
    </div>

    <table>
      <tr><th>Najnižšia cena teraz</th><td class="price">${price(analysis.current_lowest_price)}</td></tr>
      <tr><th>Priemer za 30 dní</th><td class="price">${price(analysis.average_30d_price)}</td></tr>
      <tr><th>Priemer za 90 dní</th><td class="price">${price(analysis.average_90d_price)}</td></tr>
      <tr><th>Najnižšia za 90 dní</th><td class="price">${price(analysis.lowest_90d_price)}</td></tr>
    </table>
    <p class="muted">Cenu sledujeme ${formatDays(analysis.history_days)}; priemery sú len z tohto obdobia.</p>

    <h2>Ponuky obchodov</h2>
    <table class="offers">
      <thead><tr><th>Obchod</th><th>Dostupnosť</th><th class="price">Cena</th><th></th></tr></thead>
      <tbody>
        ${result.offers.map(
          (offer) => html`<tr>
            <td>
              ${offer.shop_name}
              ${offer.fake_discount_warning
                ? html`<div class="box warn"><strong>Zdanlivá zľava.</strong> ${offer.warning_detail ?? ''}</div>`
                : ''}
            </td>
            <td>${availability(offer)}</td>
            <td class="price">${formatPrice(offer.price, currency)}</td>
            <td><a class="button" href="${offer.buy_url}" rel="sponsored nofollow noopener">Do obchodu</a></td>
          </tr>`,
        )}
      </tbody>
    </table>

    <h2>Čakáte na lepšiu cenu?</h2>
    <p>Zadajte cenu, pri ktorej máte záujem, a keď na ňu produkt klesne, pošleme vám e-mail.</p>
    <p><a class="button" href="${alertPath}">Strážiť cenu</a></p>

    ${chart
      ? html`<h2>Vývoj najnižšej ceny za posledných ${formatDays(analysis.history_days)}</h2>
          ${chart}`
      : ''}`;
}

export function registerSearchRoutes(app: OpenAPIHono, deps: AppDeps): void {
  const site = deps.config;

  app.get('/hladat', async (c) => {
    const query = (c.req.query('q') ?? '').trim();
    const country = parseCountry(c.req.query('country'));
    const render = (title: string, body: Html) =>
      c.html(
        page({
          site,
          title,
          noindex: true,
          layout: 'wide',
          search: false,
          body: html`<h1>Hľadať produkt</h1>${searchForm(query, country)}${body}`,
        }),
      );
    if (query === '') return render('Hľadať produkt', html``);

    const result = await compareProduct(deps, { query, country, source: 'web' });
    if (result.status === 'ok') return c.redirect(`/produkt/${result.ean}${countrySuffix(country)}`, 302);
    if (result.status === 'not_found') {
      return render(
        'Nič sme nenašli',
        html`<p>Produkt „${query}“ sme nenašli. Skúste presný názov modelu alebo EAN kód z obalu.</p>
          <p class="muted">Porovnávame len elektroniku z obchodov, s ktorými spolupracujeme.</p>`,
      );
    }
    return render(
      `Výsledky pre „${query}“`,
      html`<p>
          ${result.exact_match
            ? 'Dopytu zodpovedá viac produktov. Vyberte ten, ktorý hľadáte:'
            : 'Presný produkt sme nenašli. Mysleli ste niektorý z týchto?'}
        </p>
        <ul class="plain">
          ${result.candidates.map(
            (candidate) => html`<li>
              <a href="/produkt/${candidate.ean}${countrySuffix(country)}">${candidate.product_name}</a>
              <span class="muted"> od ${formatPrice(candidate.lowest_price, candidate.currency)}</span>
            </li>`,
          )}
        </ul>`,
    );
  });

  app.get('/produkt/:ean', async (c) => {
    const country = parseCountry(c.req.query('country'));
    const ean = normalizeEan(c.req.param('ean'));
    const result = ean ? await compareProduct(deps, { query: ean, country, source: 'web' }) : null;
    if (!ean || result?.status !== 'ok') {
      return c.html(
        page({
          site,
          title: 'Produkt sme nenašli',
          noindex: true,
          search: false,
          body: html`<h1>Produkt sme nenašli</h1>
            <p>Tento produkt neevidujeme alebo ho v zvolenej krajine práve nikto z našich partnerov nepredáva.</p>
            ${searchForm('', country)}`,
        }),
        404,
      );
    }

    const history = await loadPriceHistory(deps.sql, { ean, country, today: deps.today() });
    const lowest = formatPrice(result.price_analysis.current_lowest_price, result.currency);
    return c.html(
      page({
        site,
        layout: 'wide',
        search: country,
        title: `${result.product_name}: ceny od ${lowest}`,
        description: `${result.product_name} od ${lowest}. ${result.price_analysis.verdict_reason}`,
        body: productBody(
          result,
          historyChart(history, result.currency),
          result.price_alert_url.slice(deps.config.publicBaseUrl.length),
        ),
      }),
    );
  });
}
