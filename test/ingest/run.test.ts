import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { confirmAlert, createAlert } from '../../src/alerts/alerts.ts';
import { compareProduct } from '../../src/compare/compare.ts';
import { renderHeurekaFeed } from '../../src/dev/feed-xml.ts';
import { runIngest } from '../../src/ingest/run.ts';
import { createTestDb, first, type Sql } from '../helpers/db.ts';
import { memoryMailer, TEST_CONFIG } from '../helpers/scenario.ts';
import { EAN, feedItem, seedShop } from '../helpers/seed.ts';

const dir = path.resolve(`node_modules/.cache/test-feeds-${process.pid}`);
let sql: Sql;
let drop: () => Promise<void>;
let mailer: ReturnType<typeof memoryMailer>;
let server: Server;
let httpBase: string;
/** Čo má testovací HTTP server vrátiť na danej ceste. */
const httpResponses = new Map<string, { status: number; body: string | Buffer }>();

beforeAll(async () => {
  await mkdir(dir, { recursive: true });
  server = createServer((req, res) => {
    const response = httpResponses.get(req.url ?? '') ?? { status: 404, body: 'nič' };
    res.writeHead(response.status, { 'content-type': 'application/xml' }).end(response.body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  httpBase = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  ({ sql, drop } = await createTestDb());
  mailer = memoryMailer();
  httpResponses.clear();
});
afterEach(async () => {
  await drop();
});

const s8 = (price: string) =>
  feedItem({ externalId: 's8', name: 'Roborock S8 Pro Ultra White', price, ean: EAN.roborockS8 });

/** Založí e-shop, ktorého feed je súbor s danými položkami. */
async function shopWithFileFeed(slug: string, xml: string | Buffer, fileName = `${slug}.xml`) {
  const shop = await seedShop(sql, { slug });
  const file = path.join(dir, fileName);
  await writeFile(file, xml);
  await sql`UPDATE shop_feeds SET feed_url = ${pathToFileURL(file).href} WHERE id = ${shop.feedId}`;
  return shop;
}

async function shopWithHttpFeed(slug: string, response: { status: number; body: string | Buffer }) {
  const shop = await seedShop(sql, { slug });
  httpResponses.set(`/${slug}.xml`, response);
  await sql`UPDATE shop_feeds SET feed_url = ${`${httpBase}/${slug}.xml`} WHERE id = ${shop.feedId}`;
  return shop;
}

const run = (today = '2026-11-17') => runIngest({ sql, config: TEST_CONFIG, mailer }, today);
const lowest = async () => {
  const result = await compareProduct({ sql, config: TEST_CONFIG }, { query: EAN.roborockS8, country: 'SK' });
  return result.status === 'ok' ? result.price_analysis.current_lowest_price : result.status;
};

describe('runIngest', () => {
  it('naimportuje všetky aktívne feedy a prepočíta štatistiky', async () => {
    await shopWithFileFeed('alfa', renderHeurekaFeed([s8('489')]));
    await shopWithFileFeed('beta', renderHeurekaFeed([s8('479')]));

    const report = await run();

    expect(report.feeds.map((f) => [f.shop, f.status, f.itemsTotal])).toEqual([
      ['alfa', 'ok', 1],
      ['beta', 'ok', 1],
    ]);
    expect(await lowest()).toBe(479);
  });

  it('stiahne feed cez HTTP', async () => {
    await shopWithHttpFeed('alfa', { status: 200, body: renderHeurekaFeed([s8('489')]) });

    await run();

    expect(await lowest()).toBe(489);
  });

  it('rozbalí feed komprimovaný gzipom', async () => {
    await shopWithFileFeed('alfa', gzipSync(renderHeurekaFeed([s8('489')])), 'alfa.xml.gz');

    await run();

    expect(await lowest()).toBe(489);
  });

  it('nedostupný feed zapíše ako zlyhaný a ostatné naimportuje', async () => {
    await shopWithHttpFeed('alfa', { status: 503, body: 'výpadok' });
    await shopWithFileFeed('beta', renderHeurekaFeed([s8('479')]));

    const report = await run();

    expect(report.feeds.map((f) => [f.shop, f.status])).toEqual([
      ['alfa', 'failed'],
      ['beta', 'ok'],
    ]);
    expect(report.feeds[0]?.error).toContain('503');
    expect(first(await sql`SELECT status, error FROM feed_imports ORDER BY id LIMIT 1`).status).toBe('failed');
    expect(await lowest()).toBe(479);
  });

  it('chýbajúci súbor feedu zapíše ako zlyhaný import', async () => {
    const shop = await seedShop(sql, { slug: 'alfa' });
    await sql`UPDATE shop_feeds SET feed_url = ${pathToFileURL(path.join(dir, 'nie-je.xml')).href} WHERE id = ${shop.feedId}`;

    const report = await run();

    expect(report.feeds[0]).toMatchObject({ shop: 'alfa', status: 'failed' });
  });

  it('poškodený feed nezmení ponuky z predošlého dňa', async () => {
    await shopWithFileFeed('alfa', renderHeurekaFeed([s8('489')]));
    await run('2026-11-16');
    await writeFile(path.join(dir, 'alfa.xml'), '<SHOP><SHOPITEM><ITEM_ID>s8</ITEM_ID>');

    const report = await run('2026-11-17');

    expect(report.feeds[0]?.status).toBe('failed');
    expect(await lowest()).toBe(489);
  });

  it('vypnutý feed preskočí', async () => {
    const shop = await shopWithFileFeed('alfa', renderHeurekaFeed([s8('489')]));
    await sql`UPDATE shop_feeds SET is_active = false WHERE id = ${shop.feedId}`;

    expect((await run()).feeds).toEqual([]);
  });

  it('v správe uvedie preskočené položky s dôvodom', async () => {
    await shopWithFileFeed(
      'alfa',
      renderHeurekaFeed([s8('489'), feedItem({ externalId: 'zla', price: 'zadarmo' })]),
    );

    const report = await run();

    expect(report.feeds[0]).toMatchObject({ itemsTotal: 1, itemsSkipped: 1, skipReasons: { invalid_price: 1 } });
  });

  it('po importe pošle upozornenia strážiacim, ktorým cena klesla na cieľ', async () => {
    await shopWithFileFeed('alfa', renderHeurekaFeed([s8('489')]));
    await run('2026-11-16');
    await createAlert(
      { sql, config: TEST_CONFIG, mailer },
      { ean: EAN.roborockS8, country: 'SK', email: 'jana@example.com', targetPrice: 450, source: 'web' },
    );
    await confirmAlert(sql, first(await sql`SELECT token FROM price_alerts`).token);
    mailer.sent.length = 0;
    await writeFile(path.join(dir, 'alfa.xml'), renderHeurekaFeed([s8('445')]));

    const report = await run('2026-11-17');

    expect(report.alerts).toEqual({ sent: 1, failed: 0 });
    expect(mailer.sent[0]?.subject).toBe('Roborock S8 Pro Ultra White teraz za 445 €');
  });
});

describe('renderHeurekaFeed', () => {
  it('vytvorí feed, ktorý parser načíta späť vrátane špeciálnych znakov', async () => {
    await shopWithFileFeed(
      'alfa',
      renderHeurekaFeed([
        feedItem({
          externalId: 'tv',
          name: 'LG OLED55C4 55" <4K> & HDR',
          price: '1299.90',
          ean: EAN.galaxyS24,
          deliveryDays: 3,
          brand: 'LG',
        }),
      ]),
    );

    await run();

    expect(first(await sql`SELECT name, price, delivery_days FROM offers`)).toEqual({
      name: 'LG OLED55C4 55" <4K> & HDR',
      price: '1299.90',
      delivery_days: 3,
    });
  });
});
