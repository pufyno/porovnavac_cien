import type postgres from 'postgres';
import { detectFakeDiscount, type PriceInterval } from './fake-discount.ts';

type Tx = postgres.TransactionSql;

/** Aktuálna najnižšia cena produktu v krajine: prednostne z ponúk skladom. */
async function loadCurrentMinimums(tx: Tx): Promise<void> {
  await tx`
    CREATE TEMP TABLE cur_min ON COMMIT DROP AS
    SELECT o.product_id, s.country,
           COALESCE(min(o.price) FILTER (WHERE o.delivery_days = 0), min(o.price)) AS min_price,
           count(*)::int AS offers_count
    FROM offers o JOIN shops s ON s.id = o.shop_id
    WHERE o.is_active AND s.is_active AND o.product_id IS NOT NULL
    GROUP BY o.product_id, s.country`;
}

/** Históriu najnižšej ceny produktu vedie rovnako ako históriu ponuky: riadok len pri zmene. */
async function updateProductHistory(tx: Tx, today: string): Promise<void> {
  await tx`
    UPDATE product_price_history h SET min_price = c.min_price
    FROM cur_min c
    WHERE h.product_id = c.product_id AND h.country = c.country
      AND h.valid_to IS NULL AND h.valid_from = ${today}::date AND h.min_price <> c.min_price`;
  await tx`
    DELETE FROM product_price_history h
    WHERE h.valid_to IS NULL AND h.valid_from = ${today}::date
      AND NOT EXISTS (SELECT 1 FROM cur_min c WHERE c.product_id = h.product_id AND c.country = h.country)`;
  await tx`
    UPDATE product_price_history h SET valid_to = ${today}::date
    WHERE h.valid_to IS NULL AND h.valid_from < ${today}::date
      AND NOT EXISTS (
        SELECT 1 FROM cur_min c
        WHERE c.product_id = h.product_id AND c.country = h.country AND c.min_price = h.min_price)`;
  await tx`
    INSERT INTO product_price_history (product_id, country, valid_from, min_price)
    SELECT c.product_id, c.country, ${today}::date, c.min_price FROM cur_min c
    WHERE NOT EXISTS (
      SELECT 1 FROM product_price_history h
      WHERE h.product_id = c.product_id AND h.country = c.country AND h.valid_to IS NULL)`;
}

/**
 * Priemery sú vážené počtom dní, počas ktorých cena platila, a počítajú sa
 * len z dní, keď sme produkt naozaj sledovali (`history_days`).
 */
async function rebuildProductStats(tx: Tx, today: string): Promise<void> {
  await tx`DELETE FROM product_price_stats`;
  await tx`
    INSERT INTO product_price_stats
      (product_id, country, currency, current_min, avg_30d, avg_90d, min_90d, history_days, offers_count)
    WITH w AS (
      SELECT product_id, country, min_price,
             GREATEST(valid_from, ${today}::date - 89) AS d_from,
             LEAST(COALESCE(valid_to, ${today}::date + 1), ${today}::date + 1) AS d_to
      FROM product_price_history
      WHERE valid_from <= ${today}::date AND COALESCE(valid_to, ${today}::date + 1) > ${today}::date - 89
    ), agg AS (
      SELECT product_id, country,
             sum(min_price * (d_to - d_from)) / sum(d_to - d_from) AS avg_90d,
             min(min_price) AS min_90d,
             sum(d_to - d_from)::int AS history_days,
             sum(min_price * GREATEST(0, d_to - GREATEST(d_from, ${today}::date - 29)))
               / NULLIF(sum(GREATEST(0, d_to - GREATEST(d_from, ${today}::date - 29))), 0) AS avg_30d
      FROM w GROUP BY product_id, country
    )
    SELECT a.product_id, a.country, CASE a.country WHEN 'SK' THEN 'EUR' ELSE 'CZK' END,
           c.min_price, round(a.avg_30d, 2), round(a.avg_90d, 2), a.min_90d, a.history_days,
           COALESCE(c.offers_count, 0)
    FROM agg a LEFT JOIN cur_min c USING (product_id, country)`;
}

async function updateOfferMinimums(tx: Tx, today: string): Promise<void> {
  await tx`
    UPDATE offers o SET min_price_30d = m.min_price
    FROM (
      SELECT offer_id, min(price) AS min_price FROM offer_price_history
      WHERE valid_from <= ${today}::date AND COALESCE(valid_to, ${today}::date + 1) > ${today}::date - 29
      GROUP BY offer_id
    ) m
    WHERE o.id = m.offer_id AND o.is_active AND o.min_price_30d IS DISTINCT FROM m.min_price`;
}

async function updateFakeDiscountWarnings(tx: Tx, today: string): Promise<void> {
  // Posudzujú sa len ponuky, ktorým sa cena zmenila za posledných 30 dní.
  const rows = await tx<{ id: string; currency: string; from: string; to: string | null; price: number }[]>`
    SELECT o.id, s.currency, h.valid_from::text AS "from", h.valid_to::text AS "to", h.price::float8 AS price
    FROM offers o
    JOIN shops s ON s.id = o.shop_id
    JOIN offer_price_history cur
      ON cur.offer_id = o.id AND cur.valid_to IS NULL AND cur.valid_from >= ${today}::date - 30
    JOIN LATERAL (
      SELECT * FROM offer_price_history WHERE offer_id = o.id ORDER BY valid_from DESC LIMIT 3
    ) h ON true
    WHERE o.is_active
    ORDER BY o.id, h.valid_from`;

  const byOffer = new Map<string, { currency: string; intervals: PriceInterval[] }>();
  for (const row of rows) {
    let entry = byOffer.get(row.id);
    if (!entry) byOffer.set(row.id, (entry = { currency: row.currency, intervals: [] }));
    entry.intervals.push({ from: row.from, to: row.to, price: row.price });
  }

  const ids: string[] = [];
  const details: string[] = [];
  for (const [id, { currency, intervals }] of byOffer) {
    const warning = detectFakeDiscount(intervals, { today, currency });
    if (warning) {
      ids.push(id);
      details.push(warning.detail);
    }
  }

  await tx`
    UPDATE offers SET fake_discount_warning = false, warning_detail = NULL
    WHERE fake_discount_warning AND NOT (id = ANY(${ids}::bigint[]))`;
  if (ids.length > 0) {
    await tx`
      UPDATE offers o SET fake_discount_warning = true, warning_detail = v.detail
      FROM unnest(${ids}::bigint[], ${details}::text[]) AS v(id, detail)
      WHERE o.id = v.id`;
  }
}

/**
 * Prepočíta všetko, čo API číta ako hotové čísla: históriu najnižšej ceny
 * produktov, priemery za 30 a 90 dní a varovania pred falošnou zľavou.
 * Spúšťa sa po importe všetkých feedov za daný deň.
 */
export async function recomputeStats(sql: postgres.Sql, today: string): Promise<void> {
  await sql.begin(async (tx) => {
    await loadCurrentMinimums(tx);
    await updateProductHistory(tx, today);
    await rebuildProductStats(tx, today);
    await updateOfferMinimums(tx, today);
    await updateFakeDiscountWarnings(tx, today);
  });
}
