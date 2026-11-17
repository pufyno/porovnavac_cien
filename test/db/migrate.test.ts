import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../../src/db/migrate.ts';
import { createEmptyDb, type Sql } from '../helpers/db.ts';

let sql: Sql;
let drop: () => Promise<void>;

beforeEach(async () => {
  ({ sql, drop } = await createEmptyDb());
});
afterEach(async () => {
  await drop();
});

describe('migrate', () => {
  it('vytvorí tabuľky z migrácií v repozitári', async () => {
    const applied = await migrate(sql);

    expect(applied).toEqual(['0001_init.sql', '0002_integrity.sql', '0003_search_text.sql']);
    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    expect(tables.map((t) => t.table_name)).toEqual(
      expect.arrayContaining(['shops', 'offers', 'offer_price_history', 'price_alerts', 'click_logs']),
    );
  });

  it('e-shop musí mať menu svojej krajiny, aby sa ceny v krajine dali porovnávať', async () => {
    await migrate(sql);

    await expect(
      sql`INSERT INTO shops (slug, name, country, currency, website_url) VALUES ('x', 'X', 'SK', 'CZK', 'https://x.example')`,
    ).rejects.toThrow(/shops_currency_matches_country/);
  });

  it('produkt môže mať v krajine len jeden otvorený cenový interval', async () => {
    await migrate(sql);
    await sql`INSERT INTO products (name) VALUES ('P')`;
    await sql`INSERT INTO product_price_history (product_id, country, valid_from, min_price) VALUES (1, 'SK', '2026-11-01', 10)`;

    await expect(
      sql`INSERT INTO product_price_history (product_id, country, valid_from, min_price) VALUES (1, 'SK', '2026-11-02', 11)`,
    ).rejects.toThrow(/product_price_history_open/);
  });

  it('vyhľadávací text nezdvojí značku, ktorá už je v názve', async () => {
    await migrate(sql);

    const rows = await sql<{ search_text: string }[]>`
      INSERT INTO products (name, brand) VALUES
        ('Roborock S8 White', 'Roborock'), ('S8 Čierny', 'Roborock'), ('Žltý čajník', NULL)
      RETURNING search_text`;

    expect(rows.map((r) => r.search_text)).toEqual(['roborock s8 white', 'roborock s8 cierny', 'zlty cajnik']);
  });

  it('pri druhom spustení už nič neaplikuje', async () => {
    await migrate(sql);

    expect(await migrate(sql)).toEqual([]);
  });

  it('aplikuje len nové migrácie a v poradí podľa názvu', async () => {
    const dir = await mkdtemp(path.join(process.cwd(), 'node_modules', '.cache', 'mig-'));
    try {
      await writeFile(path.join(dir, '0002_b.sql'), 'ALTER TABLE a ADD COLUMN y int;');
      await writeFile(path.join(dir, '0001_a.sql'), 'CREATE TABLE a (x int);');
      expect(await migrate(sql, dir)).toEqual(['0001_a.sql', '0002_b.sql']);

      await writeFile(path.join(dir, '0003_c.sql'), 'ALTER TABLE a ADD COLUMN z int;');
      expect(await migrate(sql, dir)).toEqual(['0003_c.sql']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('chybná migrácia sa neaplikuje ani čiastočne', async () => {
    const dir = await mkdtemp(path.join(process.cwd(), 'node_modules', '.cache', 'mig-'));
    try {
      await writeFile(path.join(dir, '0001_bad.sql'), 'CREATE TABLE ok_part (x int); SELECT nonexistent_fn();');
      await expect(migrate(sql, dir)).rejects.toThrow();

      const [row] = await sql<{ exists: boolean }[]>`SELECT to_regclass('ok_part') IS NOT NULL AS exists`;
      expect(row?.exists).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
