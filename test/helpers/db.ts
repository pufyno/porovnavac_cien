import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { inject } from 'vitest';
import { migrate } from '../../src/db/migrate.ts';

export type Sql = postgres.Sql;

/** Vytvorí prázdnu databázu. Vráti klienta a funkciu na upratanie. */
export async function createEmptyDb(): Promise<{ sql: Sql; url: string; drop: () => Promise<void> }> {
  const base = inject('pgUrl');
  const name = `t_${randomBytes(6).toString('hex')}`;
  const admin = postgres(`${base}/postgres`, { max: 1, onnotice: () => {} });
  await admin.unsafe(`CREATE DATABASE ${name}`);
  const url = `${base}/${name}`;
  const sql = postgres(url, { max: 4, onnotice: () => {} });
  return {
    sql,
    url,
    drop: async () => {
      await sql.end();
      await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await admin.end();
    },
  };
}

/** Databáza so všetkými migráciami. */
export async function createTestDb() {
  const db = await createEmptyDb();
  await migrate(db.sql);
  return db;
}

/** Prvý riadok výsledku; zlyhá, ak je výsledok prázdny. */
export function first<T>(rows: readonly T[]): T {
  const row = rows[0];
  if (row === undefined) throw new Error('Očakával sa aspoň jeden riadok.');
  return row;
}
