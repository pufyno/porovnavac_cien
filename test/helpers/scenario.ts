import { expect } from 'vitest';
import type { FeedItem } from '../../src/ingest/heureka-parser.ts';
import { importFeed } from '../../src/ingest/import-feed.ts';
import { recomputeStats } from '../../src/stats/recompute.ts';
import type { Sql } from './db.ts';
import { asItems } from './seed.ts';

/** Jeden deň nočného jobu: import zadaných feedov a prepočet štatistík. */
export async function runDay(sql: Sql, today: string, feeds: [{ feedId: number }, FeedItem[]][]): Promise<void> {
  for (const [feed, items] of feeds) {
    const result = await importFeed(sql, { feedId: feed.feedId, today, items: asItems(items) });
    expect(result.status).toBe('ok');
  }
  await recomputeStats(sql, today);
}
