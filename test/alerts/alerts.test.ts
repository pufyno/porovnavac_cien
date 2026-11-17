import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cancelAlert, confirmAlert, createAlert, purgeAlerts, triggerAlerts } from '../../src/alerts/alerts.ts';
import { createTestDb, first, type Sql } from '../helpers/db.ts';
import { memoryMailer, seedCatalog, TEST_CONFIG } from '../helpers/scenario.ts';
import { EAN } from '../helpers/seed.ts';

let sql: Sql;
let drop: () => Promise<void>;
let mailer: ReturnType<typeof memoryMailer>;
let deps: { sql: Sql; config: typeof TEST_CONFIG; mailer: typeof mailer };

// Katalóg: Roborock stojí 489 € (SK) a 13 490 Kč (CZ).
beforeEach(async () => {
  ({ sql, drop } = await createTestDb());
  await seedCatalog(sql);
  mailer = memoryMailer();
  deps = { sql, config: TEST_CONFIG, mailer };
});
afterEach(async () => {
  await drop();
});

const request = (overrides: Record<string, unknown> = {}) =>
  createAlert(deps, {
    ean: EAN.roborockS8,
    country: 'SK',
    email: 'jana@example.com',
    targetPrice: 450,
    source: 'chatgpt',
    ...overrides,
  });

const alert = async () => first(await sql`SELECT * FROM price_alerts`);
const alerts = () => sql`SELECT * FROM price_alerts`;

/** Vytvorí stráženie a potvrdí ho. */
async function activeAlert(overrides: Record<string, unknown> = {}) {
  await request(overrides);
  const created = first(await sql`SELECT * FROM price_alerts ORDER BY created_at DESC LIMIT 1`);
  await confirmAlert(sql, created.token);
  mailer.sent.length = 0;
  return created;
}

const lowerPrice = (price: string) => sql`
  UPDATE product_price_stats SET current_min = ${price} WHERE country = 'SK'
    AND product_id = (SELECT product_id FROM product_eans WHERE ean = ${EAN.roborockS8})`;

describe('createAlert', () => {
  it('uloží nepotvrdené stráženie', async () => {
    expect(await request()).toEqual({ ok: true });

    expect(await alert()).toMatchObject({
      country: 'SK',
      email: 'jana@example.com',
      target_price: '450.00',
      status: 'pending',
      source: 'chatgpt',
      confirmed_at: null,
    });
  });

  it('pošle e-mail s odkazom na potvrdenie', async () => {
    await request();

    const { token } = await alert();
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]).toMatchObject({
      to: 'jana@example.com',
      subject: 'Potvrďte stráženie ceny: Roborock S8 Pro Ultra White',
    });
    expect(mailer.sent[0]?.text).toContain(`https://domena.example/alert/potvrdit?token=${token}`);
    expect(mailer.sent[0]?.text).toContain('450 €');
  });

  it('e-mail očistí od medzier', async () => {
    await request({ email: '  jana@example.com ' });

    expect((await alert()).email).toBe('jana@example.com');
  });

  it.each(['', 'jana', 'jana@', 'jana@example', 'a b@example.com', `${'x'.repeat(250)}@example.com`])(
    'neplatný e-mail „%s“ odmietne a nič neuloží',
    async (email) => {
      expect(await request({ email })).toEqual({ ok: false, field: 'email', message: 'Zadajte platnú e-mailovú adresu.' });
      expect(await alerts()).toHaveLength(0);
      expect(mailer.sent).toHaveLength(0);
    },
  );

  it.each([0, -5, Number.NaN, 1e9])('neplatnú cieľovú cenu %s odmietne', async (targetPrice) => {
    expect(await request({ targetPrice })).toMatchObject({ ok: false, field: 'target' });
  });

  it('cieľ, ktorý cena už spĺňa, odmietne a povie aktuálnu cenu', async () => {
    expect(await request({ targetPrice: 489 })).toEqual({
      ok: false,
      field: 'target',
      message: 'Produkt už teraz stojí 489 €. Zadajte nižšiu cenu, pri ktorej vám máme dať vedieť.',
    });
  });

  it('neznámy produkt odmietne', async () => {
    expect(await request({ ean: '4006381333931' })).toMatchObject({ ok: false, field: 'product' });
  });

  it('opakovaná žiadosť zmení cieľovú cenu, ale e-mail hneď znova nepošle', async () => {
    await request();

    await request({ targetPrice: 430 });

    expect(await alerts()).toHaveLength(1);
    expect((await alert()).target_price).toBe('430.00');
    expect(mailer.sent).toHaveLength(1);
  });

  it('po 15 minútach pošle potvrdzovací e-mail znova', async () => {
    await request();
    await sql`UPDATE price_alerts SET last_email_at = now() - interval '16 minutes'`;

    await request();

    expect(mailer.sent).toHaveLength(2);
  });

  it('pri potvrdenom strážení zmení cieľ a oznámi to e-mailom', async () => {
    await activeAlert();
    await sql`UPDATE price_alerts SET last_email_at = now() - interval '16 minutes'`;

    await request({ targetPrice: 420 });

    expect(await alert()).toMatchObject({ status: 'active', target_price: '420.00' });
    expect(mailer.sent[0]?.subject).toBe('Zmena stráženia ceny: Roborock S8 Pro Ultra White');
  });

  it('odhlásené stráženie sa novou žiadosťou vráti na potvrdenie', async () => {
    const created = await activeAlert();
    await cancelAlert(sql, created.token);
    await sql`UPDATE price_alerts SET last_email_at = now() - interval '16 minutes'`;

    await request();

    expect((await alert()).status).toBe('pending');
    expect(mailer.sent[0]?.subject).toContain('Potvrďte');
  });

  it('keď e-mail nejde odoslať, žiadosť zlyhá a stráženie sa neuloží', async () => {
    deps = { ...deps, mailer: memoryMailer('jana@example.com') };

    await expect(request()).rejects.toThrow('SMTP nedostupné');
    expect(await alerts()).toHaveLength(0);
  });

  it('rovnaký produkt môže strážiť viac ľudí a jeden človek v oboch krajinách', async () => {
    await request();
    await request({ email: 'peter@example.com' });
    await request({ country: 'CZ', targetPrice: 12000 });

    expect(await alerts()).toHaveLength(3);
  });
});

describe('confirmAlert', () => {
  it('potvrdí stráženie a vráti, čoho sa týka', async () => {
    await request();
    const { token } = await alert();

    expect(await confirmAlert(sql, token)).toEqual({
      productName: 'Roborock S8 Pro Ultra White',
      targetPrice: 450,
      currency: 'EUR',
    });
    const confirmed = await alert();
    expect(confirmed.status).toBe('active');
    expect(confirmed.confirmed_at).toBeInstanceOf(Date);
  });

  it('druhé kliknutie na odkaz nič nepokazí', async () => {
    await request();
    const { token } = await alert();
    await confirmAlert(sql, token);

    expect(await confirmAlert(sql, token)).not.toBeNull();
    expect((await alert()).status).toBe('active');
  });

  it.each(['', 'abc', '0b0e6f0a-7d5c-4a52-9d3b-2f0a7c1e9a11'])('neznámy odkaz „%s“ nepotvrdí nič', async (token) => {
    await request();

    expect(await confirmAlert(sql, token)).toBeNull();
    expect((await alert()).status).toBe('pending');
  });

  it('odhlásené stráženie starým odkazom neobnoví', async () => {
    const created = await activeAlert();
    await cancelAlert(sql, created.token);

    expect(await confirmAlert(sql, created.token)).toBeNull();
    expect((await alert()).status).toBe('cancelled');
  });
});

describe('cancelAlert', () => {
  it('odhlási stráženie', async () => {
    const created = await activeAlert();

    expect(await cancelAlert(sql, created.token)).toBe(true);
    expect((await alert()).status).toBe('cancelled');
  });

  it('opakované odhlásenie je v poriadku', async () => {
    const created = await activeAlert();
    await cancelAlert(sql, created.token);

    expect(await cancelAlert(sql, created.token)).toBe(true);
  });

  it('neznámy odkaz neodhlási nič', async () => {
    await activeAlert();

    expect(await cancelAlert(sql, 'abc')).toBe(false);
    expect((await alert()).status).toBe('active');
  });
});

describe('triggerAlerts', () => {
  it('keď cena klesne na cieľ, pošle e-mail s odkazom na najlacnejšiu ponuku', async () => {
    const created = await activeAlert();
    await lowerPrice('445');
    const offer = first(await sql`SELECT id FROM offers WHERE external_id = 'a-s8'`);

    expect(await triggerAlerts(deps)).toEqual({ sent: 1, failed: 0 });

    expect(mailer.sent[0]).toMatchObject({
      to: 'jana@example.com',
      subject: 'Roborock S8 Pro Ultra White teraz za 445 €',
    });
    expect(mailer.sent[0]?.text).toContain('E-shop alfa');
    expect(mailer.sent[0]?.text).toContain(
      `https://go.domena.example/redirect?offer_id=${offer.id}&source=email&alert_id=${created.id}`,
    );
    expect(mailer.sent[0]?.text).toContain('partnerský');
  });

  it('stráženie po odoslaní ukončí, aby e-mail neprišiel znova', async () => {
    await activeAlert();
    await lowerPrice('445');
    await triggerAlerts(deps);

    expect(await triggerAlerts(deps)).toEqual({ sent: 0, failed: 0 });
    const done = await alert();
    expect(done.status).toBe('triggered');
    expect(done.triggered_at).toBeInstanceOf(Date);
    expect(mailer.sent).toHaveLength(1);
  });

  it('kým je cena nad cieľom, neposiela nič', async () => {
    await activeAlert();
    await lowerPrice('451');

    expect(await triggerAlerts(deps)).toEqual({ sent: 0, failed: 0 });
    expect((await alert()).status).toBe('active');
  });

  it('nepotvrdené stráženie sa nikdy nespustí', async () => {
    await request();
    mailer.sent.length = 0;
    await lowerPrice('400');

    await triggerAlerts(deps);

    expect(mailer.sent).toHaveLength(0);
  });

  it('keď e-mail nejde odoslať, stráženie ostane aktívne a ostatné sa odošlú', async () => {
    await activeAlert();
    await activeAlert({ email: 'peter@example.com' });
    await lowerPrice('445');
    deps = { ...deps, mailer: memoryMailer('jana@example.com') };

    expect(await triggerAlerts(deps)).toEqual({ sent: 1, failed: 1 });

    const statuses = await sql`SELECT email, status FROM price_alerts ORDER BY email`;
    expect(statuses).toEqual([
      { email: 'jana@example.com', status: 'active' },
      { email: 'peter@example.com', status: 'triggered' },
    ]);
  });

  it('české stráženie sa riadi českou cenou v korunách', async () => {
    await activeAlert({ country: 'CZ', targetPrice: 13000 });
    await sql`UPDATE product_price_stats SET current_min = 12990 WHERE country = 'CZ'`;

    await triggerAlerts(deps);

    expect(mailer.sent[0]?.subject).toBe('Roborock S8 Pro Ultra White teraz za 12 990 Kč');
    expect(mailer.sent[0]?.text).toContain('E-shop gama');
  });
});

describe('purgeAlerts', () => {
  it('zmaže nepotvrdené po 7 dňoch a ukončené po 30 dňoch, aktívne nechá', async () => {
    await request({ email: 'nepotvrdil@example.com' });
    await request({ email: 'cerstvy@example.com' });
    const cancelled = await activeAlert({ email: 'odhlaseny@example.com' });
    await cancelAlert(sql, cancelled.token);
    await activeAlert({ email: 'aktivny@example.com' });
    await sql`UPDATE price_alerts SET updated_at = now() - interval '8 days' WHERE email = 'nepotvrdil@example.com'`;
    await sql`UPDATE price_alerts SET updated_at = now() - interval '31 days'
              WHERE email IN ('odhlaseny@example.com', 'aktivny@example.com')`;

    expect(await purgeAlerts(sql)).toBe(2);

    const left = await sql`SELECT email FROM price_alerts ORDER BY email`;
    expect(left.map((r) => r.email)).toEqual(['aktivny@example.com', 'cerstvy@example.com']);
  });
});
