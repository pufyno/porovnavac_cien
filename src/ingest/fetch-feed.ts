import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';

/** Feed, ktorý sa do tohto času nestiahne, sa považuje za nedostupný. */
const FETCH_TIMEOUT_MS = 5 * 60_000;

async function openRaw(url: string): Promise<Readable> {
  if (url.startsWith('file://')) return createReadStream(fileURLToPath(url));
  if (!/^https?:\/\//.test(url)) throw new Error(`Nepodporovaná adresa feedu: ${url}`);

  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': 'porovnavac-cien-feed-import/0.1' },
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error(`Feed sa nepodarilo stiahnuť: HTTP ${response.status}.`);
  }
  return Readable.fromWeb(response.body as import('node:stream/web').ReadableStream<Uint8Array>);
}

/**
 * Otvorí feed ako prúd bajtov, bez načítania celého súboru do pamäte.
 * Podporuje http(s) aj file:// a súbory komprimované gzipom (.xml.gz)
 * rozbalí podľa prvých dvoch bajtov.
 */
export async function* openFeed(url: string): AsyncGenerator<Uint8Array> {
  const raw = await openRaw(url);
  const iterator = raw[Symbol.asyncIterator]();
  try {
    const head = await iterator.next();
    if (head.done) return;
    const first = head.value as Uint8Array;
    const rest = (async function* () {
      yield first;
      for (;;) {
        const next = await iterator.next();
        if (next.done) return;
        yield next.value as Uint8Array;
      }
    })();
    const isGzip = first.length >= 2 && first[0] === 0x1f && first[1] === 0x8b;
    yield* isGzip ? Readable.from(rest).pipe(createGunzip()) : rest;
  } finally {
    raw.destroy();
  }
}
