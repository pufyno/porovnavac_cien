import { describe, expect, it } from 'vitest';
import { addDays, diffDays } from '../src/dates.ts';
import { formatDate, formatPrice, formatShops } from '../src/format.ts';

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

describe('formatShops', () => {
  it('skloňuje podľa počtu', () => {
    expect([1, 2, 4, 5, 12].map(formatShops)).toEqual(['1 obchod', '2 obchody', '4 obchody', '5 obchodov', '12 obchodov']);
  });
});

describe('formatDate', () => {
  it('píše dátum po slovensky bez núl na začiatku', () => {
    expect(formatDate('2026-08-09')).toBe('9. 8. 2026');
  });
});
