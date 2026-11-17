import type { FeedItem } from '../ingest/heureka-parser.ts';

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Vytvorí feed vo formáte Heureka. Slúži len na ukážkové dáta a testy;
 * skutočné feedy dodávajú e-shopy.
 */
export function renderHeurekaFeed(items: FeedItem[]): string {
  const tag = (name: string, value: string | number | null) =>
    value === null ? '' : `    <${name}>${escapeXml(String(value))}</${name}>\n`;
  const body = items
    .map(
      (item) =>
        '  <SHOPITEM>\n' +
        tag('ITEM_ID', item.externalId) +
        tag('PRODUCTNAME', item.name) +
        tag('URL', item.url) +
        tag('IMGURL', item.imageUrl) +
        tag('PRICE_VAT', item.price) +
        tag('MANUFACTURER', item.brand) +
        tag('CATEGORYTEXT', item.category) +
        tag('EAN', item.ean) +
        tag('DELIVERY_DATE', item.deliveryDays) +
        '  </SHOPITEM>\n',
    )
    .join('');
  return `<?xml version="1.0" encoding="utf-8"?>\n<SHOP>\n${body}</SHOP>\n`;
}
