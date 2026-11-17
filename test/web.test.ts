import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { createTestDb, first, type Sql } from './helpers/db.ts';
import { memoryMailer, seedCatalog, TEST_CONFIG, testDeps } from './helpers/scenario.ts';
import { EAN } from './helpers/seed.ts';

let sql: Sql;
let drop: () => Promise<void>;
let app: ReturnType<typeof createApp>;
let mailer: ReturnType<typeof memoryMailer>;

beforeAll(async () => {
  ({ sql, drop } = await createTestDb());
  await seedCatalog(sql);
  mailer = memoryMailer();
  app = createApp(testDeps(sql, mailer));
});
afterAll(async () => {
  await drop();
});

const get = async (path: string) => {
  const res = await app.request(path);
  return { res, html: await res.text() };
};

const post = async (path: string, fields: Record<string, string>) => {
  const res = await app.request(path, { method: 'POST', body: new URLSearchParams(fields) });
  return { res, html: await res.text() };
};

/** Viditeľný text stránky bez štýlov a značiek, s jednou medzerou medzi slovami. */
const text = (html: string) =>
  html
    .replace(/<style[^]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

/** Samostatná databáza pre testy, ktoré dáta menia. */
async function isolated<T>(run: (ctx: { sql: Sql; app: ReturnType<typeof createApp>; mailer: typeof mailer }) => Promise<T>) {
  const fresh = await createTestDb();
  try {
    await seedCatalog(fresh.sql);
    const freshMailer = memoryMailer();
    return await run({ sql: fresh.sql, app: createApp(testDeps(fresh.sql, freshMailer)), mailer: freshMailer });
  } finally {
    await fresh.drop();
  }
}

describe('úvodná stránka', () => {
  it('vysvetlí službu a ponúkne vyhľadávanie', async () => {
    const { res, html } = await get('/');

    expect(res.status).toBe(200);
    expect(html).toContain('Cenoradar');
    expect(html).toContain('action="/hladat"');
  });

  it('úvod sa pýta, či je zľava skutočná, a hneď ponúka vyhľadávanie', async () => {
    const { html } = await get('/');

    expect(text(html)).toContain('Je to naozaj zľava?');
    expect(html).toMatch(/<h1>[^]*?<\/h1>\s*<p class="lead">[^]*?<form class="search-full" action="\/hladat"/);
  });

  it('príklad zdanlivej zľavy je označený ako ilustračný a nevedie do obchodu', async () => {
    const { html } = await get('/');

    expect(text(html)).toContain('Ilustračný príklad');
    expect(html).toContain('aria-label="Graf ceny v Obchode Beta za 60 dní');
    expect(html).not.toContain('rel="sponsored');
    expect(html).not.toContain('/redirect');
  });

  it('AI chat spomína len ChatGPT a Claude a vedie na návod', async () => {
    const { html } = await get('/');
    const page = text(html);

    expect(page).toContain('Pýtajte sa v ChatGPT alebo Claude');
    expect(html).toMatch(/href="\/pre-ai-asistentov">Návod na pripojenie/);
    expect(page).toContain('Ukážka rozhovoru. Obchody a ceny sú vymyslené.');
    expect(page).not.toContain('Gemini');
  });

  it('úvod vedie k stráženiu ceny a vysvetľuje, ako zarábame', async () => {
    const { html } = await get('/');
    const page = text(html);

    expect(page).toContain('Nechajte ju strážiť');
    expect(html).toMatch(/href="\/hladat">Vybrať produkt na stráženie/);
    expect(page).toContain('poradie ponúk určuje len cena');
    expect(html).toMatch(/href="\/affiliate">Viac o tom, ako zarábame/);
  });

  it('každá stránka priznáva partnerské odkazy', async () => {
    expect((await get('/')).html).toContain('Odkazy do e-shopov sú partnerské');
  });

  it('stránky posiela s bezpečnostnými hlavičkami', async () => {
    const { res } = await get('/');

    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
  });
});

describe('rozloženie', () => {
  it('hlavička má logo, menu pre mobil a odkaz na obsah', async () => {
    const { html } = await get('/ako-to-funguje');

    expect(html).toContain('<a class="brand" href="/"');
    expect(html).toContain('<details');
    expect(html).toContain('href="#obsah"');
    expect(html).toContain('id="obsah"');
  });

  it.each(['/', '/ako-to-funguje', `/produkt/${EAN.roborockS8}`])(
    'stránka %s nemá JavaScript ani cookies',
    async (path) => {
      const { res, html } = await get(path);

      expect(res.status).toBe(200);
      expect(html).not.toContain('<script');
      expect(res.headers.get('set-cookie')).toBeNull();
    },
  );

  it('zdieľanie má obrázok s absolútnou adresou a ikonu', async () => {
    const { html } = await get('/');

    expect(html).toContain('<meta property="og:image" content="https://domena.example/og.png"');
    expect(html).toContain('<meta property="og:title"');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
    expect(html).toContain('<link rel="icon" href="/favicon.svg"');
  });

  it('vyhľadávanie v hlavičke si drží krajinu, úvod ho nemá', async () => {
    const cz = await get(`/produkt/${EAN.roborockS8}?country=CZ`);
    const home = await get('/');

    expect(cz.html).toMatch(/<form class="search-compact"[^]*?name="country" value="CZ"[^]*?<\/form>/);
    expect(home.html).not.toContain('<form class="search-compact"');
  });
});

describe('obsahové a právne stránky', () => {
  it.each(['/ako-to-funguje', '/pre-ai-asistentov', '/o-nas', '/ochrana-sukromia', '/affiliate'])(
    '%s sa zobrazí',
    async (path) => {
      const { res, html } = await get(path);

      expect(res.status).toBe(200);
      expect(html).toContain('<h1>');
    },
  );

  it('zásady ochrany súkromia priznávajú IP adresu pri preklikoch aj v technických záznamoch servera', async () => {
    const { html } = await get('/ochrana-sukromia');

    expect(html).toContain('spracúvajú vašu IP adresu a cookies');
    expect(html).toContain('technické záznamy');
  });

  it('robots.txt drží roboty mimo presmerovaní a stráženia', async () => {
    const { res, html } = await get('/robots.txt');

    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(html).toContain('Disallow: /redirect');
    expect(html).toContain('Disallow: /alert');
  });
});

describe('údaje prevádzkovateľa', () => {
  const OPERATOR = {
    name: 'Ján Vzorový',
    address: 'Hlavná 1, 811 01 Bratislava',
    email: 'kontakt@domena.example',
    phone: '+421 900 000 000',
  };
  const getWithOperator = async (path: string) =>
    (await createApp({ ...testDeps(sql), config: { ...TEST_CONFIG, operator: OPERATOR } }).request(path)).text();

  it('kým nie sú nastavené, stránka o službe ich označí na doplnenie', async () => {
    const { html } = await get('/o-nas');

    expect(html).toContain('Pracovná verzia');
    expect(html).toContain('[DOPLNIŤ: meno a priezvisko]');
    expect(html).toContain('[DOPLNIŤ: adresa bydliska]');
    expect(html).toContain('[DOPLNIŤ: e-mail]');
    expect(html).toContain('[DOPLNIŤ: telefón]');
  });

  it('stránka o službe uvádza všetko, čo vyžaduje § 4 zákona o elektronickom obchode', async () => {
    const html = await getWithOperator('/o-nas');

    expect(html).toContain('Ján Vzorový');
    expect(html).toContain('Hlavná 1, 811 01 Bratislava');
    expect(html).toContain('href="mailto:kontakt@domena.example"');
    expect(html).toContain('+421 900 000 000');
    expect(html).toContain('Slovenská obchodná inšpekcia');
    expect(html).not.toContain('DOPLNIŤ');
    expect(html).not.toContain('Pracovná verzia');
  });

  it('zásady ochrany súkromia uvádzajú prevádzkovateľa a kam posielať žiadosti', async () => {
    const html = await getWithOperator('/ochrana-sukromia');

    expect(html).toContain('Prevádzkovateľom je Ján Vzorový, Hlavná 1, 811 01 Bratislava');
    expect(html).toContain('href="mailto:kontakt@domena.example"');
    expect(html).not.toContain('[DOPLNIŤ: meno a priezvisko]');
    expect(html).not.toContain('[DOPLNIŤ: e-mail]');
  });
});

describe('vyhľadávanie', () => {
  it('bez dopytu ukáže len formulár', async () => {
    const { res, html } = await get('/hladat');

    expect(res.status).toBe(200);
    expect(html).toContain('name="q"');
  });

  it('jednoznačný dopyt presmeruje rovno na stránku produktu', async () => {
    const res = await app.request('/hladat?q=roborock+s8+pro+ultra');

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`/produkt/${EAN.roborockS8}`);
  });

  it('pri českom vyhľadávaní si krajinu ponechá', async () => {
    const res = await app.request('/hladat?q=roborock+s8+pro+ultra&country=CZ');

    expect(res.headers.get('location')).toBe(`/produkt/${EAN.roborockS8}?country=CZ`);
  });

  it('nejednoznačný dopyt ukáže zoznam produktov s cenou', async () => {
    const { res, html } = await get('/hladat?q=galaxy+s24');

    expect(res.status).toBe(200);
    expect(html).toContain(`href="/produkt/${EAN.galaxyS24}"`);
    expect(html).toContain('Samsung Galaxy S24 8GB/256GB Onyx Black');
    expect(html).toContain('od 699 €');
  });

  it('neznámy produkt oznámi a nespadne', async () => {
    const { res, html } = await get('/hladat?q=kosa%C4%8Dka');

    expect(res.status).toBe(200);
    expect(html).toContain('sme nenašli');
  });

  it('dopyt vypíše bezpečne', async () => {
    const { html } = await get(`/hladat?q=${encodeURIComponent('"><script>alert(1)</script>')}`);

    expect(html).not.toContain('<script>alert(1)');
  });
});

describe('stránka produktu', () => {
  it('ukáže ponuky od najlacnejšej s odkazom cez redirector', async () => {
    const { res, html } = await get(`/produkt/${EAN.roborockS8}`);
    const offer = first(await sql`SELECT id FROM offers WHERE external_id = 'a-s8'`);

    expect(res.status).toBe(200);
    expect(html).toContain('<h1>Roborock S8 Pro Ultra White</h1>');
    expect(html.indexOf('E-shop alfa')).toBeLessThan(html.indexOf('E-shop beta'));
    expect(html).toContain(`href="https://go.domena.example/redirect?offer_id=${offer.id}&amp;source=web"`);
    expect(html).toContain('rel="sponsored nofollow noopener"');
  });

  it('ukáže verdikt so zdôvodnením a priemery', async () => {
    const { html } = await get(`/produkt/${EAN.roborockS8}`);

    expect(html).toContain('Dobrá cena');
    expect(html).toContain('pod 90-dňovým priemerom');
    expect(html).toContain('538,16 €');
  });

  it('ukáže graf vývoja ceny', async () => {
    const { html } = await get(`/produkt/${EAN.roborockS8}`);

    expect(html).toContain('<svg');
    expect(html).toContain('Vývoj najnižšej ceny za posledných 90 dní');
  });

  it('ponúkne stráženie ceny', async () => {
    const { html } = await get(`/produkt/${EAN.roborockS8}`);

    expect(html).toContain(`href="/alert?ean=${EAN.roborockS8}&amp;target=440&amp;country=SK&amp;source=web"`);
  });

  it('v Česku ukáže ceny v korunách', async () => {
    const { html } = await get(`/produkt/${EAN.roborockS8}?country=CZ`);

    expect(html).toContain('13 490 Kč');
    expect(html).toContain('E-shop gama');
    expect(html).not.toContain('E-shop alfa');
  });

  it('zvýrazní upozornenie na zdanlivú zľavu', async () => {
    await isolated(async (ctx) => {
      await ctx.sql`UPDATE offers SET fake_discount_warning = true, warning_detail = 'Cena bola 515 €, potom stúpla.'
                    WHERE external_id = 'b-s8'`;

      const html = await (await ctx.app.request(`/produkt/${EAN.roborockS8}`)).text();

      expect(html).toContain('Zdanlivá zľava');
      expect(html).toContain('Cena bola 515 €, potom stúpla.');
    });
  });

  it('názov z feedu vypíše bezpečne', async () => {
    await isolated(async (ctx) => {
      await ctx.sql`UPDATE products SET name = '<img src=x onerror=alert(1)>'`;

      const html = await (await ctx.app.request(`/produkt/${EAN.roborockS8}`)).text();

      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;img src=x');
    });
  });

  it.each(['4006381333931', 'abc', '123'])('neznámy produkt „%s“ vráti 404', async (ean) => {
    const { res, html } = await get(`/produkt/${ean}`);

    expect(res.status).toBe(404);
    expect(html).toContain('Produkt sme nenašli');
  });
});

describe('stráženie ceny na webe', () => {
  const form = { ean: EAN.roborockS8, country: 'SK', target: '440', email: 'jana@example.com', source: 'chatgpt' };

  it('formulár je predvyplnený produktom a cieľovou cenou z odkazu', async () => {
    const { res, html } = await get(`/alert?ean=${EAN.roborockS8}&target=440&country=SK&source=chatgpt`);

    expect(res.status).toBe(200);
    expect(html).toContain('Roborock S8 Pro Ultra White');
    expect(html).toContain('489 €');
    expect(html).toContain('name="target" value="440"');
    expect(html).toContain('name="source" value="chatgpt"');
    expect(html).toContain('name="email"');
  });

  it('bez cieľovej ceny navrhne cenu o desatinu nižšiu', async () => {
    const { html } = await get(`/alert?ean=${EAN.roborockS8}`);

    expect(html).toContain('name="target" value="440"');
  });

  it('stránka stráženia sa neindexuje', async () => {
    const { html } = await get(`/alert?ean=${EAN.roborockS8}`);

    expect(html).toContain('<meta name="robots" content="noindex"');
  });

  it('neznámy produkt vráti 404', async () => {
    expect((await get('/alert?ean=4006381333931')).res.status).toBe(404);
  });

  it('odoslanie formulára založí stráženie a požiada o potvrdenie e-mailom', async () => {
    await isolated(async (ctx) => {
      const res = await ctx.app.request('/alert', { method: 'POST', body: new URLSearchParams(form) });

      expect(res.status).toBe(200);
      expect(await res.text()).toContain('Skontrolujte si e-mail');
      expect(ctx.mailer.sent).toHaveLength(1);
      expect(first(await ctx.sql`SELECT status, source, target_price FROM price_alerts`)).toEqual({
        status: 'pending',
        source: 'chatgpt',
        target_price: '440.00',
      });
    });
  });

  it('cenu s desatinnou čiarkou prijme', async () => {
    await isolated(async (ctx) => {
      await ctx.app.request('/alert', { method: 'POST', body: new URLSearchParams({ ...form, target: '439,90' }) });

      expect(first(await ctx.sql`SELECT target_price FROM price_alerts`).target_price).toBe('439.90');
    });
  });

  it('pri chybe vráti formulár s hlásením a zadanými hodnotami', async () => {
    const { res, html } = await post('/alert', { ...form, email: 'jana' });

    expect(res.status).toBe(400);
    expect(html).toContain('Zadajte platnú e-mailovú adresu.');
    expect(html).toContain('value="jana"');
    expect(html).toContain('name="target" value="440"');
  });

  it('robota, ktorý vyplní skryté pole, potichu ignoruje', async () => {
    await isolated(async (ctx) => {
      const res = await ctx.app.request('/alert', {
        method: 'POST',
        body: new URLSearchParams({ ...form, website: 'http://spam.example' }),
      });

      expect(res.status).toBe(200);
      expect(ctx.mailer.sent).toHaveLength(0);
      expect(await ctx.sql`SELECT 1 FROM price_alerts`).toHaveLength(0);
    });
  });

  it('odkaz z e-mailu stráženie potvrdí', async () => {
    await isolated(async (ctx) => {
      await ctx.app.request('/alert', { method: 'POST', body: new URLSearchParams(form) });
      const { token } = first(await ctx.sql`SELECT token FROM price_alerts`);

      const res = await ctx.app.request(`/alert/potvrdit?token=${token}`);

      expect(res.status).toBe(200);
      expect(await res.text()).toContain('Stráženie je aktívne');
      expect(first(await ctx.sql`SELECT status FROM price_alerts`).status).toBe('active');
    });
  });

  it('neplatný potvrdzovací odkaz vráti 404', async () => {
    const { res, html } = await get('/alert/potvrdit?token=abc');

    expect(res.status).toBe(404);
    expect(html).toContain('Odkaz už neplatí');
  });

  it('odhlasovací odkaz sa najprv opýta, odhlási až tlačidlo', async () => {
    await isolated(async (ctx) => {
      await ctx.app.request('/alert', { method: 'POST', body: new URLSearchParams(form) });
      const { token } = first(await ctx.sql`SELECT token FROM price_alerts`);

      const page = await ctx.app.request(`/alert/odhlasit?token=${token}`);

      expect(await page.text()).toContain('method="post"');
      expect(first(await ctx.sql`SELECT status FROM price_alerts`).status).toBe('pending');

      const done = await ctx.app.request('/alert/odhlasit', { method: 'POST', body: new URLSearchParams({ token }) });

      expect(await done.text()).toContain('Stráženie je zrušené');
      expect(first(await ctx.sql`SELECT status FROM price_alerts`).status).toBe('cancelled');
    });
  });
});
