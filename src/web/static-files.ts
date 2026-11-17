import type { OpenAPIHono } from '@hono/zod-openapi';
import { readFile } from 'node:fs/promises';

/** Písma majú v názve verziu, preto ich prehliadač môže držať natrvalo. */
const FONT_CACHE = 'public, max-age=31536000, immutable';
const OTHER_CACHE = 'public, max-age=86400';

/**
 * Súbory z `public/`, ktoré podáva aplikácia (na VPS). Na Verceli ich podáva
 * CDN skôr, než požiadavka príde do aplikácie. Podáva sa len to, čo je tu.
 */
export const STATIC_FILES: Record<string, string> = {
  '/fonts/inter-v20-latin-wght.woff2': 'font/woff2',
  '/fonts/inter-v20-latin-ext-wght.woff2': 'font/woff2',
  '/fonts/space-grotesk-v22-latin-wght.woff2': 'font/woff2',
  '/fonts/space-grotesk-v22-latin-ext-wght.woff2': 'font/woff2',
};

const PUBLIC_DIR = new URL('../../public/', import.meta.url);

export function registerStaticFiles(app: OpenAPIHono): void {
  for (const [path, type] of Object.entries(STATIC_FILES)) {
    app.get(path, async (c) => {
      let body: Uint8Array<ArrayBuffer>;
      try {
        body = new Uint8Array(await readFile(new URL(path.slice(1), PUBLIC_DIR)));
      } catch {
        return c.notFound();
      }
      return c.body(body, 200, {
        'Content-Type': type,
        'Cache-Control': path.startsWith('/fonts/') ? FONT_CACHE : OTHER_CACHE,
      });
    });
  }
}
