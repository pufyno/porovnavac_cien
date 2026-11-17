import { purgeAlerts, triggerAlerts, type AlertDeps } from '../alerts/alerts.ts';
import { recomputeStats } from '../stats/recompute.ts';
import { openFeed } from './fetch-feed.ts';
import { parseHeurekaFeed, type ParseStats } from './heureka-parser.ts';
import { importFeed, type ImportResult } from './import-feed.ts';

export interface FeedReport {
  shop: string;
  status: ImportResult['status'];
  itemsTotal: number;
  itemsChanged: number;
  /** Položky, ktoré parser preskočil ako neplatné, a prečo. */
  itemsSkipped: number;
  skipReasons: Record<string, number>;
  error?: string;
}

export interface IngestReport {
  today: string;
  feeds: FeedReport[];
  alerts: { sent: number; failed: number };
  alertsPurged: number;
}

/**
 * Jeden beh nočného jobu: stiahne a naimportuje všetky aktívne feedy,
 * prepočíta štatistiky a rozošle upozornenia na stráženú cenu. Zlyhanie
 * jedného feedu ostatné nezastaví; jeho ponuky ostanú z predošlého dňa.
 */
export async function runIngest(deps: AlertDeps, today: string): Promise<IngestReport> {
  const { sql } = deps;
  const feeds = await sql<{ id: number; feed_url: string; shop: string }[]>`
    SELECT f.id, f.feed_url, s.slug AS shop
    FROM shop_feeds f JOIN shops s ON s.id = f.shop_id
    WHERE f.is_active AND s.is_active
    ORDER BY s.slug, f.id`;

  const reports: FeedReport[] = [];
  for (const feed of feeds) {
    const stats: ParseStats = { total: 0, skipped: 0, reasons: {} };
    // Feed sa otvára až vnútri importu, aby sa aj chyba sťahovania zapísala do feed_imports.
    const result = await importFeed(sql, {
      feedId: feed.id,
      today,
      items: parseHeurekaFeed(openFeed(feed.feed_url), { today, stats }),
    });
    reports.push({
      shop: feed.shop,
      status: result.status,
      itemsTotal: result.itemsTotal,
      itemsChanged: result.itemsChanged,
      itemsSkipped: stats.skipped,
      skipReasons: stats.reasons,
      ...(result.error ? { error: result.error } : {}),
    });
  }

  await recomputeStats(sql, today);
  const alerts = await triggerAlerts(deps);
  const alertsPurged = await purgeAlerts(sql);
  return { today, feeds: reports, alerts, alertsPurged };
}
