import { describe, expect, it } from 'vitest';
import { addDays, diffDays } from '../src/dates.ts';
import { formatPrice } from '../src/format.ts';

describe('formatPrice', () => {
  it('celé sumy píše bez desatinných miest', () => {
    expect(formatPrice(489, 'EUR')).toBe('489 €');
  });

  it('necelé sumy píše s desatinnou čiarkou', () => {
    expect(formatPrice(489.9, 'EUR')).toBe('489,90 €');
  });

  it('tisíce oddeľuje medzerou', () => {
    expect(formatPrice(12990, 'CZK')).toBe('12 990 Kč');
    expect(formatPrice(1234567.5, 'EUR')).toBe('1 234 567,50 €');
  });
});

describe('dátumy', () => {
  it('addDays posúva dátum aj cez hranicu mesiaca a roka', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('diffDays vráti počet dní medzi dátumami', () => {
    expect(diffDays('2026-11-10', '2026-11-17')).toBe(7);
    expect(diffDays('2026-11-17', '2026-11-10')).toBe(-7);
  });
});
