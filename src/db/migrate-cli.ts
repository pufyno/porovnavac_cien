import postgres from 'postgres';
import { loadConfig } from '../config.ts';
import { migrate } from './migrate.ts';

const sql = postgres(loadConfig(process.env).databaseUrl, { max: 1, onnotice: () => {} });
try {
  const applied = await migrate(sql);
  console.log(applied.length === 0 ? 'Databáza je aktuálna.' : `Aplikované migrácie:\n  ${applied.join('\n  ')}`);
} finally {
  await sql.end();
}
