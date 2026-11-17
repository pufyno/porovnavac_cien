import type postgres from 'postgres';
import type { Mailer } from './alerts/mailer.ts';
import type { AppConfig } from './config.ts';

/** Čo aplikácia potrebuje zvonka. Testy sem dosadia vlastnú databázu. */
export interface AppDeps {
  sql: postgres.Sql;
  config: AppConfig;
  mailer: Mailer;
  /** Dnešný dátum ako YYYY-MM-DD. Testy ho fixujú. */
  today: () => string;
}

export const UNAVAILABLE_INSTRUCTION =
  'Služba na porovnanie cien je dočasne nedostupná. Povedz to používateľovi, skús to neskôr ' +
  'a ceny neodhaduj z vlastných znalostí.';
