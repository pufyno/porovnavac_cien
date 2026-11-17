import { describe, expect, it } from 'vitest';
import { decideVerdict } from '../../src/compare/verdict.ts';

const base = { currentMin: 489, avg30d: 520, avg90d: 545, min90d: 489, historyDays: 90, currency: 'EUR' };

describe('decideVerdict', () => {
  it('pri krátkej histórii neradí a povie prečo', () => {
    expect(decideVerdict({ ...base, historyDays: 5 })).toEqual({
      verdict: 'INSUFFICIENT_DATA',
      reason: 'Cenu sledujeme len 5 dní, na posúdenie výhodnosti je to zatiaľ málo.',
    });
  });

  it('jeden deň histórie skloňuje správne', () => {
    expect(decideVerdict({ ...base, historyDays: 1 }).reason).toContain('len 1 deň,');
  });

  it('cena výrazne pod 90-dňovým priemerom a zároveň najnižšia znamená kúpiť', () => {
    expect(decideVerdict(base)).toEqual({
      verdict: 'BUY_NOW',
      reason: 'Aktuálna cena je o 56 € pod 90-dňovým priemerom a je najnižšia za posledných 90 dní.',
    });
  });

  it('pri kúpe nespomenie najnižšiu cenu, ak už bola nižšia', () => {
    expect(decideVerdict({ ...base, min90d: 470 }).reason).toBe('Aktuálna cena je o 56 € pod 90-dňovým priemerom.');
  });

  it('cena výrazne nad priemerom znamená počkať', () => {
    expect(decideVerdict({ ...base, currentMin: 600, min90d: 489 })).toEqual({
      verdict: 'WAIT',
      reason: 'Aktuálna cena je o 55 € nad 90-dňovým priemerom. Oplatí sa počkať alebo si nastaviť stráženie ceny.',
    });
  });

  it('cena blízko priemeru je bežná cena', () => {
    expect(decideVerdict({ ...base, currentMin: 550 })).toEqual({
      verdict: 'FAIR_PRICE',
      reason: 'Aktuálna cena je na úrovni 90-dňového priemeru (545 €).',
    });
  });

  it('presne 5 % pod priemerom už stačí na odporúčanie kúpiť', () => {
    expect(decideVerdict({ ...base, currentMin: 95, avg90d: 100, min90d: 90 }).verdict).toBe('BUY_NOW');
  });

  it('presne 5 % nad priemerom už znamená počkať', () => {
    expect(decideVerdict({ ...base, currentMin: 105, avg90d: 100, min90d: 90 }).verdict).toBe('WAIT');
  });

  it('pri histórii kratšej než 60 dní porovnáva s priemerom za sledované obdobie', () => {
    expect(decideVerdict({ ...base, historyDays: 30, avg30d: 520, min90d: 480 })).toEqual({
      verdict: 'BUY_NOW',
      reason: 'Aktuálna cena je o 31 € pod priemerom za posledných 30 dní.',
    });
  });

  it('pri histórii kratšej než 30 dní uvedie skutočný počet dní', () => {
    const { reason } = decideVerdict({ ...base, historyDays: 20, avg30d: 520, min90d: 489 });

    expect(reason).toBe('Aktuálna cena je o 31 € pod priemerom za posledných 20 dní a je najnižšia za posledných 20 dní.');
  });
});
