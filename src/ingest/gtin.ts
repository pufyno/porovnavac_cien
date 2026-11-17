const SUPPORTED_LENGTHS = new Set([8, 12, 13, 14]);

function hasValidCheckDigit(digits: string): boolean {
  let sum = 0;
  // Váhy 3,1,3,1… sprava, kontrolná číslica (posledná) sa nezapočítava.
  for (let i = digits.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) {
    sum += Number(digits[i]) * weight;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

/**
 * Vráti EAN v jednotnom tvare, alebo null, ak kód nie je platný GTIN.
 * UPC-12 a GTIN-14 s úvodnou nulou sa prevedú na EAN-13, aby sa rovnaký
 * produkt z rôznych feedov spároval pod jedným kódom.
 */
export function normalizeEan(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits) || !SUPPORTED_LENGTHS.has(digits.length)) return null;
  if (/^0+$/.test(digits) || !hasValidCheckDigit(digits)) return null;
  if (digits.length === 12) return `0${digits}`;
  if (digits.length === 14 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}
