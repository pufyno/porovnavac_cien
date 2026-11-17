import type { OpenAPIHono } from '@hono/zod-openapi';
import { html } from 'hono/html';
import { parseCountry } from '../api/compare-route.ts';
import { compareProduct } from '../compare/compare.ts';
import type { CompareResponse, Country } from '../compare/schema.ts';
import type { Verdict } from '../compare/verdict.ts';
import type { Currency } from '../currency.ts';
import type { AppDeps } from '../deps.ts';
import { formatDays, formatPrice, formatShops } from '../format.ts';
import { normalizeEan } from '../ingest/gtin.ts';
import { loadPriceHistory, type HistoryPoint } from '../stats/history.ts';
import { historyChart, historyTitle } from './chart.ts';
import { searchForm } from './components.ts';
import { icon, type IconName } from './icons.ts';
import { page, type Html } from './layout.ts';

type Ok = Extract<CompareResponse, { status: 'ok' }>;
type Offer = Ok['offers'][number];

const VERDICT_LABEL: Record<Verdict, string> = {
  BUY_NOW: 'Dobrá cena',
  FAIR_PRICE: 'Bežná cena',
  WAIT: 'Radšej počkať',
  INSUFFICIENT_DATA: 'Zatiaľ málo údajov',
};

/** Štítok verdiktu na tmavej karte. Význam nesie text, farba a ikona ho len podčiarkujú. */
const VERDICT_BADGE: Record<Verdict, { className: string; icon: IconName }> = {
  BUY_NOW: { className: 'badge-good-dark', icon: 'check' },
  FAIR_PRICE: { className: 'badge-neutral-dark', icon: 'chart-line' },
  WAIT: { className: 'badge-wait-dark', icon: 'clock' },
  INSUFFICIENT_DATA: { className: 'badge-neutral-dark', icon: 'info' },
};

const countrySuffix = (country: Country) => (country === 'SK' ? '' : `?country=${country}`);

function availability(offer: Offer): string {
  if (offer.in_stock) return 'Skladom';
  if (offer.delivery_days === null) return 'Dostupnosť neuvedená';
  return `Dodanie: ${formatDays(offer.delivery_days)}`;
}

/**
 * Karta ponuky. Štítok má len najlepšia ponuka (najlacnejšia skladom): ak je
 * zároveň najlacnejšia vôbec, „Najnižšia cena“, inak „Najlacnejšie skladom“.
 */
function offerCard(offer: Offer, isFirst: boolean, isBest: boolean, currency: Currency): Html {
  const label = isBest ? (isFirst ? 'Najnižšia cena' : 'Najlacnejšie skladom') : null;
  return html`<li class="offer${isBest ? ' offer-best' : ''}">
    <div>
      <p class="offer-shop">${offer.shop_name}</p>
      <p class="stock${offer.in_stock ? ' stock-yes' : ''}">
        ${icon(offer.in_stock ? 'circle-check' : 'truck', 16)}${availability(offer)}
      </p>
    </div>
    <div class="offer-price">
      <p class="num">${formatPrice(offer.price, currency)}</p>
      ${label ? html`<p class="offer-label">${label}</p>` : ''}
    </div>
    ${offer.fake_discount_warning
      ? html`<div class="offer-warn">
          ${icon('alert-triangle', 18)}
          <p><strong>Zdanlivá zľava:</strong> ${offer.warning_detail ?? ''}</p>
        </div>`
      : ''}
    <a class="button offer-cta${isBest ? '' : ' button-outline'}" href="${offer.buy_url}" rel="sponsored nofollow noopener"
      >Do obchodu<span class="visually-hidden"> ${offer.shop_name}</span>${icon('arrow-right', 18)}</a
    >
  </li>`;
}

function productBody(result: Ok, history: HistoryPoint[], alertPath: string): Html {
  const { price_analysis: analysis, currency, offers } = result;
  const price = (value: number | null) => (value === null ? 'nevieme' : formatPrice(value, currency));
  // Ponuky sú zoradené podľa ceny, takže prvá skladom je najlacnejšia skladom.
  const best = offers.find((offer) => offer.in_stock) ?? offers[0];
  const badge = VERDICT_BADGE[analysis.verdict];
  const chart = historyChart(history, currency);

  return html`<div class="product-head">
      <h1>${result.product_name}</h1>
      <p class="product-meta">${formatShops(result.shops_compared)} · EAN ${result.ean}</p>
    </div>

    <div class="product-top">
      <div class="product-summary">
        <section class="verdict dark" aria-labelledby="cena-teraz">
          <div class="verdict-radar" aria-hidden="true"></div>
          <div class="verdict-inner">
            <h2 id="cena-teraz" class="visually-hidden">Cena teraz</h2>
            <span class="badge ${badge.className}">${icon(badge.icon, 16)}${VERDICT_LABEL[analysis.verdict]}</span>
            ${best
              ? html`<p class="verdict-kicker">
                    ${best === offers[0] ? 'Najnižšia cena teraz' : 'Najnižšia cena skladom'}
                  </p>
                  <p class="verdict-price">${formatPrice(best.price, currency)}</p>
                  <p class="verdict-shop">${best.shop_name} · ${availability(best)}</p>`
              : ''}
            <p class="verdict-reason">${analysis.verdict_reason}</p>
            ${best
              ? html`<a class="button button-accent verdict-cta" href="${best.buy_url}" rel="sponsored nofollow noopener"
                    >Do obchodu ${best.shop_name}${icon('arrow-right', 18)}</a
                  >
                  <p class="verdict-fine">Partnerský odkaz. Cenu pre vás nemení.</p>`
              : ''}
          </div>
        </section>
        <dl class="tiles">
          <div><dt>Priemer za 30 dní</dt><dd>${price(analysis.average_30d_price)}</dd></div>
          <div><dt>Priemer za 90 dní</dt><dd>${price(analysis.average_90d_price)}</dd></div>
          <div><dt>Najnižšia za 90 dní</dt><dd>${price(analysis.lowest_90d_price)}</dd></div>
        </dl>
        ${analysis.history_days < 90
          ? html`<p class="tiles-note">
              Cenu sledujeme ${formatDays(analysis.history_days)}, priemery a minimum sú len z tohto obdobia.
            </p>`
          : ''}
      </div>

      <section class="chart-card" aria-labelledby="vyvoj">
        ${chart
          ? html`<h2 id="vyvoj">${historyTitle(history)}</h2>
              <p>Z ponúk skladom; keď nemá skladom nikto, zo všetkých ponúk.</p>
              ${chart}`
          : html`<h2 id="vyvoj">Vývoj najnižšej ceny</h2>
              <p>Graf ukážeme, keď budeme cenu sledovať aspoň dva dni.</p>`}
      </section>
    </div>

    <div class="product-bottom">
      <section class="offers-section" aria-labelledby="ponuky">
        <h2 id="ponuky">Ponuky obchodov</h2>
        <p>Zoradené podľa ceny, od najlacnejšej.</p>
        <ol class="offers">
          ${offers.map((offer, index) => offerCard(offer, index === 0, offer === best, currency))}
        </ol>
        <p class="offers-note">Odkazy do obchodov sú partnerské. Poradie určuje len cena.</p>
      </section>

      <aside class="alert-card" aria-labelledby="strazit">
        <div class="alert-card-head">
          <span class="icon-box">${icon('bell', 22)}</span>
          <h2 id="strazit">Čakáte na lepšiu cenu?</h2>
        </div>
        <p>Zadajte cenu, ktorú chcete zaplatiť. Keď na ňu produkt klesne, pošleme vám e-mail. Bez registrácie.</p>
        <a class="button" href="${alertPath}">Strážiť cenu${icon('arrow-right', 18)}</a>
      </aside>
    </div>`;
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
          body: html`<div class="search-page"><h1>Hľadať produkt</h1>${searchForm(query, country)}${body}</div>`,
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
        <ul class="results">
          ${result.candidates.map(
            (candidate) => html`<li class="result">
              <a href="/produkt/${candidate.ean}${countrySuffix(country)}">
                <span class="result-text">
                  <span class="result-name">${candidate.product_name}</span>
                  <span class="result-price">od ${formatPrice(candidate.lowest_price, candidate.currency)}</span>
                </span>
                ${icon('arrow-right', 20)}
              </a>
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
        body: productBody(result, history, result.price_alert_url.slice(deps.config.publicBaseUrl.length)),
      }),
    );
  });
}
