/** Údaje o prevádzkovateľovi, ktoré musí web uvádzať (§ 4 zákona č. 22/2004 Z. z.). */
export interface OperatorInfo {
  /** Meno a priezvisko; pri firme obchodné meno. */
  name?: string;
  /** Adresa bydliska; pri firme sídlo. */
  address?: string;
  email?: string;
  phone?: string;
  /** IČO, register a číslo zápisu, IČ DPH; len ak sú. */
  registration?: string;
}

export interface AppConfig {
  databaseUrl: string;
  port: number;
  /** Adresa webu bez lomky na konci, napr. https://domena.sk. */
  publicBaseUrl: string;
  /** Adresa, na ktorej beží /redirect. Môže byť rovnaká ako publicBaseUrl. */
  redirectBaseUrl: string;
  /** Názov služby v hlavičke webu a v e-mailoch. */
  siteName: string;
  /** Prevádzkovateľ pre stránky o službe a ochrane súkromia. Chýbajúce údaje web označí na doplnenie. */
  operator: OperatorInfo;
}

const OPERATOR_ENV = {
  name: 'OPERATOR_NAME',
  address: 'OPERATOR_ADDRESS',
  email: 'OPERATOR_EMAIL',
  phone: 'OPERATOR_PHONE',
  registration: 'OPERATOR_REGISTRATION',
} as const satisfies Record<keyof OperatorInfo, string>;

function operatorInfo(env: Record<string, string | undefined>): OperatorInfo {
  const info: OperatorInfo = {};
  for (const [field, name] of Object.entries(OPERATOR_ENV) as [keyof OperatorInfo, string][]) {
    const value = env[name]?.trim();
    if (value) info[field] = value;
  }
  return info;
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
    siteName: env.SITE_NAME ?? 'Cenoradar',
    operator: operatorInfo(env),
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
