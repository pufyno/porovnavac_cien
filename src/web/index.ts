import type { OpenAPIHono } from '@hono/zod-openapi';
import { html } from 'hono/html';
import type { AppDeps } from '../deps.ts';
import { registerAlertRoutes } from './alert.ts';
import { page } from './layout.ts';
import { searchForm } from './components.ts';
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
        body: html`<div class="wrap main-wide"><h1>Koľko to naozaj stojí a je tá zľava skutočná?</h1>
          <p>
            Porovnávame ceny elektroniky v slovenských a českých e-shopoch, sledujeme ich vývoj a upozorníme, keď
            obchod cenu pred „akciou“ zdvihol.
          </p>
          ${searchForm('', 'SK')}
          <h2>Čo tu zistíte</h2>
          <ul>
            <li><strong>Kde je produkt najlacnejší</strong> a či ho majú skladom.</li>
            <li><strong>Či je cena dobrá</strong> oproti priemeru za posledných 30 a 90 dní.</li>
            <li><strong>Či je zľava skutočná</strong>, alebo sa počíta z krátko navýšenej ceny.</li>
          </ul>
          <p><a href="/ako-to-funguje">Ako to počítame</a></p>
          <h2>Priamo v AI chate</h2>
          <p>
            Na ceny sa môžete pýtať aj v ChatGPT, Claude alebo Gemini bežnou vetou.
            <a href="/pre-ai-asistentov">Ako si službu pripojiť</a>
          </p>
          <h2>Stráženie ceny</h2>
          <p>
            Cena je zatiaľ vysoká? Pri každom produkte si nastavíte cenu, pri ktorej vám pošleme e-mail. Bez
            registrácie.
          </p></div>`,
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
