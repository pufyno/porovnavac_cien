import { OpenAPIHono } from '@hono/zod-openapi';
import { registerCompareRoute } from './api/compare-route.ts';
import { UNAVAILABLE_INSTRUCTION, type AppDeps } from './deps.ts';
import { handleMcpRequest } from './mcp/server.ts';
import { registerRedirectRoute } from './redirect/route.ts';
import { registerWeb } from './web/index.ts';

export function createApp(deps: AppDeps): OpenAPIHono {
  const app = new OpenAPIHono();

  app.onError((error, c) => {
    console.error(`${c.req.method} ${c.req.path} zlyhalo:`, error);
    return c.json({ status: 'unavailable', _ai_instruction: UNAVAILABLE_INSTRUCTION }, 503);
  });

  registerWeb(app, deps);

  app.get('/health', async (c) => {
    await deps.sql`SELECT 1`;
    return c.json({ status: 'ok' });
  });

  registerCompareRoute(app, deps);
  registerRedirectRoute(app, deps);

  app.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: `${deps.config.siteName} – porovnanie cien elektroniky (SK/CZ)`,
      version: '0.1.0',
      description: 'Aktuálne ceny, história cien a odhalenie zdanlivých zliav v slovenských a českých e-shopoch.',
    },
    servers: [{ url: deps.config.publicBaseUrl }],
  });

  app.post('/mcp', (c) => handleMcpRequest(deps, c.req.raw));
  app.all('/mcp', (c) =>
    c.json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null }, 405, {
      Allow: 'POST',
    }),
  );

  return app;
}
