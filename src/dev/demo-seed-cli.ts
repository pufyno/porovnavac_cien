// Naplní hostovanú databázu ukážkovými dátami: `pnpm demo:seed`.
// Potrebuje DATABASE_URL a PUBLIC_BASE_URL (adresa nasadenej ukážky). Beží len
// nad prázdnou databázou, aby omylom neprepísala reálne dáta.
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import { logMailer } from '../alerts/mailer.ts';
import { loadConfig } from '../config.ts';
import { TIME_ZONE, todayIn } from '../dates.ts';
import { migrate } from '../db/migrate.ts';
import { seedDemo } from './demo-seed.ts';

const config = loadConfig(process.env);
const sql = postgres(config.databaseUrl, { max: 5, onnotice: () => {} });
const feedDir = await mkdtemp(path.join(os.tmpdir(), 'porovnavac-demo-'));
try {
  await migrate(sql);
  const [{ shops } = { shops: 0 }] = await sql<{ shops: number }[]>`SELECT count(*)::int AS shops FROM shops`;
  if (shops > 0) {
    console.error(`Databáza už obsahuje ${shops} obchodov. Ukážkové dáta sa vkladajú len do prázdnej databázy.`);
    process.exitCode = 1;
  } else {
    const today = todayIn(TIME_ZONE);
    await seedDemo({ sql, config, mailer: logMailer }, { today, feedDir, shopBaseUrl: config.redirectBaseUrl });
    console.log(`Ukážkové dáta sú naimportované. Prekliky vedú na ${config.redirectBaseUrl}/demo/eshop.`);
  }
} finally {
  await sql.end();
  await rm(feedDir, { recursive: true, force: true });
}
