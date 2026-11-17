import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { createTestDb, type Sql } from './helpers/db.ts';
import { seedCatalog, TEST_CONFIG } from './helpers/scenario.ts';

let sql: Sql;
let drop: () => Promise<void>;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  ({ sql, drop } = await createTestDb());
  await seedCatalog(sql);
  app = createApp({ sql, config: TEST_CONFIG });
});
afterAll(async () => {
  await drop();
});

const compare = async (params: Record<string, string>) => {
  const res = await app.request(`/api/v1/product-compare?${new URLSearchParams(params)}`);
  return { res, body: (await res.json()) as Record<string, any> };
};

/** Aplikácia nad databázou, ktorá neodpovedá. */
function appWithDeadDb() {
  const dead = postgres('postgres://x:x@127.0.0.1:1/x', { connect_timeout: 1, max: 1 });
  return createApp({ sql: dead, config: TEST_CONFIG });
}

describe('GET /api/v1/product-compare', () => {
  it('vráti porovnanie ako JSON', async () => {
    const { res, body } = await compare({ query: 'roborock s8 pro ultra', country: 'SK' });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(body).toMatchObject({
      status: 'ok',
      product_name: 'Roborock S8 Pro Ultra White',
      currency: 'EUR',
      price_analysis: { current_lowest_price: 489, verdict: 'BUY_NOW' },
    });
    expect(body.offers[0].buy_url).toMatch(/^https:\/\/go\.domena\.example\/redirect\?offer_id=\d+&source=api$/);
  });

  it('bez krajiny porovnáva Slovensko', async () => {
    const { body } = await compare({ query: 'roborock s8 pro ultra' });

    expect(body).toMatchObject({ status: 'ok', country: 'SK' });
  });

  it('krajinu prijme aj malými písmenami', async () => {
    const { body } = await compare({ query: 'roborock s8 pro ultra', country: 'cz' });

    expect(body).toMatchObject({ status: 'ok', country: 'CZ', currency: 'CZK' });
  });

  it('neznámu krajinu berie ako Slovensko namiesto chyby', async () => {
    const { res, body } = await compare({ query: 'roborock s8 pro ultra', country: 'Slovensko' });

    expect(res.status).toBe(200);
    expect(body.country).toBe('SK');
  });

  it('zdroj z parametra source prenesie do odkazov', async () => {
    const { body } = await compare({ query: 'roborock s8 pro ultra', source: 'gemini' });

    expect(body.offers[0].buy_url).toMatch(/&source=gemini$/);
  });

  it('nejednoznačný dopyt nie je chyba: vráti kandidátov', async () => {
    const { res, body } = await compare({ query: 'galaxy s24' });

    expect(res.status).toBe(200);
    expect(body.status).toBe('needs_clarification');
    expect(body.candidates).toHaveLength(2);
  });

  it('chýbajúci dopyt nie je chyba: vráti pokyn pre AI', async () => {
    const { res, body } = await compare({});

    expect(res.status).toBe(200);
    expect(body.status).toBe('not_found');
    expect(body._ai_instruction).toEqual(expect.any(String));
  });

  it('pri výpadku databázy vráti 503 s pokynom pre AI', async () => {
    const res = await appWithDeadDb().request('/api/v1/product-compare?query=roborock');

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      status: 'unavailable',
      _ai_instruction: expect.stringContaining('dočasne nedostupná'),
    });
  });
});

describe('GET /openapi.json', () => {
  it('popisuje porovnanie tak, aby ho AI platforma vedela zavolať', async () => {
    const doc = (await (await app.request('/openapi.json')).json()) as Record<string, any>;

    expect(doc.openapi).toMatch(/^3\.1/);
    expect(doc.servers).toEqual([{ url: 'https://domena.example' }]);
    const operation = doc.paths['/api/v1/product-compare'].get;
    expect(operation.operationId).toBe('compareProduct');
    expect(operation.description).toEqual(expect.any(String));
    const params = Object.fromEntries(operation.parameters.map((p: any) => [p.name, p]));
    expect(params.query.required).toBe(true);
    expect(params.country.schema.enum).toEqual(['SK', 'CZ']);
    expect(operation.responses['200']).toBeDefined();
  });
});

describe('GET /health', () => {
  it('hlási, že služba aj databáza bežia', async () => {
    const res = await app.request('/health');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('pri výpadku databázy vráti 503', async () => {
    expect((await appWithDeadDb().request('/health')).status).toBe(503);
  });
});

describe('neznáma adresa', () => {
  it('vráti 404', async () => {
    expect((await app.request('/nieco')).status).toBe(404);
  });
});
