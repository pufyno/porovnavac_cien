import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { createTestDb, type Sql } from './helpers/db.ts';
import { seedCatalog, TEST_CONFIG } from './helpers/scenario.ts';

let sql: Sql;
let drop: () => Promise<void>;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  ({ sql, drop } = await createTestDb());
  await seedCatalog(sql);
  app = createApp({ sql, config: TEST_CONFIG });
});
afterAll(async () => {
  await drop();
});

/** Skutočný MCP klient pripojený na aplikáciu bez sieťového portu. */
async function connect(
  opts: { path?: string; headers?: Record<string, string>; target?: ReturnType<typeof createApp> } = {},
) {
  const target = opts.target ?? app;
  const transport = new StreamableHTTPClientTransport(new URL(`http://test.local${opts.path ?? '/mcp'}`), {
    fetch: (url, init) => Promise.resolve(target.request(String(url), init as RequestInit)),
    requestInit: { headers: opts.headers ?? {} },
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

const callCompare = async (client: Client, args: Record<string, unknown>) =>
  (await client.callTool({ name: 'compare_prices', arguments: args })) as {
    isError?: boolean;
    structuredContent?: Record<string, any>;
    content: { type: string; text: string }[];
  };

describe('MCP server na /mcp', () => {
  it('ponúka jeden nástroj len na čítanie', async () => {
    const client = await connect();

    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name)).toEqual(['compare_prices']);
    expect(tools[0]?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    expect(tools[0]?.inputSchema.required).toEqual(['query']);
    expect((tools[0]?.inputSchema.properties as any).country.enum).toEqual(['SK', 'CZ']);
  });

  it('nástroj vráti porovnanie ako štruktúrované dáta aj ako text', async () => {
    const client = await connect();

    const result = await callCompare(client, { query: 'roborock s8 pro ultra' });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      status: 'ok',
      country: 'SK',
      price_analysis: { current_lowest_price: 489 },
    });
    expect(JSON.parse(result.content[0]!.text)).toEqual(result.structuredContent);
  });

  it('odkazy označí zdrojom mcp', async () => {
    const client = await connect();

    const result = await callCompare(client, { query: 'roborock s8 pro ultra' });

    expect(result.structuredContent?.offers[0].buy_url).toMatch(/&source=mcp$/);
  });

  it('zdroj sa dá určiť v adrese konektora', async () => {
    const client = await connect({ path: '/mcp?source=chatgpt' });

    const result = await callCompare(client, { query: 'roborock s8 pro ultra' });

    expect(result.structuredContent?.offers[0].buy_url).toMatch(/&source=chatgpt$/);
  });

  it('zdroj odhadne z hlavičky User-Agent', async () => {
    const client = await connect({ headers: { 'User-Agent': 'Claude-User' } });

    const result = await callCompare(client, { query: 'roborock s8 pro ultra' });

    expect(result.structuredContent?.offers[0].buy_url).toMatch(/&source=claude$/);
  });

  it('v Česku vráti ceny v korunách', async () => {
    const client = await connect();

    const result = await callCompare(client, { query: 'roborock s8 pro ultra', country: 'CZ' });

    expect(result.structuredContent).toMatchObject({ status: 'ok', currency: 'CZK' });
  });

  it('nejednoznačný dopyt nie je chyba nástroja', async () => {
    const client = await connect();

    const result = await callCompare(client, { query: 'galaxy s24' });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent?.status).toBe('needs_clarification');
  });

  it('pri výpadku databázy vráti chybu nástroja s pokynom pre AI', async () => {
    const dead = postgres('postgres://x:x@127.0.0.1:1/x', { connect_timeout: 1, max: 1 });
    const client = await connect({ target: createApp({ sql: dead, config: TEST_CONFIG }) });

    const result = await callCompare(client, { query: 'roborock' });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('dočasne nedostupná');
  });

  it('GET na /mcp odmietne, server nedrží žiadne spojenia', async () => {
    expect((await app.request('/mcp')).status).toBe(405);
  });
});
