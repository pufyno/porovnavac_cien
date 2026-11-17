// Ukážka na lokálne vyskúšanie: `pnpm demo`. Spustí dočasnú PostgreSQL bez
// Dockeru, naplní ju vzorovými feedmi a pustí celú aplikáciu.
import { rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { serve } from '@hono/node-server';
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';
import { logMailer } from '../alerts/mailer.ts';
import { loadConfig } from '../config.ts';
import { TIME_ZONE, todayIn } from '../dates.ts';
import { migrate } from '../db/migrate.ts';
import { createDemoApp } from './demo-app.ts';
import { seedDemo } from './demo-seed.ts';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

const dir = path.resolve('.dev-db');
await rm(dir, { recursive: true, force: true });

const pgPort = await freePort();
const pg = new EmbeddedPostgres({
  databaseDir: path.join(dir, 'pg'),
  user: 'postgres',
  password: 'demo',
  port: pgPort,
  persistent: false,
  onLog: () => {},
  onError: () => {},
});
console.log('Štartujem dočasnú PostgreSQL…');
await pg.initialise();
await pg.start();

const config = loadConfig({ ...process.env, DATABASE_URL: `postgres://postgres:demo@127.0.0.1:${pgPort}/postgres` });
const sql = postgres(config.databaseUrl, { max: 10, onnotice: () => {} });
const today = todayIn(TIME_ZONE);
const deps = { sql, config, mailer: logMailer, today: () => today };

await migrate(sql);
console.log('Importujem vzorové feedy (100 dní histórie)…');
await seedDemo(deps, { today, feedDir: path.join(dir, 'feeds'), shopBaseUrl: config.redirectBaseUrl });

const app = createDemoApp(deps);

const hostname = process.env.HOST ?? '127.0.0.1';
const server = serve({ fetch: app.fetch, port: config.port, hostname }, () => {
  const base = `http://localhost:${config.port}`;
  console.log(`
Ukážka beží: ${base}

  Web:      ${base}/hladat?q=roborock+s8+pro+ultra
  REST API: ${base}/api/v1/product-compare?query=roborock%20s8%20pro%20ultra
  OpenAPI:  ${base}/openapi.json
  MCP:      ${base}/mcp

Pripojenie do Claude Code:
  claude mcp add --transport http porovnavac ${base}/mcp

Čo skúsiť: „roborock s8 pro ultra“ (zdanlivá zľava), „iphone 15“ (počkať),
„galaxy s24“ (spresnenie), „dyson v15“ (málo údajov), „sony xm5“.
E-maily stráženia ceny sa vypisujú sem do konzoly. Ukončenie: Ctrl+C.
`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => {
      void sql
        .end({ timeout: 5 })
        .then(() => pg.stop())
        .then(() => rm(dir, { recursive: true, force: true }))
        .then(() => process.exit(0));
    });
  });
}
