import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { createTestDb, type Sql } from './helpers/db.ts';
import { testDeps } from './helpers/scenario.ts';

let sql: Sql;
let drop: () => Promise<void>;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  ({ sql, drop } = await createTestDb());
  app = createApp(testDeps(sql));
});
afterAll(async () => {
  await drop();
});

describe('statické súbory', () => {
  it.each([
    '/fonts/inter-v20-latin-wght.woff2',
    '/fonts/inter-v20-latin-ext-wght.woff2',
    '/fonts/space-grotesk-v22-latin-wght.woff2',
    '/fonts/space-grotesk-v22-latin-ext-wght.woff2',
  ])('písmo %s vráti s typom font/woff2 a trvalou vyrovnávacou pamäťou', async (path) => {
    const res = await app.request(path);
    const body = new Uint8Array(await res.arrayBuffer());

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('font/woff2');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    // Súbor WOFF2 začína podpisom „wOF2“.
    expect(new TextDecoder().decode(body.slice(0, 4))).toBe('wOF2');
  });

  it.each(['/fonts/neexistuje.woff2', '/fonts/..%2F..%2Fpackage.json', '/fonts/LICENSE-inter.txt'])(
    'neznámy alebo podvrhnutý súbor %s vráti 404',
    async (path) => {
      expect((await app.request(path)).status).toBe(404);
    },
  );

  it.each([
    ['/favicon.svg', 'image/svg+xml'],
    ['/favicon.ico', 'image/x-icon'],
    ['/apple-touch-icon.png', 'image/png'],
    ['/og.png', 'image/png'],
  ])('obrázok značky %s vráti s typom %s', async (path, type) => {
    const res = await app.request(path);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe(type);
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400');
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(100);
  });

  it.each([
    ['/apple-touch-icon.png', 180, 180],
    ['/og.png', 1200, 630],
  ])('%s má rozmery %i × %i', async (path, width, height) => {
    const view = new DataView(await (await app.request(path)).arrayBuffer());

    // Hlavička IHDR: šírka a výška na bajtoch 16 až 23.
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([width, height]);
  });

  it('favicon.ico obsahuje ikonu 16 aj 32 px', async () => {
    const bytes = new Uint8Array(await (await app.request('/favicon.ico')).arrayBuffer());

    // ICONDIR: typ 1 (ikona), dve položky; šírka položky je jej prvý bajt.
    expect([...bytes.slice(0, 6)]).toEqual([0, 0, 1, 0, 2, 0]);
    expect([bytes[6], bytes[22]]).toEqual([16, 32]);
  });

  it('CSP povoľuje písma len z vlastného servera', async () => {
    const res = await app.request('/');

    expect(res.headers.get('content-security-policy')).toContain("font-src 'self'");
  });
});
