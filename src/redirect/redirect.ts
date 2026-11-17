import type postgres from 'postgres';
import type { Source } from '../source.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Identifikátor ponuky je bigint; dlhšie číslo by v databáze skončilo chybou. */
const OFFER_ID = /^\d{1,18}$/;

/** Do šablóny siete dosadí adresu ponuky a identifikátor prekliku (sub-ID). */
export function buildDeeplink(template: string, offerUrl: string, clickId: string): string {
  return template
    .replaceAll('{url}', encodeURIComponent(offerUrl))
    .replaceAll('{click_id}', encodeURIComponent(clickId));
}

/**
 * Zapíše preklik a vráti adresu, kam návštevníka poslať. Cieľ sa skladá výlučne
 * z údajov v databáze, takže endpoint sa nedá zneužiť ako otvorený redirect.
 * Pre neznámu ponuku vráti `null` a nič nezapíše.
 */
export async function recordClick(
  sql: postgres.Sql,
  input: { offerId: string; source: Source; alertId?: string | undefined },
): Promise<string | null> {
  if (!OFFER_ID.test(input.offerId)) return null;
  const alertId = input.alertId && UUID.test(input.alertId) ? input.alertId : null;

  const [row] = await sql<{ click_id: string; url: string; deeplink_template: string | null }[]>`
    WITH target AS (
      SELECT o.id, o.shop_id, o.product_id, o.price, o.url, f.deeplink_template
      FROM offers o
      LEFT JOIN LATERAL (
        SELECT deeplink_template FROM shop_feeds
        WHERE shop_id = o.shop_id AND is_active
        ORDER BY commission_pct DESC NULLS LAST, id LIMIT 1
      ) f ON true
      WHERE o.id = ${input.offerId}
    ), click AS (
      INSERT INTO click_logs (offer_id, shop_id, product_id, source, price, alert_id)
      SELECT id, shop_id, product_id, ${input.source}, price, ${alertId} FROM target
      RETURNING id
    )
    SELECT click.id AS click_id, target.url, target.deeplink_template FROM target, click`;
  if (!row) return null;
  // E-shop bez aktívneho partnerského odkazu: návštevníka pošleme priamo.
  return row.deeplink_template ? buildDeeplink(row.deeplink_template, row.url, row.click_id) : row.url;
}
