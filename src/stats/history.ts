import type postgres from 'postgres';

/** Úsek, počas ktorého platila jedna cena; `to` je prvý deň, keď už neplatila. */
export interface HistoryPoint {
  from: string;
  to: string;
  price: number;
}

/** História najnižšej ceny produktu za posledných 90 dní, orezaná na toto okno. */
export async function loadPriceHistory(
  sql: postgres.Sql,
  opts: { ean: string; country: 'SK' | 'CZ'; today: string },
): Promise<HistoryPoint[]> {
  const { ean, country, today } = opts;
  return sql<HistoryPoint[]>`
    SELECT GREATEST(h.valid_from, ${today}::date - 89)::text AS "from",
           LEAST(COALESCE(h.valid_to, ${today}::date + 1), ${today}::date + 1)::text AS "to",
           h.min_price::float8 AS price
    FROM product_eans pe
    JOIN product_price_history h ON h.product_id = pe.product_id AND h.country = ${country}
    WHERE pe.ean = ${ean}
      AND h.valid_from <= ${today}::date AND COALESCE(h.valid_to, ${today}::date + 1) > ${today}::date - 89
    ORDER BY h.valid_from`;
}
