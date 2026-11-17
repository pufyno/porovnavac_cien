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
