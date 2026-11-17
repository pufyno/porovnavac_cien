import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importFeed } from '../../src/ingest/import-feed.ts';
import type { FeedItem } from '../../src/ingest/heureka-parser.ts';
import { createTestDb, first, type Sql } from '../helpers/db.ts';
import { asItems, EAN, feedItem, seedShop } from '../helpers/seed.ts';

let sql: Sql;
let drop: () => Promise<void>;
let alfa: { shopId: number; feedId: number };

beforeEach(async () => {
  ({ sql, drop } = await createTestDb());
  alfa = await seedShop(sql, { slug: 'alfa' });
});
afterEach(async () => {
  await drop();
});

const run = (feedId: number, today: string, items: FeedItem[]) =>
  importFeed(sql, { feedId, today, items: asItems(items) });

const history = (externalId: string) => sql<{ valid_from: string; valid_to: string | null; price: string }[]>`
  SELECT h.valid_from::text, h.valid_to::text, h.price::text
  FROM offer_price_history h JOIN offers o ON o.id = h.offer_id
  WHERE o.external_id = ${externalId} ORDER BY h.valid_from`;

const offer = async (externalId: string) => {
  const [row] = await sql<
    { price: string; is_active: boolean; product_id: string | null; match_method: string | null; last_seen_on: string }[]
  >`SELECT price::text, is_active, product_id, match_method, last_seen_on::text FROM offers WHERE external_id = ${externalId}`;
  return row!;
};

const s8 = (price: string) => feedItem({ externalId: 's8', name: 'Roborock S8 White', price, ean: EAN.roborockS8, brand: 'Roborock' });

describe('importFeed', () => {
  it('prvý import vytvorí ponuku, produkt podľa EAN a otvorený cenový interval', async () => {
    const result = await run(alfa.feedId, '2026-11-01', [s8('489')]);

    expect(result).toMatchObject({ status: 'ok', itemsTotal: 1, itemsChanged: 1 });
    expect(await offer('s8')).toMatchObject({ price: '489.00', is_active: true, match_method: 'ean' });
    expect(await history('s8')).toEqual([{ valid_from: '2026-11-01', valid_to: null, price: '489.00' }]);
    const products = await sql`SELECT p.name, p.brand, pe.ean FROM products p JOIN product_eans pe ON pe.product_id = p.id`;
    expect(products).toEqual([{ name: 'Roborock S8 White', brand: 'Roborock', ean: EAN.roborockS8 }]);
  });

  it('rovnaký EAN v dvoch e-shopoch vedie na jeden produkt', async () => {
    const beta = await seedShop(sql, { slug: 'beta' });

    await run(alfa.feedId, '2026-11-01', [s8('489')]);
    await run(beta.feedId, '2026-11-01', [feedItem({ externalId: 'b-77', name: 'Vysávač Roborock S8', price: '519', ean: EAN.roborockS8 })]);

    const counts = first(await sql<{ products: number; offers: number }[]>`
      SELECT (SELECT count(*)::int FROM products) AS products,
             (SELECT count(DISTINCT product_id)::int FROM offers) AS offers`);
    expect(counts).toEqual({ products: 1, offers: 1 });
    expect((await offer('b-77')).product_id).toBe((await offer('s8')).product_id);
  });

  it('ponuku bez EAN uloží nespárovanú', async () => {
    await run(alfa.feedId, '2026-11-01', [feedItem({ externalId: 'x1' })]);

    expect(await offer('x1')).toMatchObject({ product_id: null, match_method: null });
    expect((await sql`SELECT 1 FROM products`).length).toBe(0);
  });

  it('opakovaný import v ten istý deň nič nezmení', async () => {
    await run(alfa.feedId, '2026-11-01', [s8('489')]);

    const second = await run(alfa.feedId, '2026-11-01', [s8('489')]);

    expect(second).toMatchObject({ status: 'ok', itemsChanged: 0 });
    expect(await history('s8')).toHaveLength(1);
  });

  it('nezmenená cena na druhý deň nepridá riadok histórie', async () => {
    await run(alfa.feedId, '2026-11-01', [s8('489')]);

    const second = await run(alfa.feedId, '2026-11-02', [s8('489')]);

    expect(second.itemsChanged).toBe(0);
    expect(await history('s8')).toEqual([{ valid_from: '2026-11-01', valid_to: null, price: '489.00' }]);
    expect((await offer('s8')).last_seen_on).toBe('2026-11-02');
  });

  it('zmena ceny uzavrie starý interval a otvorí nový', async () => {
    await run(alfa.feedId, '2026-11-01', [s8('489')]);

    const second = await run(alfa.feedId, '2026-11-05', [s8('459')]);

    expect(second.itemsChanged).toBe(1);
    expect(await history('s8')).toEqual([
      { valid_from: '2026-11-01', valid_to: '2026-11-05', price: '489.00' },
      { valid_from: '2026-11-05', valid_to: null, price: '459.00' },
    ]);
    expect((await offer('s8')).price).toBe('459.00');
  });

  it('druhá zmena ceny v ten istý deň prepíše dnešný interval', async () => {
    await run(alfa.feedId, '2026-11-01', [s8('489')]);
    await run(alfa.feedId, '2026-11-05', [s8('459')]);

    await run(alfa.feedId, '2026-11-05', [s8('449')]);

    expect(await history('s8')).toEqual([
      { valid_from: '2026-11-01', valid_to: '2026-11-05', price: '489.00' },
      { valid_from: '2026-11-05', valid_to: null, price: '449.00' },
    ]);
  });

  it('ponuku, ktorá z feedu zmizla, deaktivuje a uzavrie jej interval', async () => {
    await run(alfa.feedId, '2026-11-01', [s8('489'), feedItem({ externalId: 'x1' })]);

    await run(alfa.feedId, '2026-11-03', [feedItem({ externalId: 'x1' })]);

    expect((await offer('s8')).is_active).toBe(false);
    expect(await history('s8')).toEqual([{ valid_from: '2026-11-01', valid_to: '2026-11-03', price: '489.00' }]);
  });

  it('ponuka, ktorá sa vrátila, je znova aktívna s novým intervalom', async () => {
    await run(alfa.feedId, '2026-11-01', [s8('489'), feedItem({ externalId: 'x1' })]);
    await run(alfa.feedId, '2026-11-03', [feedItem({ externalId: 'x1' })]);

    await run(alfa.feedId, '2026-11-10', [s8('499'), feedItem({ externalId: 'x1' })]);

    expect((await offer('s8')).is_active).toBe(true);
    expect(await history('s8')).toEqual([
      { valid_from: '2026-11-01', valid_to: '2026-11-03', price: '489.00' },
      { valid_from: '2026-11-10', valid_to: null, price: '499.00' },
    ]);
  });

  it('ponuka pridaná a odstránená v ten istý deň nezanechá prázdny interval', async () => {
    await run(alfa.feedId, '2026-11-01', [feedItem({ externalId: 'x1' })]);
    await run(alfa.feedId, '2026-11-02', [s8('489'), feedItem({ externalId: 'x1' })]);

    await run(alfa.feedId, '2026-11-02', [feedItem({ externalId: 'x1' })]);

    expect(await history('s8')).toEqual([]);
    expect((await offer('s8')).is_active).toBe(false);
  });

  it('import jedného e-shopu nedeaktivuje ponuky iného', async () => {
    const beta = await seedShop(sql, { slug: 'beta' });
    await run(alfa.feedId, '2026-11-01', [s8('489')]);

    await run(beta.feedId, '2026-11-01', [feedItem({ externalId: 'b1' })]);

    expect((await offer('s8')).is_active).toBe(true);
  });

  it('pri duplicitnom ITEM_ID vo feede platí posledný výskyt', async () => {
    const result = await run(alfa.feedId, '2026-11-01', [s8('489'), s8('479')]);

    expect(result.itemsTotal).toBe(1);
    expect((await offer('s8')).price).toBe('479.00');
  });

  it('prázdny feed odmietne a nič nezmení', async () => {
    await run(alfa.feedId, '2026-11-01', [s8('489')]);

    const result = await run(alfa.feedId, '2026-11-02', []);

    expect(result.status).toBe('rejected');
    expect((await offer('s8')).is_active).toBe(true);
    const [log] = await sql`SELECT status, error FROM feed_imports ORDER BY id DESC LIMIT 1`;
    expect(log).toMatchObject({ status: 'rejected' });
    expect(log?.error).toMatch(/prázdny/);
  });

  it('feed s prudkým prepadom počtu položiek odmietne', async () => {
    const many = Array.from({ length: 40 }, (_, i) => feedItem({ externalId: `p${i}` }));
    await run(alfa.feedId, '2026-11-01', many);

    const result = await run(alfa.feedId, '2026-11-02', many.slice(0, 10));

    expect(result.status).toBe('rejected');
    const { active } = first(await sql<{ active: number }[]>`SELECT count(*)::int AS active FROM offers WHERE is_active`);
    expect(active).toBe(40);
  });

  it('mierny pokles počtu položiek prijme', async () => {
    const many = Array.from({ length: 40 }, (_, i) => feedItem({ externalId: `p${i}` }));
    await run(alfa.feedId, '2026-11-01', many);

    const result = await run(alfa.feedId, '2026-11-02', many.slice(0, 30));

    expect(result.status).toBe('ok');
  });

  it('chyba pri čítaní feedu nič nezmení a zapíše sa do záznamu importu', async () => {
    await run(alfa.feedId, '2026-11-01', [s8('489')]);
    async function* broken(): AsyncGenerator<FeedItem> {
      yield s8('1');
      throw new Error('spojenie prerušené');
    }

    const result = await importFeed(sql, { feedId: alfa.feedId, today: '2026-11-02', items: broken() });

    expect(result).toMatchObject({ status: 'failed', error: 'spojenie prerušené' });
    expect((await offer('s8')).price).toBe('489.00');
    const [log] = await sql`SELECT status, error, finished_at FROM feed_imports ORDER BY id DESC LIMIT 1`;
    expect(log).toMatchObject({ status: 'failed', error: 'spojenie prerušené' });
    expect(log?.finished_at).not.toBeNull();
  });

  it('úspešný import zapíše počty do záznamu importu', async () => {
    await run(alfa.feedId, '2026-11-01', [s8('489'), feedItem({ externalId: 'x1' })]);

    const [log] = await sql`SELECT status, items_total, items_changed FROM feed_imports`;
    expect(log).toMatchObject({ status: 'ok', items_total: 2, items_changed: 2 });
  });

  it('keď sa EAN ponuky zmení, prepáruje ju na správny produkt', async () => {
    await run(alfa.feedId, '2026-11-01', [s8('489'), feedItem({ externalId: 'g', ean: EAN.galaxyS24 })]);

    await run(alfa.feedId, '2026-11-02', [s8('489'), feedItem({ externalId: 'g', ean: EAN.roborockS8 })]);

    expect((await offer('g')).product_id).toBe((await offer('s8')).product_id);
  });

  it('zvládne väčší feed po dávkach', async () => {
    const many = Array.from({ length: 2500 }, (_, i) => feedItem({ externalId: `p${i}`, price: String(10 + i) }));

    const result = await run(alfa.feedId, '2026-11-01', many);

    expect(result).toMatchObject({ status: 'ok', itemsTotal: 2500, itemsChanged: 2500 });
    const { n } = first(await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM offer_price_history WHERE valid_to IS NULL`);
    expect(n).toBe(2500);
  });
});
