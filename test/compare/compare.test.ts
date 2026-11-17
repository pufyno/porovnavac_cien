import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compareProduct } from '../../src/compare/compare.ts';
import type { CompareResponse } from '../../src/compare/schema.ts';
import { createTestDb, type Sql } from '../helpers/db.ts';
import { runDay } from '../helpers/scenario.ts';
import { EAN, feedItem, seedShop } from '../helpers/seed.ts';

const TODAY = '2026-11-17';
const config = { publicBaseUrl: 'https://domena.example', redirectBaseUrl: 'https://go.domena.example' };

let sql: Sql;
let drop: () => Promise<void>;

const compare = (query: string, country: 'SK' | 'CZ' = 'SK', source?: string) =>
  compareProduct({ sql, config }, { query, country, source });

function assertOk(r: CompareResponse): asserts r is Extract<CompareResponse, { status: 'ok' }> {
  expect(r.status).toBe('ok');
}
function assertClarify(r: CompareResponse): asserts r is Extract<CompareResponse, { status: 'needs_clarification' }> {
  expect(r.status).toBe('needs_clarification');
}

// Scenár sa nemení, preto stačí jedna databáza pre celý súbor.
beforeAll(async () => {
  ({ sql, drop } = await createTestDb());
  const alfa = await seedShop(sql, { slug: 'alfa' });
  const beta = await seedShop(sql, { slug: 'beta' });
  const gama = await seedShop(sql, { slug: 'gama', country: 'CZ' });

  const s8 = (id: string, price: string, deliveryDays: number | null = 0) =>
    feedItem({ externalId: id, name: 'Roborock S8 Pro Ultra White', brand: 'Roborock', price, ean: EAN.roborockS8, deliveryDays });
  const rest = [
    feedItem({ externalId: 'i15', name: 'Apple iPhone 15 128GB modrý', brand: 'Apple', price: '749', ean: EAN.iphone15 }),
    feedItem({ externalId: 'g128', name: 'Samsung Galaxy S24 8GB/128GB Onyx Black', price: '699', ean: EAN.galaxyS24 }),
    feedItem({ externalId: 'g256', name: 'Samsung Galaxy S24 8GB/256GB Onyx Black', price: '759', ean: '8806095300450' }),
  ];
  const gone = feedItem({ externalId: 'old', name: 'Sony WH-1000XM4 čierne', price: '250', ean: '4548736112117' });

  // Alfa: 545 € od augusta, od 7. 11. poctivo zlacnené na 489 €.
  // Beta: 515 €, na týždeň zdražené na 740 € a „zľavnené“ na 519 €.
  await runDay(sql, '2026-08-09', [
    [alfa, [s8('a-s8', '545'), ...rest, gone]],
    [beta, [s8('b-s8', '515', 3)]],
    [gama, [s8('c-s8', '13490')]],
  ]);
  await runDay(sql, '2026-11-03', [
    [alfa, [s8('a-s8', '545'), ...rest]],
    [beta, [s8('b-s8', '740', 3)]],
    [gama, [s8('c-s8', '13490')]],
  ]);
  await runDay(sql, '2026-11-07', [
    [alfa, [s8('a-s8', '489'), ...rest]],
    [beta, [s8('b-s8', '740', 3)]],
    [gama, [s8('c-s8', '13490')]],
  ]);
  await runDay(sql, '2026-11-10', [
    [alfa, [s8('a-s8', '489'), ...rest]],
    [beta, [s8('b-s8', '519', 3)]],
    [gama, [s8('c-s8', '13490')]],
  ]);
  await runDay(sql, TODAY, [
    [alfa, [s8('a-s8', '489'), ...rest]],
    [beta, [s8('b-s8', '519', 3)]],
    [gama, [s8('c-s8', '13490')]],
  ]);
});
afterAll(async () => {
  await drop();
});

describe('compareProduct', () => {
  it('vráti porovnanie ponúk s analýzou ceny', async () => {
    const result = await compare('Roborock S8 Pro Ultra');

    assertOk(result);
    const ids = await sql<{ external_id: string; id: string }[]>`SELECT external_id, id FROM offers`;
    const offerId = (ext: string) => ids.find((r) => r.external_id === ext)?.id;
    expect(result).toEqual({
      status: 'ok',
      product_name: 'Roborock S8 Pro Ultra White',
      ean: EAN.roborockS8,
      country: 'SK',
      currency: 'EUR',
      price_analysis: {
        current_lowest_price: 489,
        average_30d_price: 524.47,
        average_90d_price: 538.16,
        lowest_90d_price: 489,
        history_days: 90,
        verdict: 'BUY_NOW',
        verdict_reason: 'Aktuálna cena je o 49,16 € pod 90-dňovým priemerom a je najnižšia za posledných 90 dní.',
      },
      offers: [
        {
          shop_name: 'E-shop alfa',
          price: 489,
          in_stock: true,
          delivery_days: 0,
          fake_discount_warning: false,
          buy_url: `https://go.domena.example/redirect?offer_id=${offerId('a-s8')}&source=api`,
        },
        {
          shop_name: 'E-shop beta',
          price: 519,
          in_stock: false,
          delivery_days: 3,
          fake_discount_warning: true,
          warning_detail:
            'Cena bola 515 €, potom na 7 dní stúpla na 740 € a teraz je 519 €. ' +
            'Zľava 30 % sa počíta z krátkodobo navýšenej ceny; oproti cene pred zdražením je produkt o 4 € drahší.',
          buy_url: `https://go.domena.example/redirect?offer_id=${offerId('b-s8')}&source=api`,
        },
      ],
      shops_compared: 2,
      price_alert_url: `https://domena.example/alert?ean=${EAN.roborockS8}&target=440&country=SK&source=api`,
      _ai_instruction: expect.any(String),
    });
  });

  it('inštrukcia pre AI upozorní na falošnú zľavu, partnerské odkazy a obmedzené pokrytie', async () => {
    const result = await compare('Roborock S8 Pro Ultra');

    assertOk(result);
    expect(result._ai_instruction).toContain('E-shop beta');
    expect(result._ai_instruction).toContain('partnerské');
    expect(result._ai_instruction).toContain('len 2 obchody');
    expect(result._ai_instruction).toContain('price_alert_url');
  });

  it('nájde produkt aj s preklepom a bez diakritiky', async () => {
    const result = await compare('roborok s8 pro ultra biely');

    assertOk(result);
    expect(result.product_name).toBe('Roborock S8 Pro Ultra White');
  });

  it('nájde produkt podľa EAN', async () => {
    const result = await compare(EAN.iphone15);

    assertOk(result);
    expect(result.product_name).toBe('Apple iPhone 15 128GB modrý');
  });

  it('neznámy EAN nenájde nič', async () => {
    expect((await compare('4006381333931')).status).toBe('not_found');
  });

  it('pri viacerých zodpovedajúcich produktoch vráti kandidátov namiesto hádania', async () => {
    const result = await compare('samsung galaxy s24');

    assertClarify(result);
    expect(result.exact_match).toBe(true);
    expect(result.candidates).toEqual([
      { product_name: 'Samsung Galaxy S24 8GB/128GB Onyx Black', ean: EAN.galaxyS24, lowest_price: 699, currency: 'EUR' },
      { product_name: 'Samsung Galaxy S24 8GB/256GB Onyx Black', ean: '8806095300450', lowest_price: 759, currency: 'EUR' },
    ]);
    expect(result._ai_instruction).toContain('Opýtaj sa');
  });

  it('keď nesedí číslo modelu, ponúkne podobné produkty ako nepresnú zhodu', async () => {
    const result = await compare('iphone 16');

    assertClarify(result);
    expect(result.exact_match).toBe(false);
    expect(result.candidates.map((c) => c.product_name)).toEqual(['Apple iPhone 15 128GB modrý']);
    expect(result._ai_instruction).toContain('Presný produkt sme nenašli');
  });

  it('neznámy produkt nenájde a povie AI, nech si vypýta presný model', async () => {
    const result = await compare('kosačka na trávu');

    expect(result.status).toBe('not_found');
    expect(result._ai_instruction).toContain('presný názov modelu');
  });

  it.each(['', ' ', 'a'])('príliš krátky dopyt „%s“ nenájde nič a nespadne', async (query) => {
    expect((await compare(query)).status).toBe('not_found');
  });

  it('v Česku vráti len české ponuky v korunách', async () => {
    const result = await compare('roborock s8 pro ultra', 'CZ');

    assertOk(result);
    expect(result.currency).toBe('CZK');
    expect(result.offers.map((o) => [o.shop_name, o.price])).toEqual([['E-shop gama', 13490]]);
    expect(result.price_alert_url).toContain('target=12141&country=CZ');
  });

  it('produkt, ktorý v danej krajine nikto nepredáva, nenájde', async () => {
    expect((await compare('iphone 15 128gb', 'CZ')).status).toBe('not_found');
  });

  it('produkt bez aktívnych ponúk nenájde', async () => {
    expect((await compare('sony wh-1000xm4')).status).toBe('not_found');
  });

  it('zdroj sa prenesie do odkazov', async () => {
    const result = await compare('roborock s8 pro ultra', 'SK', 'chatgpt');

    assertOk(result);
    expect(result.offers[0]?.buy_url).toMatch(/&source=chatgpt$/);
    expect(result.price_alert_url).toMatch(/&source=chatgpt$/);
  });

  it('neznámy zdroj sa do odkazov nedostane', async () => {
    const result = await compare('roborock s8 pro ultra', 'SK', 'x"><script>');

    assertOk(result);
    expect(result.offers[0]?.buy_url).toMatch(/&source=unknown$/);
  });

  it('pri krátkej histórii nevydá verdikt o výhodnosti', async () => {
    const fresh = await createTestDb();
    try {
      const shop = await seedShop(fresh.sql, { slug: 'nova' });
      await runDay(fresh.sql, TODAY, [[shop, [feedItem({ externalId: 'i15', name: 'Apple iPhone 15 128GB', price: '749', ean: EAN.iphone15 })]]]);

      const result = await compareProduct({ sql: fresh.sql, config }, { query: 'iphone 15', country: 'SK' });

      assertOk(result);
      expect(result.price_analysis).toMatchObject({ verdict: 'INSUFFICIENT_DATA', history_days: 1 });
      expect(result._ai_instruction).toContain('nehodnoť');
    } finally {
      await fresh.drop();
    }
  });
});
