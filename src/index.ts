// Vstupný bod pre Vercel. Vercel nespúšťa `src/server.ts`; hľadá súbor, ktorý
// exportuje aplikáciu, a sám ju obslúži. Na VPS sa naďalej používa `pnpm start`.
import { Hono } from 'hono';
import postgres from 'postgres';
import { logMailer } from './alerts/mailer.ts';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { TIME_ZONE, todayIn } from './dates.ts';
import { createDemoApp } from './dev/demo-app.ts';

// Bez PUBLIC_BASE_URL sa použije adresa, ktorú nasadeniu pridelil Vercel.
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
const config = loadConfig({
  ...process.env,
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL ?? (vercelHost ? `https://${vercelHost}` : undefined),
});
// Funkcia beží vo viacerých inštanciách naraz, preto má každá len pár spojení.
const sql = postgres(config.databaseUrl, { max: 3, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} });
const deps = { sql, config, mailer: logMailer, today: () => todayIn(TIME_ZONE) };

// DEMO=1 pridá stránku, na ktorej končia prekliky do vymyslených e-shopov.
// Vercel rozpozná vstupný bod podľa toho, že exportuje aplikáciu Hono.
const app = new Hono();
if (process.env.DEMO === '1') app.route('/', createDemoApp(deps));
else app.route('/', createApp(deps));

export default app;
