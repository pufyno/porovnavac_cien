import type postgres from 'postgres';
import type { AppConfig } from './config.ts';

/** Čo aplikácia potrebuje zvonka. Testy sem dosadia vlastnú databázu. */
export interface AppDeps {
  sql: postgres.Sql;
  config: AppConfig;
}

export const UNAVAILABLE_INSTRUCTION =
  'Služba na porovnanie cien je dočasne nedostupná. Povedz to používateľovi, skús to neskôr ' +
  'a ceny neodhaduj z vlastných znalostí.';
