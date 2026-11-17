import type { FeedItem } from '../../src/ingest/heureka-parser.ts';
import type { Sql } from './db.ts';

export const EAN = {
  roborockS8: '6970995786842',
  galaxyS24: '8806095299877',
  iphone15: '0195949036453',
} as const;

export async function seedShop(
  sql: Sql,
  opts: { slug: string; country?: 'SK' | 'CZ'; deeplink?: string },
): Promise<{ shopId: number; feedId: number }> {
  const country = opts.country ?? 'SK';
  const [network] = await sql<{ id: number }[]>`
    INSERT INTO affiliate_networks (code, name) VALUES ('test', 'Test')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id`;
  const [shop] = await sql<{ id: number }[]>`
    INSERT INTO shops (slug, name, country, currency, website_url)
    VALUES (${opts.slug}, ${`E-shop ${opts.slug}`}, ${country}, ${country === 'SK' ? 'EUR' : 'CZK'},
            ${`https://${opts.slug}.example`})
    RETURNING id`;
  const [feed] = await sql<{ id: number }[]>`
    INSERT INTO shop_feeds (shop_id, network_id, feed_url, deeplink_template)
    VALUES (${shop!.id}, ${network!.id}, ${`https://${opts.slug}.example/feed.xml`},
            ${opts.deeplink ?? 'https://net.example/click?a=1&sub={click_id}&url={url}'})
    RETURNING id`;
  return { shopId: shop!.id, feedId: feed!.id };
}

export function feedItem(overrides: Partial<FeedItem> & { externalId: string }): FeedItem {
  return {
    name: `Produkt ${overrides.externalId}`,
    url: `https://shop.example/p/${overrides.externalId}`,
    price: '100',
    ean: null,
    deliveryDays: 0,
    brand: null,
    category: null,
    imageUrl: null,
    ...overrides,
  };
}

export async function* asItems(items: FeedItem[]): AsyncGenerator<FeedItem> {
  yield* items;
}
