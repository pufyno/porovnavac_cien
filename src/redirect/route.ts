import type { OpenAPIHono } from '@hono/zod-openapi';
import { html } from 'hono/html';
import type { AppDeps } from '../deps.ts';
import { normalizeSource } from '../source.ts';
import { page } from '../web/layout.ts';
import { recordClick } from './redirect.ts';

export function registerRedirectRoute(app: OpenAPIHono, deps: AppDeps): void {
  app.get('/redirect', async (c) => {
    c.header('Cache-Control', 'no-store');
    c.header('X-Robots-Tag', 'noindex, nofollow');

    const target = await recordClick(deps.sql, {
      offerId: c.req.query('offer_id') ?? '',
      source: normalizeSource(c.req.query('source')),
      alertId: c.req.query('alert_id'),
    });
    if (target) return c.redirect(target, 302);

    return c.html(
      page({
        siteName: deps.config.siteName,
        title: 'Ponuka už nie je dostupná',
        noindex: true,
        body: html`<h1>Ponuka už nie je dostupná</h1>
          <p>Odkaz smeruje na ponuku, ktorú už neevidujeme. Aktuálne ceny nájdete vo vyhľadávaní.</p>
          <p><a class="button" href="/hladat">Hľadať produkt</a></p>`,
      }),
      404,
    );
  });
}
