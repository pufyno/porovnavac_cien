import type postgres from 'postgres';
import type { Country } from '../compare/schema.ts';
import type { AppConfig } from '../config.ts';
import { currencyOf, type Currency } from '../currency.ts';
import { formatPrice } from '../format.ts';
import { normalizeEan } from '../ingest/gtin.ts';
import type { Source } from '../source.ts';
import type { Mailer } from './mailer.ts';

export interface AlertDeps {
  sql: postgres.Sql;
  config: Pick<AppConfig, 'publicBaseUrl' | 'redirectBaseUrl' | 'siteName'>;
  mailer: Mailer;
}

export interface AlertRequest {
  ean: string;
  country: Country;
  email: string;
  targetPrice: number;
  source: Source;
}

export type CreateAlertResult =
  | { ok: true }
  | { ok: false; field: 'email' | 'target' | 'product'; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_TARGET = 1_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Na tú istú adresu a produkt nepošleme ďalší e-mail skôr než po tomto čase. */
const EMAIL_COOLDOWN = '15 minutes';
const PENDING_RETENTION = '7 days';
const FINISHED_RETENTION = '30 days';

/** Produkt, ktorý sa dá strážiť, a jeho aktuálna cena v danej krajine (ak ju poznáme). */
export async function findAlertProduct(
  sql: postgres.Sql,
  rawEan: string,
  country: Country,
): Promise<{ id: string; name: string; ean: string; currentMin: number | null; currency: Currency } | null> {
  const ean = normalizeEan(rawEan);
  if (!ean) return null;
  const [row] = await sql<{ id: string; name: string; current_min: number | null }[]>`
    SELECT p.id, p.name, st.current_min::float8 AS current_min
    FROM product_eans pe
    JOIN products p ON p.id = pe.product_id
    LEFT JOIN product_price_stats st ON st.product_id = p.id AND st.country = ${country}
    WHERE pe.ean = ${ean}`;
  if (!row) return null;
  return { id: row.id, name: row.name, ean, currentMin: row.current_min, currency: currencyOf(country) };
}

/**
 * Založí stráženie ceny alebo zmení cieľ existujúceho. Nové stráženie platí až
 * po potvrdení odkazom z e-mailu. Výsledok je pre všetky platné žiadosti
 * rovnaký, aby sa z neho nedalo zistiť, či daná adresa produkt už stráži.
 */
export async function createAlert(deps: AlertDeps, input: AlertRequest): Promise<CreateAlertResult> {
  const { sql, config, mailer } = deps;
  const email = input.email.trim();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL.test(email)) {
    return { ok: false, field: 'email', message: 'Zadajte platnú e-mailovú adresu.' };
  }
  const target = Math.round(input.targetPrice * 100) / 100;
  if (!Number.isFinite(target) || target <= 0 || target > MAX_TARGET) {
    return { ok: false, field: 'target', message: 'Zadajte cieľovú cenu ako kladné číslo.' };
  }
  const product = await findAlertProduct(sql, input.ean, input.country);
  if (!product) return { ok: false, field: 'product', message: 'Tento produkt nepoznáme.' };
  if (product.currentMin !== null && target >= product.currentMin) {
    return {
      ok: false,
      field: 'target',
      message:
        `Produkt už teraz stojí ${formatPrice(product.currentMin, product.currency)}. ` +
        'Zadajte nižšiu cenu, pri ktorej vám máme dať vedieť.',
    };
  }

  // E-mail sa posiela v transakcii: keď odoslanie zlyhá, nevznikne stráženie,
  // o ktorom by používateľ nevedel.
  await sql.begin(async (tx) => {
    const [created] = await tx<{ token: string }[]>`
      INSERT INTO price_alerts (product_id, country, email, target_price, source, last_email_at)
      VALUES (${product.id}, ${input.country}, ${email}, ${target}, ${input.source}, now())
      ON CONFLICT (product_id, country, email) DO NOTHING
      RETURNING token`;

    let token = created?.token;
    let wasActive = false;
    if (!token) {
      const [existing] = await tx<{ id: string; token: string; status: string; recently_mailed: boolean }[]>`
        SELECT id, token, status,
               COALESCE(last_email_at > now() - ${EMAIL_COOLDOWN}::interval, false) AS recently_mailed
        FROM price_alerts
        WHERE product_id = ${product.id} AND country = ${input.country} AND email = ${email}
        FOR UPDATE`;
      if (!existing) throw new Error('Stráženie zmizlo počas spracovania žiadosti.');
      wasActive = existing.status === 'active';
      await tx`
        UPDATE price_alerts SET
          target_price = ${target}, updated_at = now(),
          status = ${wasActive ? 'active' : 'pending'},
          confirmed_at = ${wasActive ? tx`confirmed_at` : null},
          triggered_at = NULL,
          last_email_at = ${existing.recently_mailed ? tx`last_email_at` : tx`now()`}
        WHERE id = ${existing.id}`;
      if (existing.recently_mailed) return;
      token = existing.token;
    }

    const targetText = formatPrice(target, product.currency);
    const cancelUrl = `${config.publicBaseUrl}/alert/odhlasit?token=${token}`;
    await mailer.send(
      wasActive
        ? {
            to: email,
            subject: `Zmena stráženia ceny: ${product.name}`,
            text:
              `Dobrý deň,\n\ncieľová cena vášho stráženia produktu ${product.name} je teraz ${targetText}.\n\n` +
              `Ak ste zmenu neurobili vy, stráženie môžete zrušiť:\n${cancelUrl}\n\n${config.siteName}\n`,
          }
        : {
            to: email,
            subject: `Potvrďte stráženie ceny: ${product.name}`,
            text:
              `Dobrý deň,\n\npožiadali ste o stráženie ceny produktu ${product.name}. Dáme vám vedieť, ` +
              `keď cena klesne na ${targetText} alebo nižšie.\n\n` +
              `Stráženie potvrďte kliknutím na odkaz:\n${config.publicBaseUrl}/alert/potvrdit?token=${token}\n\n` +
              'Ak ste o stráženie nežiadali, tento e-mail ignorujte. Bez potvrdenia vám nič ďalšie ' +
              `nepošleme a adresu do 7 dní zmažeme.\n\nZrušenie stráženia:\n${cancelUrl}\n\n${config.siteName}\n`,
          },
    );
  });
  return { ok: true };
}

/** Potvrdí stráženie odkazom z e-mailu. Pre neplatný alebo už ukončený odkaz vráti `null`. */
export async function confirmAlert(
  sql: postgres.Sql,
  token: string,
): Promise<{ productName: string; targetPrice: number; currency: Currency } | null> {
  if (!UUID.test(token)) return null;
  const [row] = await sql<{ name: string; target_price: number; country: Country }[]>`
    WITH up AS (
      UPDATE price_alerts
      SET status = 'active', confirmed_at = COALESCE(confirmed_at, now()), updated_at = now()
      WHERE token = ${token} AND status IN ('pending', 'active')
      RETURNING product_id, country, target_price
    )
    SELECT p.name, up.target_price::float8 AS target_price, up.country
    FROM up JOIN products p ON p.id = up.product_id`;
  if (!row) return null;
  return { productName: row.name, targetPrice: row.target_price, currency: currencyOf(row.country) };
}

/** Odhlási stráženie. Vráti `false`, ak odkaz nepatrí žiadnemu stráženiu. */
export async function cancelAlert(sql: postgres.Sql, token: string): Promise<boolean> {
  if (!UUID.test(token)) return false;
  const rows = await sql`
    UPDATE price_alerts SET status = 'cancelled', updated_at = now() WHERE token = ${token} RETURNING id`;
  return rows.length > 0;
}

/**
 * Pošle e-mail všetkým potvrdeným stráženiam, ktorých cieľ cena dosiahla.
 * Spúšťa sa po prepočte štatistík. Stráženie je jednorazové; pri zlyhaní
 * odoslania ostáva aktívne a skúsi sa pri ďalšom behu.
 */
export async function triggerAlerts(deps: AlertDeps): Promise<{ sent: number; failed: number }> {
  const { sql, config, mailer } = deps;
  const due = await sql<
    {
      id: string;
      email: string;
      country: Country;
      target_price: number;
      name: string;
      ean: string;
      current_min: number;
      offer_id: string;
      shop_name: string;
      in_stock: boolean;
    }[]
  >`
    SELECT a.id, a.email, a.country, a.target_price::float8 AS target_price, p.name,
           (SELECT min(ean) FROM product_eans pe WHERE pe.product_id = p.id) AS ean,
           st.current_min::float8 AS current_min, o.offer_id, o.shop_name, o.in_stock
    FROM price_alerts a
    JOIN products p ON p.id = a.product_id
    JOIN product_price_stats st ON st.product_id = a.product_id AND st.country = a.country
    JOIN LATERAL (
      SELECT o.id AS offer_id, s.name AS shop_name, COALESCE(o.delivery_days = 0, false) AS in_stock
      FROM offers o JOIN shops s ON s.id = o.shop_id
      WHERE o.product_id = a.product_id AND o.is_active AND s.is_active AND s.country = a.country
      ORDER BY COALESCE(o.delivery_days = 0, false) DESC, o.price, o.id
      LIMIT 1
    ) o ON true
    WHERE a.status = 'active' AND st.current_min <= a.target_price
    ORDER BY a.created_at`;

  let sent = 0;
  let failed = 0;
  for (const alert of due) {
    const currency = currencyOf(alert.country);
    const price = formatPrice(alert.current_min, currency);
    try {
      await mailer.send({
        to: alert.email,
        subject: `${alert.name} teraz za ${price}`,
        text:
          `Dobrý deň,\n\ncena produktu ${alert.name} klesla na ${price}. Vaša cieľová cena bola ` +
          `${formatPrice(alert.target_price, currency)}.\n\n` +
          `Najlacnejšia ponuka: ${alert.shop_name}${alert.in_stock ? ', skladom' : ''}\n` +
          `${config.redirectBaseUrl}/redirect?offer_id=${alert.offer_id}&source=email&alert_id=${alert.id}\n\n` +
          'Odkaz je partnerský: ak cez neho nakúpite, môžeme od obchodu získať províziu. Cenu pre vás ' +
          'to nemení. Ceny sa menia, aktuálnu si overte v obchode.\n\n' +
          'Týmto e-mailom sa stráženie skončilo. Nové si nastavíte tu:\n' +
          `${config.publicBaseUrl}/alert?ean=${alert.ean}&country=${alert.country}\n\n${config.siteName}\n`,
      });
      await sql`
        UPDATE price_alerts SET status = 'triggered', triggered_at = now(), updated_at = now()
        WHERE id = ${alert.id} AND status = 'active'`;
      sent++;
    } catch (error) {
      failed++;
      console.error(`Stráženie ${alert.id}: e-mail sa nepodarilo odoslať:`, error);
    }
  }
  return { sent, failed };
}

/** Zmaže e-maily, ktoré už nepotrebujeme: nepotvrdené a dávno ukončené stráženia. */
export async function purgeAlerts(sql: postgres.Sql): Promise<number> {
  const rows = await sql`
    DELETE FROM price_alerts
    WHERE (status = 'pending' AND updated_at < now() - ${PENDING_RETENTION}::interval)
       OR (status IN ('cancelled', 'triggered') AND updated_at < now() - ${FINISHED_RETENTION}::interval)
    RETURNING id`;
  return rows.length;
}
