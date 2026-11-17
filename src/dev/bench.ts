// Meranie na veľkom katalógu: `pnpm bench [počet produktov]`. Overuje dve
// požiadavky zadania: import veľkého feedu bez zahltenia pamäte a odpoveď
// API pod 500 ms. Dáta sú syntetické.
import { appendFile, rm, stat, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';
import { compareProduct } from '../compare/compare.ts';
import { migrate } from '../db/migrate.ts';
import { openFeed } from '../ingest/fetch-feed.ts';
import { parseHeurekaFeed, type FeedItem } from '../ingest/heureka-parser.ts';
import { importFeed } from '../ingest/import-feed.ts';
import { recomputeStats } from '../stats/recompute.ts';
import { demoEan } from './demo-seed.ts';
import { renderHeurekaFeed } from './feed-xml.ts';

const PRODUCTS = Number(process.argv[2] ?? 100_000);
const SHOPS = 3;
const CONFIG = { publicBaseUrl: 'http://localhost', redirectBaseUrl: 'http://localhost' };

const BRANDS = ['Samsung', 'Apple', 'Xiaomi', 'Sony', 'LG', 'Philips', 'Bosch', 'Lenovo', 'Asus', 'Acer', 'HP', 'Dell',
  'Huawei', 'Honor', 'Motorola', 'Nokia', 'Roborock', 'Dyson', 'Tefal', 'Electrolux', 'Whirlpool', 'Garmin', 'JBL',
  'Bose', 'Logitech', 'Canon', 'Nikon', 'Panasonic', 'Sencor', 'Hisense'];
const SERIES = ['Galaxy', 'Redmi', 'Vision', 'Bravia', 'Pulse', 'Nova', 'Aspire', 'Pavilion', 'Inspiron', 'Zenbook',
  'IdeaPad', 'Edge', 'Titan', 'Aero', 'Prime', 'Vivo', 'Core', 'Flex', 'Slim', 'Max', 'Tune', 'Charge', 'Forerunner',
  'Venu', 'Lumix', 'Coolpix', 'Serie', 'Comfort', 'Power', 'Smart'];
const VARIANTS = ['64GB', '128GB', '256GB', '512GB', 'Pro', 'Ultra', 'Lite', 'Plus', 'Mini', 'SE'];
const COLORS = ['čierny', 'biely', 'strieborný', 'modrý', 'zelený', 'sivý'];

const pick = <T>(list: T[], n: number) => list[n % list.length]!;

function productName(i: number): { brand: string; name: string } {
  const brand = pick(BRANDS, i);
  const model = `${String.fromCharCode(65 + ((i * 7) % 26))}${100 + ((i * 13) % 900)}`;
  return {
    brand,
    name: `${brand} ${pick(SERIES, Math.floor(i / 30))} ${model} ${pick(VARIANTS, Math.floor(i / 900))} ${pick(COLORS, Math.floor(i / 7))}`,
  };
}

function item(i: number, shop: number, day: number): FeedItem {
  const { brand, name } = productName(i);
  const base = 50 + ((i * 37) % 1500);
  // Každý deň sa zmení cena približne 5 % ponúk.
  const drift = (i + day) % 20 === 0 ? day * 3 : 0;
  return {
    externalId: `p${i}`,
    name,
    url: `https://shop${shop}.example/p/${i}`,
    price: (base + shop * 4 + drift).toFixed(2),
    ean: demoEan(i),
    deliveryDays: (i + shop) % 4 === 0 ? 3 : 0,
    brand,
    category: 'Elektronika',
    imageUrl: null,
  };
}

async function* items(shop: number, day: number): AsyncGenerator<FeedItem> {
  for (let i = 0; i < PRODUCTS; i++) yield item(i, shop, day);
}

async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await run();
  console.log(`${label.padEnd(58)} ${((performance.now() - start) / 1000).toFixed(1)} s`);
  return result;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

const dir = path.resolve('.dev-db/bench');
await rm(dir, { recursive: true, force: true });
const port = await freePort();
const pg = new EmbeddedPostgres({
  databaseDir: path.join(dir, 'pg'), user: 'postgres', password: 'bench', port, persistent: false,
  onLog: () => {}, onError: () => {},
});
await pg.initialise();
await pg.start();
const sql = postgres(`postgres://postgres:bench@127.0.0.1:${port}/postgres`, { max: 5, onnotice: () => {} });

try {
  await migrate(sql);
  const [network] = await sql<{ id: number }[]>`INSERT INTO affiliate_networks (code, name) VALUES ('b', 'B') RETURNING id`;
  const feedIds: number[] = [];
  for (let shop = 0; shop < SHOPS; shop++) {
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO shops (slug, name, country, currency, website_url)
      VALUES (${`shop${shop}`}, ${`Shop ${shop}`}, 'SK', 'EUR', ${`https://shop${shop}.example`}) RETURNING id`;
    const [feed] = await sql<{ id: number }[]>`
      INSERT INTO shop_feeds (shop_id, network_id, feed_url, deeplink_template)
      VALUES (${row!.id}, ${network!.id}, 'file:///dev/null', 'https://n.example/?u={url}&s={click_id}') RETURNING id`;
    feedIds.push(feed!.id);
  }

  console.log(`\nKatalóg: ${PRODUCTS} produktov × ${SHOPS} obchody\n`);

  // 1. Streamové parsovanie XML súboru.
  const xmlFile = path.join(dir, 'feed.xml');
  // Súbor vzniká po častiach, aby meranie pamäte neskreslilo jeho generovanie.
  await writeFile(xmlFile, '<?xml version="1.0" encoding="utf-8"?>\n<SHOP>\n');
  for (let from = 0; from < PRODUCTS; from += 5000) {
    const chunk: FeedItem[] = [];
    for (let i = from; i < Math.min(from + 5000, PRODUCTS); i++) chunk.push(item(i, 0, 0));
    const xml = renderHeurekaFeed(chunk);
    await appendFile(xmlFile, xml.slice(xml.indexOf('<SHOP>\n') + 7, xml.lastIndexOf('</SHOP>')));
  }
  await appendFile(xmlFile, '</SHOP>\n');
  const sizeMb = (await stat(xmlFile)).size / 1e6;
  globalThis.gc?.();
  const rssBefore = process.memoryUsage().rss;
  let peak = rssBefore;
  const sampler = setInterval(() => (peak = Math.max(peak, process.memoryUsage().rss)), 20);
  await timed(`Import dňa 1, obchod 0 z XML súboru (${sizeMb.toFixed(0)} MB)`, () =>
    importFeed(sql, {
      feedId: feedIds[0]!,
      today: '2026-11-01',
      items: parseHeurekaFeed(openFeed(pathToFileURL(xmlFile).href), { today: '2026-11-01' }),
    }),
  );
  clearInterval(sampler);
  console.log(`  pamäť procesu: ${(rssBefore / 1e6).toFixed(0)} MB pred importom, najviac ${(peak / 1e6).toFixed(0)} MB počas neho`);

  // 2. Ďalšie obchody a ďalšie dni.
  for (let shop = 1; shop < SHOPS; shop++) {
    await timed(`Import dňa 1, obchod ${shop}`, () =>
      importFeed(sql, { feedId: feedIds[shop]!, today: '2026-11-01', items: items(shop, 0) }),
    );
  }
  await timed('Prepočet štatistík, deň 1', () => recomputeStats(sql, '2026-11-01'));
  for (let day = 1; day <= 3; day++) {
    const today = `2026-11-0${day + 1}`;
    await timed(`Deň ${day + 1}: import ${SHOPS} obchodov (5 % cien sa zmenilo)`, async () => {
      for (let shop = 0; shop < SHOPS; shop++) {
        await importFeed(sql, { feedId: feedIds[shop]!, today, items: items(shop, day) });
      }
    });
    await timed(`Deň ${day + 1}: prepočet štatistík`, () => recomputeStats(sql, today));
  }
  await sql`ANALYZE`;

  // 3. Latencia porovnania.
  const queries: [kind: string, query: string][] = [];
  for (let n = 0; n < 60; n++) {
    const i = (n * 7919) % PRODUCTS;
    const { name } = productName(i);
    const words = name.split(' ');
    queries.push(['presný názov', name]);
    queries.push(['značka, séria, model', words.slice(0, 3).join(' ')]);
    queries.push(['s preklepom', words.slice(0, 3).join(' ').toLowerCase().replace(/a/, 'e')]);
    queries.push(['len značka a séria', words.slice(0, 2).join(' ')]);
    queries.push(['EAN', demoEan(i)]);
  }
  queries.push(['neexistujúci produkt', 'kosačka na trávu'], ['neexistujúci produkt', 'xyz neexistuje 9999']);

  const byStatus: Record<string, number> = {};
  const byKind = new Map<string, number[]>();
  for (const [kind, query] of queries) {
    const start = performance.now();
    const result = await compareProduct({ sql, config: CONFIG }, { query, country: 'SK' });
    const elapsed = performance.now() - start;
    byKind.set(kind, [...(byKind.get(kind) ?? []), elapsed]);
    byStatus[result.status] = (byStatus[result.status] ?? 0) + 1;
  }
  const pct = (times: number[], p: number) =>
    times.toSorted((a, b) => a - b)[Math.min(times.length - 1, Math.floor((p / 100) * times.length))]!.toFixed(0);
  console.log(`\nPorovnanie, ${queries.length} dopytov po jednom (ms):`);
  for (const [kind, times] of [...byKind, ['spolu', [...byKind.values()].flat()] as const]) {
    console.log(`  ${kind.padEnd(24)} medián ${pct(times, 50).padStart(4)}   p95 ${pct(times, 95).padStart(4)}   max ${pct(times, 100).padStart(4)}`);
  }
  console.log(`  výsledky: ${JSON.stringify(byStatus)}`);

  const [size] = await sql<{ db: string; history: string }[]>`
    SELECT pg_size_pretty(pg_database_size(current_database())) AS db,
           pg_size_pretty(pg_total_relation_size('offer_price_history')) AS history`;
  console.log(`\nVeľkosť databázy: ${size!.db} (z toho história cien ponúk ${size!.history})`);
} finally {
  await sql.end();
  await pg.stop();
  await rm(dir, { recursive: true, force: true });
}
