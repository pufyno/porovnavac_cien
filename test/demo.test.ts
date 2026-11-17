import { rm } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compareProduct } from '../src/compare/compare.ts';
import type { CompareResponse } from '../src/compare/schema.ts';
import { createDemoApp } from '../src/dev/demo-app.ts';
import { seedDemo } from '../src/dev/demo-seed.ts';
import { createTestDb, first, type Sql } from './helpers/db.ts';
import { memoryMailer, TEST_CONFIG } from './helpers/scenario.ts';

// Celý reťazec naraz: vzorové XML feedy → parser → import → štatistiky → porovnanie.
const feedDir = path.resolve(`node_modules/.cache/test-demo-${process.pid}`);
let sql: Sql;
let drop: () => Promise<void>;

beforeAll(async () => {
  ({ sql, drop } = await createTestDb());
  await seedDemo(
    { sql, config: TEST_CONFIG, mailer: memoryMailer() },
    { today: '2026-11-17', feedDir, shopBaseUrl: 'http://localhost:3000' },
  );
}, 120_000);
afterAll(async () => {
  await drop();
  await rm(feedDir, { recursive: true, force: true });
});

const compare = (query: string, country: 'SK' | 'CZ' = 'SK') =>
  compareProduct({ sql, config: TEST_CONFIG }, { query, country });

function ok(r: CompareResponse): Extract<CompareResponse, { status: 'ok' }> {
  if (r.status !== 'ok') throw new Error(`Čakal som porovnanie, prišlo ${JSON.stringify(r)}`);
  return r;
}

describe('ukážkové dáta', () => {
  it('všetky importy prebehli bez chyby', async () => {
    const statuses = await sql`SELECT status, count(*)::int AS n FROM feed_imports GROUP BY status`;

    expect(statuses.map((r) => r.status)).toEqual(['ok']);
  });

  it('Roborock: poctivé zlacnenie v jednom obchode, zdanlivá zľava v druhom', async () => {
    const result = ok(await compare('roborock s8 pro ultra'));

    expect(result.price_analysis).toMatchObject({ current_lowest_price: 489, verdict: 'BUY_NOW', history_days: 90 });
    const flagged = result.offers.filter((o) => o.fake_discount_warning);
    expect(flagged.map((o) => o.shop_name)).toEqual(['Beta Shop']);
    expect(flagged[0]?.warning_detail).toContain('stúpla na 740 €');
  });

  it('iPhone 15: po zdražení radí počkať', async () => {
    expect(ok(await compare('iphone 15 128gb')).price_analysis.verdict).toBe('WAIT');
  });

  it('Galaxy S24: stabilná cena je bežná cena, ale dopyt treba spresniť', async () => {
    expect((await compare('samsung galaxy s24')).status).toBe('needs_clarification');
    expect(ok(await compare('galaxy s24 256gb')).price_analysis.verdict).toBe('FAIR_PRICE');
  });

  it('nový produkt ešte nemá dosť histórie na verdikt', async () => {
    expect(ok(await compare('dyson v15 detect')).price_analysis).toMatchObject({
      verdict: 'INSUFFICIENT_DATA',
      history_days: 6,
    });
  });

  it('podobné modely rozlíši podľa čísla', async () => {
    expect(ok(await compare('sony xm5')).product_name).toBe('Sony WH-1000XM5 čierne');
    expect(ok(await compare('sony wh-1000xm4')).product_name).toBe('Sony WH-1000XM4 čierne');
  });

  it('Česko má vlastné obchody a ceny v korunách', async () => {
    const result = ok(await compare('roborock s8 pro ultra', 'CZ'));

    expect(result.currency).toBe('CZK');
    expect(result.offers.map((o) => o.shop_name)).toEqual(['Gama Elektro CZ']);
  });

  it('ponuka bez EAN ostane nespárovaná', async () => {
    const offer = first(await sql`SELECT product_id FROM offers WHERE name LIKE 'Kábel USB-C%'`);

    expect(offer.product_id).toBeNull();
  });

  it('preklik z ukážky vedie na ukážkový obchod', async () => {
    const template = first(await sql`SELECT DISTINCT deeplink_template FROM shop_feeds`).deeplink_template;

    expect(template).toBe('http://localhost:3000/demo/eshop?sub={click_id}&url={url}');
  });
});

describe('ukážková aplikácia', () => {
  const app = () =>
    createDemoApp({ sql, config: TEST_CONFIG, mailer: memoryMailer(), today: () => '2026-11-17' });

  it('preklik z ukážky skončí na zástupnej stránke e-shopu, nie v cudzom obchode', async () => {
    const offer = first(await sql<{ id: string }[]>`SELECT id FROM offers WHERE is_active ORDER BY id LIMIT 1`);

    const redirect = await app().request(`/redirect?offer_id=${offer.id}&source=web`);
    expect(redirect.status).toBe(302);
    const target = new URL(redirect.headers.get('location')!);
    expect(target.origin + target.pathname).toBe('http://localhost:3000/demo/eshop');

    const page = await app().request(target.pathname + target.search);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('Tu by bol e-shop');
  });

  it('obsahuje aj celú ostrú aplikáciu', async () => {
    const res = await app().request('/hladat?q=roborock+s8+pro+ultra');

    expect([200, 302]).toContain(res.status);
  });
});
