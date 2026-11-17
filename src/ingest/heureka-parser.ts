import { SaxesParser } from 'saxes';
import { normalizeEan } from './gtin.ts';

export interface FeedItem {
  externalId: string;
  name: string;
  url: string;
  /** Cena s DPH ako desatinný reťazec s bodkou, napr. "489" alebo "25000.50". */
  price: string;
  ean: string | null;
  /** 0 = skladom, null = neznáme. */
  deliveryDays: number | null;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
}

export interface ParseStats {
  /** Počet elementov SHOPITEM vo feede. */
  total: number;
  skipped: number;
  reasons: Record<string, number>;
}

export class FeedParseError extends Error {}

const FIELDS = new Set([
  'ITEM_ID',
  'PRODUCTNAME',
  'PRODUCT',
  'URL',
  'PRICE_VAT',
  'EAN',
  'DELIVERY_DATE',
  'MANUFACTURER',
  'CATEGORYTEXT',
  'IMGURL',
]);

const DAY_MS = 86_400_000;

function parsePrice(raw: string | undefined): string | null {
  const value = (raw ?? '').replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0) return null;
  return value;
}

function parseHttpUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? raw : null;
  } catch {
    return null;
  }
}

function parseDeliveryDays(raw: string | undefined, today: string): number | null {
  if (!raw) return null;
  if (/^\d{1,3}$/.test(raw)) return Number(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const diff = (Date.parse(`${raw}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS;
    return Number.isNaN(diff) ? null : Math.max(0, Math.round(diff));
  }
  return null;
}

function toItem(fields: Record<string, string>, today: string): FeedItem | string {
  const externalId = fields.ITEM_ID;
  if (!externalId) return 'missing_item_id';
  const name = fields.PRODUCTNAME || fields.PRODUCT;
  if (!name) return 'missing_name';
  const url = parseHttpUrl(fields.URL);
  if (!url) return 'invalid_url';
  const price = parsePrice(fields.PRICE_VAT);
  if (!price) return 'invalid_price';
  return {
    externalId,
    name,
    url,
    price,
    ean: normalizeEan(fields.EAN),
    deliveryDays: parseDeliveryDays(fields.DELIVERY_DATE, today),
    brand: fields.MANUFACTURER || null,
    category: fields.CATEGORYTEXT || null,
    imageUrl: parseHttpUrl(fields.IMGURL),
  };
}

function sniffEncoding(head: Uint8Array): string {
  const declared = /encoding\s*=\s*["']([\w.-]+)["']/i.exec(Buffer.from(head.subarray(0, 256)).toString('latin1'));
  return declared?.[1] ?? 'utf-8';
}

function createDecoder(head: Uint8Array): TextDecoder {
  try {
    return new TextDecoder(sniffEncoding(head));
  } catch {
    return new TextDecoder('utf-8');
  }
}

/** Prevedie bajty na text podľa kódovania z XML hlavičky. Reťazce prepúšťa bez zmeny. */
async function* decode(source: AsyncIterable<string | Uint8Array>): AsyncGenerator<string> {
  let decoder: TextDecoder | undefined;
  let head: Buffer = Buffer.alloc(0);

  for await (const chunk of source) {
    if (typeof chunk === 'string') {
      yield chunk;
    } else if (decoder) {
      yield decoder.decode(chunk, { stream: true });
    } else {
      // Hlavička môže prísť rozdelená na viac kusov; počkáme, kým ju máme celú.
      head = Buffer.concat([head, chunk]);
      if (head.length < 256 && !head.includes('?>')) continue;
      decoder = createDecoder(head);
      yield decoder.decode(head, { stream: true });
    }
  }
  if (decoder) yield decoder.decode();
  else if (head.length > 0) yield createDecoder(head).decode(head);
}

/**
 * Streamovo číta produktový feed vo formáte Heureka XML. Položky vydáva
 * priebežne, takže pamäť nezávisí od veľkosti súboru. Neplatné položky
 * preskočí a zapíše do `stats`; pri poškodenom XML vyhodí `FeedParseError`.
 */
export async function* parseHeurekaFeed(
  source: AsyncIterable<string | Uint8Array>,
  opts: { today: string; stats?: ParseStats },
): AsyncGenerator<FeedItem> {
  const { today, stats } = opts;
  const parser = new SaxesParser();
  let ready: FeedItem[] = [];
  let error: Error | undefined;

  let depth = 0;
  let itemDepth = -1;
  let fields: Record<string, string> = {};
  let field: string | null = null;

  const appendText = (text: string) => {
    if (field !== null && depth === itemDepth + 1) fields[field] = (fields[field] ?? '') + text;
  };

  parser.on('error', (e) => {
    error ??= e;
  });
  parser.on('opentag', (node) => {
    depth++;
    const name = node.name.toUpperCase();
    if (itemDepth === -1) {
      if (name === 'SHOPITEM') {
        itemDepth = depth;
        fields = {};
      }
    } else if (depth === itemDepth + 1) {
      field = FIELDS.has(name) ? name : null;
    }
  });
  parser.on('text', appendText);
  parser.on('cdata', appendText);
  parser.on('closetag', () => {
    if (depth === itemDepth + 1) {
      if (field !== null) fields[field] = (fields[field] ?? '').trim();
      field = null;
    } else if (depth === itemDepth) {
      itemDepth = -1;
      const result = toItem(fields, today);
      if (stats) stats.total++;
      if (typeof result !== 'string') {
        ready.push(result);
      } else if (stats) {
        stats.skipped++;
        stats.reasons[result] = (stats.reasons[result] ?? 0) + 1;
      }
    }
    depth--;
  });

  const fail = () => new FeedParseError(`Neplatné XML vo feede: ${error?.message ?? 'neznáma chyba'}`);

  for await (const text of decode(source)) {
    if (text.length === 0) continue;
    parser.write(text);
    if (error) throw fail();
    const batch = ready;
    ready = [];
    yield* batch;
  }
  parser.close();
  if (error) throw fail();
  yield* ready;
}
