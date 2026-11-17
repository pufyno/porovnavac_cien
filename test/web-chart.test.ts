import { describe, expect, it } from 'vitest';
import { historyChart } from '../src/web/chart.ts';

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
