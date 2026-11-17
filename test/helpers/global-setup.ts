// Spustí jednu dočasnú PostgreSQL inštanciu pre celý beh testov (bez Dockeru a bez roota).
import { mkdir, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import type { TestProject } from 'vitest/node';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

export default async function setup(project: TestProject) {
  const dir = path.join(process.cwd(), 'node_modules', '.cache', `test-pg-${process.pid}`);
  await mkdir(path.dirname(dir), { recursive: true });
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'postgres',
    password: 'test',
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  project.provide('pgUrl', `postgres://postgres:test@127.0.0.1:${port}`);

  return async () => {
    await pg.stop();
    await rm(dir, { recursive: true, force: true });
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    pgUrl: string;
  }
}
