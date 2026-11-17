import { describe, expect, it } from 'vitest';
import { historyChart, historyTitle } from '../src/web/chart.ts';

const S8_HISTORY = [
  { from: '2026-08-20', to: '2026-11-07', price: 545 },
  { from: '2026-11-07', to: '2026-11-18', price: 489 },
];

describe('historyChart', () => {
  it('nakreslí schodovú čiaru s najvyššou a najnižšou cenou', async () => {
    const svg = String(
      await historyChart(
        [
          { from: '2026-08-20', to: '2026-11-07', price: 545 },
          { from: '2026-11-07', to: '2026-11-18', price: 489 },
        ],
        'EUR',
      ),
    );

    expect(svg).toContain('<svg');
    expect(svg).toContain('545 €');
    expect(svg).toContain('489 €');
    expect(svg).toContain('20. 8. 2026');
    // Cena sa mení skokom: vodorovne, zvislo, vodorovne.
    expect(svg).toMatch(/d="M[\d.]+ [\d.]+ H[\d.]+ V[\d.]+ H[\d.]+"/);
  });

  it('ceny najvyššej a najnižšej úrovne sú viditeľné popisky', async () => {
    const svg = String(await historyChart(S8_HISTORY, 'EUR'));

    expect(svg).toMatch(/<text[^>]*>545 €<\/text>/);
    expect(svg).toMatch(/<text[^>]*>489 €<\/text>/);
  });

  it('má plochu pod čiarou, prerušované čiary minima a maxima a bod na konci', async () => {
    const svg = String(await historyChart(S8_HISTORY, 'EUR'));

    expect(svg).toMatch(/<path class="chart-area" d="M[^"]+Z"/);
    expect(svg.match(/class="chart-ref"/g)).toHaveLength(2);
    expect(svg).toContain('class="chart-dot"');
  });

  it.each([
    ['2026-08-20', 'Vývoj najnižšej ceny za posledných 90 dní'],
    ['2026-11-15', 'Vývoj najnižšej ceny za posledné 3 dni'],
  ])('nadpis grafu od %s počíta dni, ktoré graf ukazuje', (from, title) => {
    expect(historyTitle([{ from, to: '2026-11-18', price: 489 }])).toBe(title);
  });

  it('pri nemennej cene nakreslí rovnú čiaru', async () => {
    const svg = String(await historyChart([{ from: '2026-10-01', to: '2026-11-18', price: 699 }], 'EUR'));

    expect(svg).toMatch(/d="M[\d.]+ [\d.]+ H[\d.]+"/);
  });

  it.each([[[]], [[{ from: '2026-11-17', to: '2026-11-18', price: 489 }]]])(
    'bez aspoň dvoch dní histórie graf nekreslí',
    (points) => {
      expect(historyChart(points, 'EUR')).toBeNull();
    },
  );
});
