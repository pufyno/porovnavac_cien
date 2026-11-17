export type Currency = 'EUR' | 'CZK';

/** Mena je daná krajinou e-shopu (poistka shops_currency_matches_country). */
export function currencyOf(country: 'SK' | 'CZ'): Currency {
  return country === 'SK' ? 'EUR' : 'CZK';
}
