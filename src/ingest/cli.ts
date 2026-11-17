import postgres from 'postgres';
import { logMailer } from '../alerts/mailer.ts';
import { loadConfig } from '../config.ts';
import { TIME_ZONE, todayIn } from '../dates.ts';
import { runIngest } from './run.ts';

// Nočný job: `pnpm ingest`. Dátum sa dá zadať ručne ako prvý argument (YYYY-MM-DD).
const config = loadConfig(process.env);
const today = process.argv[2] ?? todayIn(TIME_ZONE);
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
  console.error(`Neplatný dátum „${today}“, čakám YYYY-MM-DD.`);
  process.exit(2);
}

const sql = postgres(config.databaseUrl, { max: 2, onnotice: () => {} });
try {
  const report = await runIngest({ sql, config, mailer: logMailer }, today);
  for (const feed of report.feeds) {
    const skipped = feed.itemsSkipped > 0 ? `, preskočených ${feed.itemsSkipped} ${JSON.stringify(feed.skipReasons)}` : '';
    console.log(
      `${feed.status.padEnd(8)} ${feed.shop}: ${feed.itemsTotal} položiek, ${feed.itemsChanged} zmien${skipped}` +
        (feed.error ? ` – ${feed.error}` : ''),
    );
  }
  console.log(
    `Upozornenia: ${report.alerts.sent} odoslaných, ${report.alerts.failed} zlyhaných. ` +
      `Zmazané staré stráženia: ${report.alertsPurged}.`,
  );
  // Nenulový kód, aby plánovač (cron, systemd) zlyhanie feedu zaznamenal.
  if (report.feeds.some((f) => f.status !== 'ok') || report.alerts.failed > 0) process.exitCode = 1;
} finally {
  await sql.end();
}
