import { serve } from '@hono/node-server';
import postgres from 'postgres';
import { logMailer } from './alerts/mailer.ts';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { TIME_ZONE, todayIn } from './dates.ts';

const config = loadConfig(process.env);
const sql = postgres(config.databaseUrl, { max: 10 });
const app = createApp({ sql, config, mailer: logMailer, today: () => todayIn(TIME_ZONE) });

// Počúva len lokálne; na internet ho vystavuje reverzný proxy.
const hostname = process.env.HOST ?? '127.0.0.1';
const server = serve({ fetch: app.fetch, port: config.port, hostname }, () => {
  console.log(`Beží na http://${hostname}:${config.port} (verejná adresa ${config.publicBaseUrl}).`);
  console.warn('POZOR: e-maily sa neodosielajú, len vypisujú do logu. Služba na odosielanie nie je nastavená.');
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => void sql.end({ timeout: 5 }).then(() => process.exit(0)));
  });
}
