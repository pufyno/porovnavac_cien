export interface AppConfig {
  databaseUrl: string;
  port: number;
  /** Adresa webu bez lomky na konci, napr. https://domena.sk. */
  publicBaseUrl: string;
  /** Adresa, na ktorej beží /redirect. Môže byť rovnaká ako publicBaseUrl. */
  redirectBaseUrl: string;
  /** Názov služby v hlavičke webu a v e-mailoch. Finálny názov ešte nie je vybraný. */
  siteName: string;
}

function baseUrl(name: string, value: string): string {
  if (!/^https?:\/\/[^/]/.test(value)) throw new Error(`${name} musí byť adresa začínajúca http:// alebo https://.`);
  return value.replace(/\/+$/, '');
}

/** Načíta nastavenia z premenných prostredia. Pri chybe povie, ktorú premennú opraviť. */
export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Chýba DATABASE_URL (pripojenie na PostgreSQL).');

  const port = env.PORT === undefined ? 3000 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT musí byť číslo 1 až 65535.');

  const publicBaseUrl = baseUrl('PUBLIC_BASE_URL', env.PUBLIC_BASE_URL ?? `http://localhost:${port}`);
  return {
    databaseUrl,
    port,
    publicBaseUrl,
    redirectBaseUrl: baseUrl('REDIRECT_BASE_URL', env.REDIRECT_BASE_URL ?? publicBaseUrl),
    siteName: env.SITE_NAME ?? 'Porovnávač cien',
  };
}

/**
 * Pre migrácie a jednorazové skripty. Hostované databázy s poolerom (Neon)
 * dávajú popri `DATABASE_URL` aj priame pripojenie `DATABASE_URL_UNPOOLED`;
 * zmeny schémy majú ísť cezeň.
 */
export function withDirectDatabase(env: Record<string, string | undefined>): Record<string, string | undefined> {
  return env.DATABASE_URL_UNPOOLED ? { ...env, DATABASE_URL: env.DATABASE_URL_UNPOOLED } : env;
}
