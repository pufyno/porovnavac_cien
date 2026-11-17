import { expect } from 'vitest';
import type { FeedItem } from '../../src/ingest/heureka-parser.ts';
import { importFeed } from '../../src/ingest/import-feed.ts';
import { recomputeStats } from '../../src/stats/recompute.ts';
import type { Sql } from './db.ts';
import { asItems, EAN, feedItem, seedShop } from './seed.ts';

/** Jeden deň nočného jobu: import zadaných feedov a prepočet štatistík. */
export async function runDay(sql: Sql, today: string, feeds: [{ feedId: number }, FeedItem[]][]): Promise<void> {
  for (const [feed, items] of feeds) {
    const result = await importFeed(sql, { feedId: feed.feedId, today, items: asItems(items) });
    expect(result.status).toBe('ok');
  }
  await recomputeStats(sql, today);
}

export const TEST_CONFIG = {
  databaseUrl: '',
  port: 0,
  publicBaseUrl: 'https://domena.example',
  redirectBaseUrl: 'https://go.domena.example',
  siteName: 'Porovnávač cien',
};

/**
 * Malý katalóg pre testy rozhraní: Roborock v dvoch slovenských a jednom
 * českom obchode (od 7. 11. zlacnený z 545 € na 489 €) a dva varianty
 * Galaxy S24, ktoré sa dajú rozlíšiť len spresnením.
 */
export async function seedCatalog(sql: Sql): Promise<{ today: string }> {
  const alfa = await seedShop(sql, { slug: 'alfa' });
  const beta = await seedShop(sql, { slug: 'beta' });
  const gama = await seedShop(sql, { slug: 'gama', country: 'CZ' });
  const s8 = (id: string, price: string, deliveryDays: number | null = 0) =>
    feedItem({ externalId: id, name: 'Roborock S8 Pro Ultra White', brand: 'Roborock', price, ean: EAN.roborockS8, deliveryDays });
  const galaxies = [
    feedItem({ externalId: 'g128', name: 'Samsung Galaxy S24 8GB/128GB Onyx Black', price: '699', ean: EAN.galaxyS24 }),
    feedItem({ externalId: 'g256', name: 'Samsung Galaxy S24 8GB/256GB Onyx Black', price: '759', ean: '8806095300450' }),
  ];
  await runDay(sql, '2026-08-09', [
    [alfa, [s8('a-s8', '545'), ...galaxies]],
    [beta, [s8('b-s8', '519', 3)]],
    [gama, [s8('c-s8', '13490')]],
  ]);
  await runDay(sql, '2026-11-07', [
    [alfa, [s8('a-s8', '489'), ...galaxies]],
    [beta, [s8('b-s8', '519', 3)]],
    [gama, [s8('c-s8', '13490')]],
  ]);
  await recomputeStats(sql, '2026-11-17');
  return { today: '2026-11-17' };
}
