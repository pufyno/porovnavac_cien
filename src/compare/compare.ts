import type postgres from 'postgres';
import type { AppConfig } from '../config.ts';
import { formatShops } from '../format.ts';
import { normalizeEan } from '../ingest/gtin.ts';
import { normalizeSource } from '../source.ts';
import { pickMatch, type Candidate } from './match.ts';
import type { CompareResponse, Country } from './schema.ts';
import { decideVerdict } from './verdict.ts';

export interface CompareDeps {
  sql: postgres.Sql;
  config: Pick<AppConfig, 'publicBaseUrl' | 'redirectBaseUrl'>;
}

export interface CompareInput {
  query: string;
  country: Country;
  /** Odkiaľ dopyt prišiel (chatgpt, claude, …); prenáša sa do odkazov. */
  source?: string;
}

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;
/** Minimálna trigramová podobnosť, aby sa produkt vôbec stal kandidátom. */
const CANDIDATE_THRESHOLD = 0.3;
const CANDIDATE_LIMIT = 20;
const OFFER_LIMIT = 20;
/** Stráženie ceny sa predvyplní na cenu o toľko nižšiu než aktuálna. */
const ALERT_TARGET_RATIO = 0.9;

type Currency = 'EUR' | 'CZK';

interface ProductRow {
  id: string;
  name: string;
  ean: string;
  currency: Currency;
  current_min: number;
}

interface FoundCandidate extends Candidate {
  row: ProductRow;
}

type Found =
  | { kind: 'match'; product: ProductRow }
  | { kind: 'ambiguous'; exact: boolean; products: ProductRow[] }
  | { kind: 'none' };

/** Produkt je „dostupný“ len vtedy, keď má v danej krajine aspoň jednu aktívnu ponuku. */
async function findByEan(sql: postgres.Sql, ean: string, country: Country): Promise<Found> {
  const [product] = await sql<ProductRow[]>`
    SELECT p.id, p.name, pe.ean, st.currency, st.current_min::float8 AS current_min
    FROM product_eans pe
    JOIN products p ON p.id = pe.product_id
    JOIN product_price_stats st
      ON st.product_id = p.id AND st.country = ${country} AND st.current_min IS NOT NULL
    WHERE pe.ean = ${ean}`;
  return product ? { kind: 'match', product } : { kind: 'none' };
}

async function findByName(sql: postgres.Sql, query: string, country: Country): Promise<Found> {
  const rows = await sql.begin(async (tx) => {
    // Operátor <% používa trigramový index; jeho prah sa nastavuje len takto.
    await tx`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(CANDIDATE_THRESHOLD)}, true)`;
    return tx<(ProductRow & { search_text: string; word_sim: number })[]>`
      WITH q AS (SELECT lower(f_unaccent(${query})) AS text)
      SELECT p.id, p.name, p.search_text, st.currency, st.current_min::float8 AS current_min,
             (SELECT min(ean) FROM product_eans pe WHERE pe.product_id = p.id) AS ean,
             word_similarity(q.text, p.search_text)::float8 AS word_sim
      FROM q, products p
      JOIN product_price_stats st
        ON st.product_id = p.id AND st.country = ${country} AND st.current_min IS NOT NULL
      WHERE q.text <% p.search_text
        AND EXISTS (SELECT 1 FROM product_eans pe WHERE pe.product_id = p.id)
      ORDER BY word_sim DESC, similarity(q.text, p.search_text) DESC, p.id
      LIMIT ${CANDIDATE_LIMIT}`;
  });

  const candidates: FoundCandidate[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    searchText: row.search_text,
    wordSim: row.word_sim,
    row,
  }));
  const result = pickMatch(query, candidates);
  if (result.kind === 'none') return result;
  if (result.kind === 'match') return { kind: 'match', product: (result.candidate as FoundCandidate).row };
  return {
    kind: 'ambiguous',
    exact: result.exact,
    products: result.candidates.map((c) => (c as FoundCandidate).row),
  };
}

function findProduct(sql: postgres.Sql, query: string, country: Country): Promise<Found> {
  const compact = query.replace(/[\s-]/g, '');
  if (/^\d{8,14}$/.test(compact)) {
    const ean = normalizeEan(compact);
    return ean ? findByEan(sql, ean, country) : Promise.resolve({ kind: 'none' });
  }
  return findByName(sql, query, country);
}

function notFound(country: Country): CompareResponse {
  return {
    status: 'not_found',
    country,
    _ai_instruction:
      'Produkt sme v ponuke partnerských obchodov nenašli. Popros používateľa o presný názov modelu ' +
      'alebo EAN kód. Ceny neodhaduj z vlastných znalostí.',
  };
}

function needsClarification(country: Country, exact: boolean, products: ProductRow[]): CompareResponse {
  return {
    status: 'needs_clarification',
    country,
    exact_match: exact,
    candidates: products.map((p) => ({
      product_name: p.name,
      ean: p.ean,
      lowest_price: p.current_min,
      currency: p.currency,
    })),
    _ai_instruction: exact
      ? 'Dopytu zodpovedá viac produktov. Opýtaj sa používateľa, ktorý z nich myslí, a potom zavolaj ' +
        'porovnanie znova s EAN vybraného produktu ako query.'
      : 'Presný produkt sme nenašli, toto sú len podobné produkty. Opýtaj sa používateľa, či myslel ' +
        'niektorý z nich; netvrď, že ide o hľadaný produkt. Po výbere zavolaj porovnanie znova s jeho EAN.',
  };
}

function okInstruction(opts: { insufficient: boolean; flaggedShops: string[]; shops: number }): string {
  const parts = ['Zobraz ponuky v tabuľke (obchod, cena, dostupnosť) a pri každej daj odkaz z buy_url.'];
  parts.push(
    opts.insufficient
      ? 'História cien je zatiaľ krátka: výhodnosť ceny nehodnoť a povedz, že cenu sledujeme len krátko.'
      : 'Uveď verdikt a jeho zdôvodnenie z price_analysis.',
  );
  if (opts.flaggedShops.length > 0) {
    parts.push(
      `Výrazne upozorni na zdanlivú zľavu v obchode ${opts.flaggedShops.join(', ')}; použi text z warning_detail.`,
    );
  }
  parts.push(
    `Porovnávame len ${formatShops(opts.shops)} z našich partnerov; povedz, že inde môže byť cena iná.`,
    'Odkazy do obchodov sú partnerské (affiliate), z nákupu môžeme získať províziu; používateľovi to uveď.',
    'Ak nechce kúpiť hneď, ponúkni mu stráženie ceny cez price_alert_url.',
  );
  return parts.join(' ');
}

async function buildComparison(
  deps: CompareDeps,
  product: ProductRow,
  country: Country,
  source: string,
): Promise<CompareResponse> {
  const { sql, config } = deps;
  const [[stats], offers] = await Promise.all([
    sql<{ avg_30d: number | null; avg_90d: number | null; min_90d: number | null; history_days: number }[]>`
      SELECT avg_30d::float8 AS avg_30d, avg_90d::float8 AS avg_90d, min_90d::float8 AS min_90d, history_days
      FROM product_price_stats WHERE product_id = ${product.id} AND country = ${country}`,
    sql<
      {
        id: string;
        shop_id: number;
        shop_name: string;
        price: number;
        delivery_days: number | null;
        fake_discount_warning: boolean;
        warning_detail: string | null;
      }[]
    >`
      SELECT o.id, o.shop_id, s.name AS shop_name, o.price::float8 AS price, o.delivery_days,
             o.fake_discount_warning, o.warning_detail
      FROM offers o JOIN shops s ON s.id = o.shop_id
      WHERE o.product_id = ${product.id} AND o.is_active AND s.is_active AND s.country = ${country}
      ORDER BY o.price, (o.delivery_days = 0) DESC NULLS LAST, o.id
      LIMIT ${OFFER_LIMIT}`,
  ]);
  if (!stats || offers.length === 0) return notFound(country);

  const { verdict, reason } = decideVerdict({
    currentMin: product.current_min,
    avg30d: stats.avg_30d,
    avg90d: stats.avg_90d,
    min90d: stats.min_90d,
    historyDays: stats.history_days,
    currency: product.currency,
  });
  const shops = new Set(offers.map((o) => o.shop_id)).size;
  const flaggedShops = [...new Set(offers.filter((o) => o.fake_discount_warning).map((o) => o.shop_name))];
  const target = Math.max(1, Math.floor(product.current_min * ALERT_TARGET_RATIO));

  return {
    status: 'ok',
    product_name: product.name,
    ean: product.ean,
    country,
    currency: product.currency,
    price_analysis: {
      current_lowest_price: product.current_min,
      average_30d_price: stats.avg_30d,
      average_90d_price: stats.avg_90d,
      lowest_90d_price: stats.min_90d,
      history_days: stats.history_days,
      verdict,
      verdict_reason: reason,
    },
    offers: offers.map((o) => ({
      shop_name: o.shop_name,
      price: o.price,
      in_stock: o.delivery_days === 0,
      delivery_days: o.delivery_days,
      fake_discount_warning: o.fake_discount_warning,
      ...(o.warning_detail ? { warning_detail: o.warning_detail } : {}),
      buy_url: `${config.redirectBaseUrl}/redirect?offer_id=${o.id}&source=${source}`,
    })),
    shops_compared: shops,
    price_alert_url:
      `${config.publicBaseUrl}/alert?ean=${product.ean}&target=${target}&country=${country}&source=${source}`,
    _ai_instruction: okInstruction({ insufficient: verdict === 'INSUFFICIENT_DATA', flaggedShops, shops }),
  };
}

/**
 * Porovnanie cien jedného produktu pre AI asistenta. Nejasný dopyt nikdy
 * nekončí chybou: vráti kandidátov alebo `not_found` s pokynom, čo má
 * asistent urobiť ďalej.
 */
export async function compareProduct(deps: CompareDeps, input: CompareInput): Promise<CompareResponse> {
  const query = input.query.trim().slice(0, MAX_QUERY_LENGTH);
  const source = input.source === undefined ? 'api' : normalizeSource(input.source);
  if (query.length < MIN_QUERY_LENGTH) return notFound(input.country);

  const found = await findProduct(deps.sql, query, input.country);
  if (found.kind === 'none') return notFound(input.country);
  if (found.kind === 'ambiguous') return needsClarification(input.country, found.exact, found.products);
  return buildComparison(deps, found.product, input.country, source);
}
