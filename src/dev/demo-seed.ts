import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AlertDeps } from '../alerts/alerts.ts';
import { currencyOf } from '../currency.ts';
import { addDays } from '../dates.ts';
import type { FeedItem } from '../ingest/heureka-parser.ts';
import { runIngest } from '../ingest/run.ts';
import { DEMO_OFFERS, DEMO_PRODUCTS, DEMO_SHOPS, type DemoOffer } from './demo-data.ts';
import { renderHeurekaFeed } from './feed-xml.ts';

/** Vymyslený EAN-13 s platnou kontrolnou číslicou. */
export function demoEan(seq: number): string {
  const body = `8580000${String(seq).padStart(5, '0')}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  return body + String((10 - (sum % 10)) % 10);
}

/** Cena ponuky v daný deň, alebo `null`, ak ešte v ponuke nebola. */
function priceOn(offer: DemoOffer, day: number): number | null {
  let price: number | null = null;
  for (const [from, value] of offer.prices) if (from <= day) price = value;
  return price;
}

function feedItems(shop: string, day: number): FeedItem[] {
  const items: FeedItem[] = [];
  for (const offer of DEMO_OFFERS) {
    const price = offer.shop === shop ? priceOn(offer, day) : null;
    const product = DEMO_PRODUCTS.find((p) => p.key === offer.product);
    if (price === null || !product) continue;
    items.push({
      externalId: product.key,
      name: product.name,
      url: `https://${shop}.example/p/${product.key}`,
      price: price.toFixed(2),
      ean: product.eanSeq === null ? null : demoEan(product.eanSeq),
      deliveryDays: offer.deliveryDays,
      brand: product.brand,
      category: product.category,
      imageUrl: null,
    });
  }
  return items;
}

/**
 * Naplní prázdnu databázu ukážkovými e-shopmi a históriou cien. Nejde o skratku:
 * pre každý deň, keď sa niečo zmenilo, vygeneruje XML feedy a pustí ich
 * rovnakou cestou ako ostrý nočný import.
 */
export async function seedDemo(
  deps: AlertDeps,
  opts: { today: string; feedDir: string; shopBaseUrl: string },
): Promise<void> {
  const { sql } = deps;
  await mkdir(opts.feedDir, { recursive: true });
  const feedFile = (slug: string) => path.join(opts.feedDir, `${slug}.xml`);

  const [network] = await sql<{ id: number }[]>`
    INSERT INTO affiliate_networks (code, name) VALUES ('demo', 'Ukážková sieť') RETURNING id`;
  for (const shop of DEMO_SHOPS) {
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO shops (slug, name, country, currency, website_url)
      VALUES (${shop.slug}, ${shop.name}, ${shop.country}, ${currencyOf(shop.country)}, ${`https://${shop.slug}.example`})
      RETURNING id`;
    await sql`
      INSERT INTO shop_feeds (shop_id, network_id, feed_url, deeplink_template, commission_pct)
      VALUES (${row!.id}, ${network!.id}, ${pathToFileURL(feedFile(shop.slug)).href},
              ${`${opts.shopBaseUrl}/demo/eshop?sub={click_id}&url={url}`}, 3)`;
  }

  const days = [...new Set([...DEMO_OFFERS.flatMap((o) => o.prices.map(([day]) => day)), 0])].sort((a, b) => a - b);
  for (const day of days) {
    for (const shop of DEMO_SHOPS) {
      await writeFile(feedFile(shop.slug), renderHeurekaFeed(feedItems(shop.slug, day)));
    }
    const report = await runIngest(deps, addDays(opts.today, day));
    const failed = report.feeds.filter((f) => f.status !== 'ok');
    if (failed.length > 0) throw new Error(`Ukážkový import zlyhal: ${JSON.stringify(failed)}`);
  }
}
