import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importFeed } from '../../src/ingest/import-feed.ts';
import type { FeedItem } from '../../src/ingest/heureka-parser.ts';
import { recomputeStats } from '../../src/stats/recompute.ts';
import { createTestDb, first, type Sql } from '../helpers/db.ts';
import { asItems, EAN, feedItem, seedShop } from '../helpers/seed.ts';

let sql: Sql;
let drop: () => Promise<void>;
let alfa: { shopId: number; feedId: number };
let beta: { shopId: number; feedId: number };

beforeEach(async () => {
  ({ sql, drop } = await createTestDb());
  alfa = await seedShop(sql, { slug: 'alfa' });
  beta = await seedShop(sql, { slug: 'beta' });
});
afterEach(async () => {
  await drop();
});

/** Naimportuje feed a prepočíta štatistiky, ako to robí nočný job. */
async function day(today: string, feeds: [{ feedId: number }, FeedItem[]][]) {
  for (const [feed, items] of feeds) {
    const result = await importFeed(sql, { feedId: feed.feedId, today, items: asItems(items) });
    expect(result.status).toBe('ok');
  }
  await recomputeStats(sql, today);
}

const s8 = (id: string, price: string, deliveryDays: number | null = 0) =>
  feedItem({ externalId: id, name: 'Roborock S8', price, ean: EAN.roborockS8, deliveryDays });

const stats = async (country = 'SK') =>
  first(
    await sql<
      {
        currency: string;
        current_min: string | null;
        avg_30d: string | null;
        avg_90d: string | null;
        min_90d: string | null;
        history_days: number;
        offers_count: number;
      }[]
    >`SELECT currency, current_min::text, avg_30d::text, avg_90d::text, min_90d::text, history_days, offers_count
      FROM product_price_stats WHERE country = ${country}`,
  );

const productHistory = () => sql<{ valid_from: string; valid_to: string | null; min_price: string }[]>`
  SELECT valid_from::text, valid_to::text, min_price::text FROM product_price_history ORDER BY valid_from`;

describe('recomputeStats', () => {
  it('aktuálna najnižšia cena je najlacnejšia ponuka skladom', async () => {
    await day('2026-11-17', [
      [alfa, [s8('a', '489')]],
      [beta, [s8('b', '459', 14)]],
    ]);

    expect(await stats()).toMatchObject({ current_min: '489.00', offers_count: 2, currency: 'EUR' });
  });

  it('keď nie je nič skladom, použije najlacnejšiu ponuku', async () => {
    await day('2026-11-17', [
      [alfa, [s8('a', '489', 5)]],
      [beta, [s8('b', '459', null)]],
    ]);

    expect((await stats()).current_min).toBe('459.00');
  });

  it('priemery sú vážené počtom dní, počas ktorých cena platila', async () => {
    await day('2026-08-09', [[alfa, [s8('a', '545')]]]);
    await day('2026-11-07', [[alfa, [s8('a', '489')]]]);
    await recomputeStats(sql, '2026-11-17');

    // 90 dní: 79 × 545 + 11 × 489; 30 dní: 19 × 545 + 11 × 489
    expect(await stats()).toMatchObject({
      current_min: '489.00',
      avg_90d: '538.16',
      avg_30d: '524.47',
      min_90d: '489.00',
      history_days: 90,
    });
  });

  it('history_days hovorí, koľko dní ceny naozaj sledujeme', async () => {
    await day('2026-11-12', [[alfa, [s8('a', '489')]]]);
    await recomputeStats(sql, '2026-11-17');

    expect(await stats()).toMatchObject({ history_days: 6, avg_90d: '489.00', avg_30d: '489.00' });
  });

  it('história produktu zaznamená zmenu najnižšej ceny, nie každú zmenu ponuky', async () => {
    await day('2026-11-01', [
      [alfa, [s8('a', '489')]],
      [beta, [s8('b', '519')]],
    ]);
    await day('2026-11-05', [
      [alfa, [s8('a', '489')]],
      [beta, [s8('b', '509')]],
    ]);
    await day('2026-11-10', [
      [alfa, [s8('a', '529')]],
      [beta, [s8('b', '509')]],
    ]);

    expect(await productHistory()).toEqual([
      { valid_from: '2026-11-01', valid_to: '2026-11-10', min_price: '489.00' },
      { valid_from: '2026-11-10', valid_to: null, min_price: '509.00' },
    ]);
  });

  it('Slovensko a Česko majú samostatné štatistiky vo vlastnej mene', async () => {
    const czShop = await seedShop(sql, { slug: 'gama', country: 'CZ' });
    await day('2026-11-17', [
      [alfa, [s8('a', '489')]],
      [czShop, [s8('c', '11990')]],
    ]);

    expect(await stats('SK')).toMatchObject({ current_min: '489.00', currency: 'EUR', offers_count: 1 });
    expect(await stats('CZ')).toMatchObject({ current_min: '11990.00', currency: 'CZK', offers_count: 1 });
  });

  it('produkt bez aktívnych ponúk nemá aktuálnu cenu a jeho história sa uzavrie', async () => {
    await day('2026-11-01', [[alfa, [s8('a', '489'), feedItem({ externalId: 'x' })]]]);
    await day('2026-11-10', [[alfa, [feedItem({ externalId: 'x' })]]]);

    expect(await stats()).toMatchObject({ current_min: null, offers_count: 0, min_90d: '489.00', history_days: 9 });
    expect(await productHistory()).toEqual([{ valid_from: '2026-11-01', valid_to: '2026-11-10', min_price: '489.00' }]);
  });

  it('nespárované ponuky sa do štatistík nedostanú', async () => {
    await day('2026-11-17', [[alfa, [feedItem({ externalId: 'x' })]]]);

    expect(await sql`SELECT 1 FROM product_price_stats`).toHaveLength(0);
  });

  it('opakovaný prepočet v ten istý deň dá rovnaký výsledok', async () => {
    await day('2026-11-01', [[alfa, [s8('a', '489')]]]);
    await day('2026-11-17', [[alfa, [s8('a', '459')]]]);
    const before = { stats: await stats(), history: await productHistory() };

    await recomputeStats(sql, '2026-11-17');

    expect({ stats: await stats(), history: await productHistory() }).toEqual(before);
  });

  it('oprava ceny v ten istý deň prepíše dnešný interval produktu', async () => {
    await day('2026-11-01', [[alfa, [s8('a', '489')]]]);
    await day('2026-11-17', [[alfa, [s8('a', '459')]]]);

    await day('2026-11-17', [[alfa, [s8('a', '449')]]]);

    expect(await productHistory()).toEqual([
      { valid_from: '2026-11-01', valid_to: '2026-11-17', min_price: '489.00' },
      { valid_from: '2026-11-17', valid_to: null, min_price: '449.00' },
    ]);
  });

  it('ponuke doplní najnižšiu cenu za posledných 30 dní', async () => {
    await day('2026-09-01', [[alfa, [s8('a', '400')]]]);
    await day('2026-10-01', [[alfa, [s8('a', '520')]]]);
    await day('2026-11-10', [[alfa, [s8('a', '489')]]]);
    await recomputeStats(sql, '2026-11-17');

    const offer = first(await sql<{ min_price_30d: string }[]>`SELECT min_price_30d::text FROM offers`);
    expect(offer.min_price_30d).toBe('489.00');
  });

  it('označí ponuku s falošnou zľavou a po čase označenie zruší', async () => {
    await day('2026-09-01', [[alfa, [s8('a', '515')]]]);
    await day('2026-11-03', [[alfa, [s8('a', '740')]]]);
    await day('2026-11-10', [[alfa, [s8('a', '519')]]]);
    await recomputeStats(sql, '2026-11-17');

    const flagged = first(await sql`SELECT fake_discount_warning, warning_detail FROM offers`);
    expect(flagged.fake_discount_warning).toBe(true);
    expect(flagged.warning_detail).toContain('stúpla na 740 €');

    await recomputeStats(sql, '2027-01-15');

    expect(first(await sql`SELECT fake_discount_warning, warning_detail FROM offers`)).toEqual({
      fake_discount_warning: false,
      warning_detail: null,
    });
  });

  it('ponuku s poctivou zľavou neoznačí', async () => {
    await day('2026-09-01', [[alfa, [s8('a', '545')]]]);
    await day('2026-11-10', [[alfa, [s8('a', '489')]]]);

    expect(first(await sql`SELECT fake_discount_warning FROM offers`).fake_discount_warning).toBe(false);
  });
});
