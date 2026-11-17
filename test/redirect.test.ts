import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { createTestDb, first, type Sql } from './helpers/db.ts';
import { seedCatalog, testDeps } from './helpers/scenario.ts';

let sql: Sql;
let drop: () => Promise<void>;
let app: ReturnType<typeof createApp>;
let offer: { id: string; shop_id: number; product_id: string };

beforeAll(async () => {
  ({ sql, drop } = await createTestDb());
  await seedCatalog(sql);
  app = createApp(testDeps(sql));
  offer = first(await sql`SELECT id, shop_id, product_id FROM offers WHERE external_id = 'a-s8'`);
});
afterAll(async () => {
  await drop();
});

const clicks = () => sql`SELECT * FROM click_logs ORDER BY clicked_at`;
const lastClick = async () => first(await sql`SELECT * FROM click_logs ORDER BY clicked_at DESC LIMIT 1`);

describe('GET /redirect', () => {
  it('presmeruje na partnerský odkaz e-shopu s cieľovou adresou ponuky', async () => {
    const res = await app.request(`/redirect?offer_id=${offer.id}&source=chatgpt`);

    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location')!);
    expect(location.origin + location.pathname).toBe('https://net.example/click');
    expect(location.searchParams.get('a')).toBe('1');
    expect(location.searchParams.get('url')).toBe('https://shop.example/p/a-s8');
  });

  it('zapíše preklik a jeho identifikátor pošle sieti ako sub-ID', async () => {
    const res = await app.request(`/redirect?offer_id=${offer.id}&source=chatgpt`);

    const click = await lastClick();
    expect(click).toMatchObject({
      offer_id: offer.id,
      shop_id: offer.shop_id,
      product_id: offer.product_id,
      source: 'chatgpt',
      price: '489.00',
      alert_id: null,
    });
    expect(new URL(res.headers.get('location')!).searchParams.get('sub')).toBe(click.id);
  });

  it.each([
    ['chýbajúci', ''],
    ['neznámy', '&source=<script>'],
  ])('%s zdroj zapíše ako unknown', async (_label, param) => {
    await app.request(`/redirect?offer_id=${offer.id}${param}`);

    expect((await lastClick()).source).toBe('unknown');
  });

  it('pri prekliku z e-mailu zapíše, ktoré stráženie ceny ho prinieslo', async () => {
    const alertId = '0b0e6f0a-7d5c-4a52-9d3b-2f0a7c1e9a11';

    await app.request(`/redirect?offer_id=${offer.id}&source=email&alert_id=${alertId}`);

    expect(await lastClick()).toMatchObject({ source: 'email', alert_id: alertId });
  });

  it('neplatné alert_id ignoruje a presmeruje', async () => {
    const res = await app.request(`/redirect?offer_id=${offer.id}&alert_id=xyz`);

    expect(res.status).toBe(302);
    expect((await lastClick()).alert_id).toBeNull();
  });

  it('cieľ berie len z databázy, nie z adresy požiadavky', async () => {
    const res = await app.request(`/redirect?offer_id=${offer.id}&url=https://zly.example&desturl=https://zly.example`);

    expect(res.headers.get('location')).not.toContain('zly.example');
  });

  it('presmerovanie sa necachuje a neindexuje', async () => {
    const res = await app.request(`/redirect?offer_id=${offer.id}`);

    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('presmeruje aj na ponuku, ktorá už vo feede nie je', async () => {
    const fresh = await createTestDb();
    try {
      await seedCatalog(fresh.sql);
      await fresh.sql`UPDATE offers SET is_active = false WHERE external_id = 'a-s8'`;
      const { id } = first(await fresh.sql`SELECT id FROM offers WHERE external_id = 'a-s8'`);

      const res = await createApp(testDeps(fresh.sql)).request(`/redirect?offer_id=${id}`);

      expect(res.status).toBe(302);
    } finally {
      await fresh.drop();
    }
  });

  it('e-shop bez partnerského odkazu dostane návštevníka priamo', async () => {
    const fresh = await createTestDb();
    try {
      await seedCatalog(fresh.sql);
      await fresh.sql`UPDATE shop_feeds SET is_active = false`;
      const { id } = first(await fresh.sql`SELECT id FROM offers WHERE external_id = 'a-s8'`);

      const res = await createApp(testDeps(fresh.sql)).request(`/redirect?offer_id=${id}`);

      expect(res.headers.get('location')).toBe('https://shop.example/p/a-s8');
    } finally {
      await fresh.drop();
    }
  });

  it.each(['999999', 'abc', '', '1 OR 1=1', '99999999999999999999999'])(
    'neznáma alebo neplatná ponuka „%s“ vráti 404 a nič nezapíše',
    async (offerId) => {
      const before = (await clicks()).length;

      const res = await app.request(`/redirect?offer_id=${encodeURIComponent(offerId)}`);

      expect(res.status).toBe(404);
      expect(await res.text()).toContain('Ponuka už nie je dostupná');
      expect(await clicks()).toHaveLength(before);
    },
  );
});
