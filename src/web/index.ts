import type { OpenAPIHono } from '@hono/zod-openapi';
import { html } from 'hono/html';
import type { AppDeps } from '../deps.ts';
import { registerAlertRoutes } from './alert.ts';
import { page } from './layout.ts';
import { homeBody } from './home.ts';
import { registerSearchRoutes } from './search.ts';
import { STATIC_PAGES } from './static-pages.ts';
import { registerStaticFiles } from './static-files.ts';

const CONTENT_SECURITY_POLICY =
  "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; form-action 'self'; " +
  "base-uri 'none'; frame-ancestors 'none'";

const ROBOTS = `User-agent: *
Disallow: /redirect
Disallow: /alert
Disallow: /hladat
Disallow: /api/
Disallow: /mcp
`;

export function registerWeb(app: OpenAPIHono, deps: AppDeps): void {
  const { config } = deps;

  app.use('*', async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (c.res.headers.get('content-type')?.includes('text/html')) {
      c.header('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    }
  });

  registerStaticFiles(app);

  app.get('/', (c) =>
    c.html(
      page({
        site: config,
        layout: 'landing',
        title: 'Ceny elektroniky a história zliav',
        description:
          'Porovnanie cien elektroniky v slovenských a českých e-shopoch s históriou cien a odhalením zdanlivých zliav.',
        body: homeBody(config.siteName),
      }),
    ),
  );

  for (const staticPage of STATIC_PAGES) {
    app.get(staticPage.path, (c) =>
      c.html(
        page({
          site: config,
          title: staticPage.title,
          description: staticPage.description,
          body: staticPage.body(config),
        }),
      ),
    );
  }

  app.get('/robots.txt', (c) => c.text(ROBOTS));

  registerSearchRoutes(app, deps);
  registerAlertRoutes(app, deps);
}
