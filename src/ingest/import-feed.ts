import type postgres from 'postgres';
import type { FeedItem } from './heureka-parser.ts';

export interface ImportResult {
  importId: number;
  status: 'ok' | 'rejected' | 'failed';
  /** Počet platných položiek vo feede (po odstránení duplicít). */
  itemsTotal: number;
  /** Nové ponuky a zmeny cien. */
  itemsChanged: number;
  error?: string;
}

const BATCH_SIZE = 1000;
/** Kontrola prepadu sa robí až od tejto veľkosti predošlého importu. */
const DROP_CHECK_MIN_ITEMS = 20;
/** Import s menej než touto časťou predošlého počtu položiek sa odmietne. */
const DROP_CHECK_MIN_RATIO = 0.5;

type Tx = postgres.TransactionSql;

async function loadStaging(tx: Tx, items: AsyncIterable<FeedItem>): Promise<void> {
  await tx`
    CREATE TEMP TABLE stg_raw (
      seq bigserial, external_id text, name text, url text, price numeric(10,2), ean text,
      delivery_days smallint, brand text, category text, image_url text
    ) ON COMMIT DROP`;

  let batch: Record<string, string | number | null>[] = [];
  const flush = async () => {
    if (batch.length === 0) return;
    await tx`INSERT INTO stg_raw ${tx(batch)}`;
    batch = [];
  };
  for await (const item of items) {
    batch.push({
      external_id: item.externalId,
      name: item.name,
      url: item.url,
      price: item.price,
      ean: item.ean,
      delivery_days: item.deliveryDays,
      brand: item.brand,
      category: item.category,
      image_url: item.imageUrl,
    });
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  // Pri duplicitnom ITEM_ID platí posledný výskyt.
  await tx`
    CREATE TEMP TABLE stg ON COMMIT DROP AS
    SELECT DISTINCT ON (external_id) * FROM stg_raw ORDER BY external_id, seq DESC`;
}

async function rejectionReason(tx: Tx, feedId: number, total: number): Promise<string | null> {
  if (total === 0) return 'Feed je prázdny alebo neobsahuje žiadnu platnú položku.';
  const [previous] = await tx<{ items_total: number }[]>`
    SELECT items_total FROM feed_imports
    WHERE feed_id = ${feedId} AND status = 'ok' ORDER BY id DESC LIMIT 1`;
  if (
    previous &&
    previous.items_total >= DROP_CHECK_MIN_ITEMS &&
    total < previous.items_total * DROP_CHECK_MIN_RATIO
  ) {
    return `Počet položiek klesol z ${previous.items_total} na ${total}; feed vyzerá poškodený.`;
  }
  return null;
}

async function upsertOffers(tx: Tx, shopId: number, today: string): Promise<number> {
  const [{ inserted } = { inserted: 0 }] = await tx<{ inserted: number }[]>`
    WITH up AS (
      INSERT INTO offers (shop_id, external_id, ean, name, url, price, delivery_days, first_seen_on, last_seen_on)
      SELECT ${shopId}, external_id, ean, name, url, price, delivery_days, ${today}::date, ${today}::date FROM stg
      ON CONFLICT (shop_id, external_id) DO UPDATE SET
        ean = EXCLUDED.ean, name = EXCLUDED.name, url = EXCLUDED.url, price = EXCLUDED.price,
        delivery_days = EXCLUDED.delivery_days, is_active = true, last_seen_on = EXCLUDED.last_seen_on
      RETURNING (xmax = 0) AS inserted
    )
    SELECT count(*) FILTER (WHERE inserted)::int AS inserted FROM up`;
  return inserted;
}

/** Zapíše zmeny cien do histórie. Vráti počet ponúk, ktorým sa cena zmenila. */
async function recordPriceChanges(tx: Tx, shopId: number, today: string): Promise<number> {
  // Oprava ceny v ten istý deň: dnešný interval sa prepíše, nevzniká nový.
  const corrected = await tx`
    UPDATE offer_price_history h SET price = o.price
    FROM offers o
    WHERE o.shop_id = ${shopId} AND o.is_active AND h.offer_id = o.id
      AND h.valid_to IS NULL AND h.valid_from = ${today}::date AND h.price <> o.price`;
  const closed = await tx`
    UPDATE offer_price_history h SET valid_to = ${today}::date
    FROM offers o
    WHERE o.shop_id = ${shopId} AND o.is_active AND h.offer_id = o.id
      AND h.valid_to IS NULL AND h.valid_from < ${today}::date AND h.price <> o.price`;
  await tx`
    INSERT INTO offer_price_history (offer_id, valid_from, price)
    SELECT o.id, ${today}::date, o.price FROM offers o
    WHERE o.shop_id = ${shopId} AND o.is_active
      AND NOT EXISTS (SELECT 1 FROM offer_price_history h WHERE h.offer_id = o.id AND h.valid_to IS NULL)`;
  return corrected.count + closed.count;
}

async function deactivateMissingOffers(tx: Tx, shopId: number, today: string): Promise<void> {
  const gone = await tx<{ id: string }[]>`
    UPDATE offers o SET is_active = false
    WHERE o.shop_id = ${shopId} AND o.is_active
      AND NOT EXISTS (SELECT 1 FROM stg s WHERE s.external_id = o.external_id)
    RETURNING o.id`;
  if (gone.length === 0) return;
  const ids = gone.map((r) => r.id);
  // Interval otvorený dnes by po uzavretí nemal žiadnu dĺžku, preto sa maže.
  await tx`DELETE FROM offer_price_history
           WHERE offer_id = ANY(${ids}::bigint[]) AND valid_to IS NULL AND valid_from = ${today}::date`;
  await tx`UPDATE offer_price_history SET valid_to = ${today}::date
           WHERE offer_id = ANY(${ids}::bigint[]) AND valid_to IS NULL`;
}

async function matchProductsByEan(tx: Tx, shopId: number): Promise<void> {
  // Pre EAN, ktoré ešte nepoznáme, vznikne nový produkt pomenovaný podľa prvej ponuky.
  await tx`
    CREATE TEMP TABLE new_products ON COMMIT DROP AS
    SELECT nextval(pg_get_serial_sequence('products', 'id')) AS id, s.*
    FROM (
      SELECT DISTINCT ON (ean) ean, name, brand, category, image_url FROM stg
      WHERE ean IS NOT NULL AND NOT EXISTS (SELECT 1 FROM product_eans pe WHERE pe.ean = stg.ean)
      ORDER BY ean, external_id
    ) s`;
  await tx`
    INSERT INTO products (id, name, brand, category, image_url) OVERRIDING SYSTEM VALUE
    SELECT id, name, brand, category, image_url FROM new_products`;
  await tx`INSERT INTO product_eans (ean, product_id) SELECT ean, id FROM new_products`;
  // Ručne spárované ponuky (match_method = 'manual') sa neprepisujú.
  await tx`
    UPDATE offers o SET product_id = pe.product_id, match_method = 'ean'
    FROM product_eans pe
    WHERE o.shop_id = ${shopId} AND o.ean = pe.ean
      AND (o.product_id IS NULL OR (o.match_method = 'ean' AND o.product_id <> pe.product_id))`;
}

/**
 * Naimportuje jeden feed: aktualizuje ponuky e-shopu, spáruje ich na produkty
 * cez EAN a zapíše zmeny cien do histórie. Celý import je jedna transakcia;
 * pri chybe alebo podozrivom feede sa dáta nezmenia. Dátum `today` musí byť
 * pri po sebe idúcich importoch rovnaký alebo neskorší.
 */
export async function importFeed(
  sql: postgres.Sql,
  opts: { feedId: number; items: AsyncIterable<FeedItem>; today: string },
): Promise<ImportResult> {
  const { feedId, items, today } = opts;
  const [feed] = await sql<{ shop_id: number }[]>`SELECT shop_id FROM shop_feeds WHERE id = ${feedId}`;
  if (!feed) throw new Error(`Feed ${feedId} neexistuje.`);
  const [log] = await sql<{ id: string }[]>`INSERT INTO feed_imports (feed_id) VALUES (${feedId}) RETURNING id`;
  const importId = Number(log!.id);

  const finish = async (result: Omit<ImportResult, 'importId'>): Promise<ImportResult> => {
    await sql`
      UPDATE feed_imports SET finished_at = now(), status = ${result.status},
        items_total = ${result.itemsTotal}, items_changed = ${result.itemsChanged}, error = ${result.error ?? null}
      WHERE id = ${importId}`;
    return { importId, ...result };
  };

  try {
    const outcome = await sql.begin(async (tx) => {
      // Importy bežia po jednom, aby dva feedy nezaložili ten istý produkt naraz.
      await tx`SELECT pg_advisory_xact_lock(hashtext('feed_import'))`;
      await loadStaging(tx, items);
      const [{ total } = { total: 0 }] = await tx<{ total: number }[]>`SELECT count(*)::int AS total FROM stg`;

      const reason = await rejectionReason(tx, feedId, total);
      if (reason) return { status: 'rejected' as const, itemsTotal: total, itemsChanged: 0, error: reason };

      const inserted = await upsertOffers(tx, feed.shop_id, today);
      await deactivateMissingOffers(tx, feed.shop_id, today);
      const priceChanges = await recordPriceChanges(tx, feed.shop_id, today);
      await matchProductsByEan(tx, feed.shop_id);
      return { status: 'ok' as const, itemsTotal: total, itemsChanged: inserted + priceChanges };
    });
    return await finish(outcome);
  } catch (e) {
    return await finish({
      status: 'failed',
      itemsTotal: 0,
      itemsChanged: 0,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
