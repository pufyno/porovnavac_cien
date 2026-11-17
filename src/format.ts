const SYMBOLS: Record<string, string> = { EUR: '€', CZK: 'Kč' };

/** „489 €“, „489,90 €“, „12 990 Kč“. */
export function formatPrice(value: number, currency: string): string {
  const rounded = Math.round(value * 100) / 100;
  const [int = '0', frac] = rounded.toFixed(Number.isInteger(rounded) ? 0 : 2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped}${frac ? `,${frac}` : ''} ${SYMBOLS[currency] ?? currency}`;
}

/** „1 deň“, „3 dni“, „7 dní“. */
export function formatDays(days: number): string {
  if (days === 1) return '1 deň';
  if (days >= 2 && days <= 4) return `${days} dni`;
  return `${days} dní`;
}

/** „1 obchod“, „3 obchody“, „7 obchodov“. */
export function formatShops(count: number): string {
  if (count === 1) return '1 obchod';
  if (count >= 2 && count <= 4) return `${count} obchody`;
  return `${count} obchodov`;
}
