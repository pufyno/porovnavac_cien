import { describe, expect, it } from 'vitest';
import { numericTokens, pickMatch, type Candidate } from '../../src/compare/match.ts';

const c = (name: string, wordSim: number): Candidate => ({ id: name, name, searchText: name.toLowerCase(), wordSim });

describe('numericTokens', () => {
  it('vytiahne čísla aj z označení modelov', () => {
    expect(numericTokens('galaxy s24 8gb/256gb')).toEqual(['24', '8', '256']);
    expect(numericTokens('sony wh-1000xm5')).toEqual(['1000', '5']);
  });

  it('text bez čísel nemá žiadne', () => {
    expect(numericTokens('robotický vysávač')).toEqual([]);
  });
});

describe('pickMatch', () => {
  it('bez kandidátov nenájde nič', () => {
    expect(pickMatch('dyson v15', [])).toEqual({ kind: 'none' });
  });

  it('jediný kandidát je zhoda', () => {
    const only = c('LG OLED55C4 55" 4K OLED TV', 0.61);

    expect(pickMatch('lg oled c4 55', [only])).toEqual({ kind: 'match', candidate: only });
  });

  it('slabo podobný kandidát nie je zhoda, len podobný produkt', () => {
    const weak = c('Xiaomi Robot Vacuum S10+', 0.35);

    expect(pickMatch('robotický vysávač', [weak])).toEqual({ kind: 'ambiguous', exact: false, candidates: [weak] });
  });

  it('jasne najlepší kandidát je zhoda', () => {
    const best = c('Roborock S8 Pro Ultra White', 1);

    expect(pickMatch('roborock s8 pro ultra', [best, c('Roborock S8 White', 0.55)])).toEqual({
      kind: 'match',
      candidate: best,
    });
  });

  it('viac rovnako dobrých kandidátov je nejednoznačnosť', () => {
    const white = c('Roborock S8 White', 1);
    const black = c('Roborock S8 Black', 1);
    const ultra = c('Roborock S8 Pro Ultra White', 1);

    expect(pickMatch('roborock s8', [white, black, ultra, c('Roborock S7 MaxV Ultra', 0.83)])).toEqual({
      kind: 'ambiguous',
      exact: true,
      candidates: [white, black, ultra],
    });
  });

  it('číslo modelu z dopytu musí sedieť: iPhone 15 nie je iPhone 14', () => {
    const i15 = c('Apple iPhone 15 128GB modrý', 1);

    expect(pickMatch('iphone 15', [i15, c('Apple iPhone 14 128GB polnočný', 0.8)])).toEqual({
      kind: 'match',
      candidate: i15,
    });
  });

  it('číslo v dopyte rozhodne aj medzi inak podobnými modelmi', () => {
    const xm5 = c('Sony WH-1000XM5 čierne', 0.56);

    expect(pickMatch('sony xm5', [xm5, c('Sony WH-1000XM4 čierne', 0.56)])).toEqual({ kind: 'match', candidate: xm5 });
  });

  it('keď číslo modelu nesedí pri žiadnom kandidátovi, ponúkne podobné ako nepresnú zhodu', () => {
    const similar = [c('Apple iPhone 15 128GB modrý', 0.8), c('Apple iPhone 14 128GB polnočný', 0.8)];

    expect(pickMatch('iphone 16', similar)).toEqual({ kind: 'ambiguous', exact: false, candidates: similar });
  });

  it('pri nejednoznačnosti vráti najviac 5 kandidátov', () => {
    const many = Array.from({ length: 8 }, (_, i) => c(`Roborock model ${i}`, 0.53));

    const result = pickMatch('vysavac roborock', many);

    expect(result.kind === 'ambiguous' && result.candidates).toHaveLength(5);
  });
});
