import { describe, expect, it } from 'vitest';
import { detectFakeDiscount, type PriceInterval } from '../../src/stats/fake-discount.ts';

const TODAY = '2026-11-17';
const check = (intervals: PriceInterval[]) => detectFakeDiscount(intervals, { today: TODAY, currency: 'EUR' });

describe('detectFakeDiscount', () => {
  it('označí krátke zdraženie nasledované „zľavou“ späť na pôvodnú cenu', () => {
    const result = check([
      { from: '2026-09-01', to: '2026-11-03', price: 515 },
      { from: '2026-11-03', to: '2026-11-10', price: 740 },
      { from: '2026-11-10', to: null, price: 519 },
    ]);

    expect(result).toEqual({
      detail:
        'Cena bola 515 €, potom na 7 dní stúpla na 740 € a teraz je 519 €. ' +
        'Zľava 30 % sa počíta z krátkodobo navýšenej ceny; oproti cene pred zdražením je produkt o 4 € drahší.',
    });
  });

  it('pri návrate presne na pôvodnú cenu uvedie, že cena je rovnaká', () => {
    const result = check([
      { from: '2026-09-01', to: '2026-11-03', price: 500 },
      { from: '2026-11-03', to: '2026-11-10', price: 600 },
      { from: '2026-11-10', to: null, price: 500 },
    ]);

    expect(result?.detail).toContain('oproti cene pred zdražením je cena rovnaká.');
  });

  it('pri malej skutočnej zľave uvedie jej veľkosť', () => {
    const result = check([
      { from: '2026-09-01', to: '2026-11-03', price: 500 },
      { from: '2026-11-03', to: '2026-11-10', price: 600 },
      { from: '2026-11-10', to: null, price: 490 },
    ]);

    expect(result?.detail).toContain('Zľava 18 % sa počíta');
    expect(result?.detail).toContain('skutočná zľava oproti cene pred zdražením je 2 %.');
  });

  it('priamu zľavu bez predošlého zdraženia neoznačí', () => {
    expect(
      check([
        { from: '2026-08-01', to: '2026-11-07', price: 545 },
        { from: '2026-11-07', to: null, price: 489 },
      ]),
    ).toBeNull();
  });

  it('neoznačí zľavu z ceny, ktorá platila dlho', () => {
    expect(
      check([
        { from: '2026-08-01', to: '2026-10-01', price: 515 },
        { from: '2026-10-01', to: '2026-11-10', price: 740 },
        { from: '2026-11-10', to: null, price: 519 },
      ]),
    ).toBeNull();
  });

  it('neoznačí, keď cena po zdražení klesla výrazne pod pôvodnú', () => {
    expect(
      check([
        { from: '2026-09-01', to: '2026-11-03', price: 500 },
        { from: '2026-11-03', to: '2026-11-10', price: 600 },
        { from: '2026-11-10', to: null, price: 450 },
      ]),
    ).toBeNull();
  });

  it('neoznačí zľavu staršiu než 30 dní', () => {
    expect(
      check([
        { from: '2026-06-01', to: '2026-09-01', price: 515 },
        { from: '2026-09-01', to: '2026-09-08', price: 740 },
        { from: '2026-09-08', to: null, price: 519 },
      ]),
    ).toBeNull();
  });

  it('neoznačí, kým zvýšená cena stále platí', () => {
    expect(
      check([
        { from: '2026-09-01', to: '2026-11-10', price: 515 },
        { from: '2026-11-10', to: null, price: 740 },
      ]),
    ).toBeNull();
  });

  it('neoznačí nepatrné zdraženie', () => {
    expect(
      check([
        { from: '2026-09-01', to: '2026-11-03', price: 500 },
        { from: '2026-11-03', to: '2026-11-10', price: 520 },
        { from: '2026-11-10', to: null, price: 500 },
      ]),
    ).toBeNull();
  });

  it('neoznačí, keď medzi intervalmi ponuka nebola v predaji', () => {
    expect(
      check([
        { from: '2026-09-01', to: '2026-10-20', price: 515 },
        { from: '2026-11-03', to: '2026-11-10', price: 740 },
        { from: '2026-11-10', to: null, price: 519 },
      ]),
    ).toBeNull();
  });

  it('ceny v korunách formátuje s Kč', () => {
    const result = detectFakeDiscount(
      [
        { from: '2026-09-01', to: '2026-11-03', price: 12990 },
        { from: '2026-11-03', to: '2026-11-10', price: 17990 },
        { from: '2026-11-10', to: null, price: 12990 },
      ],
      { today: TODAY, currency: 'CZK' },
    );

    expect(result?.detail).toContain('Cena bola 12 990 Kč, potom na 7 dní stúpla na 17 990 Kč');
  });
});
