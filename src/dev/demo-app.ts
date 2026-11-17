import { Hono } from 'hono';
import { html } from 'hono/html';
import { createApp } from '../app.ts';
import type { AppDeps } from '../deps.ts';

/**
 * Aplikácia pre ukážku: celá ostrá aplikácia a navyše stránka, na ktorej končia
 * prekliky. Ukážkové e-shopy neexistujú, preto preklik nevedie do obchodu.
 */
export function createDemoApp(deps: AppDeps): Hono {
  const app = new Hono();
  app.get('/demo/eshop', (c) =>
    c.html(html`<!doctype html>
      <meta charset="utf-8" />
      <meta name="robots" content="noindex" />
      <title>Ukážkový e-shop</title>
      <body style="font:16px system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem">
        <h1>Tu by bol e-shop</h1>
        <p>V ostrej prevádzke by vás partnerská sieť presmerovala na stránku produktu:</p>
        <p><code>${c.req.query('url') ?? ''}</code></p>
        <p>Identifikátor prekliku (sub-ID pre sieť): <code>${c.req.query('sub') ?? ''}</code></p>
        <p><a href="/">Späť na ukážku</a></p>
      </body>`),
  );
  app.route('/', createApp(deps));
  return app;
}
