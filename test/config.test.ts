import { describe, expect, it } from 'vitest';
import { loadConfig, withDirectDatabase } from '../src/config.ts';
import { todayIn } from '../src/dates.ts';

describe('loadConfig', () => {
  it('načíta nastavenia z premenných prostredia', () => {
    expect(
      loadConfig({
        DATABASE_URL: 'postgres://u:p@localhost/db',
        PORT: '8080',
        PUBLIC_BASE_URL: 'https://domena.sk/',
        REDIRECT_BASE_URL: 'https://go.domena.sk',
        SITE_NAME: 'Cenník',
      }),
    ).toEqual({
      databaseUrl: 'postgres://u:p@localhost/db',
      port: 8080,
      publicBaseUrl: 'https://domena.sk',
      redirectBaseUrl: 'https://go.domena.sk',
      siteName: 'Cenník',
    });
  });

  it('bez nastavení beží lokálne na porte 3000 a presmerováva z tej istej adresy', () => {
    expect(loadConfig({ DATABASE_URL: 'postgres://localhost/db' })).toMatchObject({
      port: 3000,
      publicBaseUrl: 'http://localhost:3000',
      redirectBaseUrl: 'http://localhost:3000',
      siteName: 'Porovnávač cien',
    });
  });

  it('bez databázy odmietne naštartovať a povie prečo', () => {
    expect(() => loadConfig({})).toThrow('DATABASE_URL');
  });

  it.each(['abc', '0', '70000'])('neplatný port „%s“ odmietne', (PORT) => {
    expect(() => loadConfig({ DATABASE_URL: 'postgres://localhost/db', PORT })).toThrow('PORT');
  });

  it('adresu webu bez http(s) odmietne', () => {
    expect(() => loadConfig({ DATABASE_URL: 'postgres://localhost/db', PUBLIC_BASE_URL: 'domena.sk' })).toThrow(
      'PUBLIC_BASE_URL',
    );
  });
});

describe('withDirectDatabase', () => {
  it('migrácie idú cez priame pripojenie, ak ho prostredie ponúka', () => {
    const env = withDirectDatabase({
      DATABASE_URL: 'postgres://u:p@db-pooler.example/app',
      DATABASE_URL_UNPOOLED: 'postgres://u:p@db.example/app',
    });

    expect(loadConfig(env).databaseUrl).toBe('postgres://u:p@db.example/app');
  });

  it('bez priameho pripojenia ostáva DATABASE_URL', () => {
    const env = withDirectDatabase({ DATABASE_URL: 'postgres://u:p@localhost/app' });

    expect(loadConfig(env).databaseUrl).toBe('postgres://u:p@localhost/app');
  });
});

describe('todayIn', () => {
  it('deň sa mení o polnoci miestneho času, nie UTC', () => {
    // 23:30 UTC je v Bratislave už 00:30 nasledujúceho dňa (zimný čas).
    expect(todayIn('Europe/Bratislava', new Date('2026-11-17T23:30:00Z'))).toBe('2026-11-18');
    expect(todayIn('Europe/Bratislava', new Date('2026-11-17T22:30:00Z'))).toBe('2026-11-17');
  });
});
