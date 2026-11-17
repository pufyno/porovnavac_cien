import { html } from 'hono/html';
import type { Currency } from '../currency.ts';
import { diffDays } from '../dates.ts';
import { formatDate, formatPrice } from '../format.ts';
import type { HistoryPoint } from '../stats/history.ts';
import type { Html } from './layout.ts';

/*
 * Graf sa roztiahne na šírku karty, výška a písmo ostávajú v pixeloch.
 * Čiara a plocha sú vo vnorenom SVG s preserveAspectRatio="none" (mení sa len
 * šírka, hrúbku čiary drží vector-effect), popisky a pomocné čiary sú vo
 * vonkajšom SVG, ktorého jednotky sú pixely. Na mobile tak písmo nezmenší.
 */
const HEIGHT = 212;
/** Šírka vnoreného SVG v jeho vlastných jednotkách. */
const INNER_WIDTH = 1000;
/** Výška úrovne najvyššej a najnižšej ceny a spodok plochy pod čiarou. */
const TOP = 34;
const BOTTOM = 150;
const BASE = 186;

const round = (n: number) => Math.round(n * 10) / 10;

function spanDays(points: HistoryPoint[]): number {
  const first = points[0];
  const last = points.at(-1);
  return first && last ? diffDays(first.from, last.to) : 0;
}

/** Nadpis podľa dní, ktoré graf naozaj ukazuje. Graf sa kreslí až od dvoch dní. */
export function historyTitle(points: HistoryPoint[]): string {
  const days = spanDays(points);
  return days <= 4
    ? `Vývoj najnižšej ceny za posledné ${days} dni`
    : `Vývoj najnižšej ceny za posledných ${days} dní`;
}

/** Schodový graf najnižšej ceny. Bez aspoň dvoch dní histórie vráti `null`. */
export function historyChart(points: HistoryPoint[], currency: Currency): Html | null {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const totalDays = spanDays(points);
  if (totalDays < 2) return null;

  const prices = points.map((p) => p.price);
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const flat = max === min;
  const x = (date: string) => round((diffDays(first.from, date) / totalDays) * INNER_WIDTH);
  const y = (price: number) =>
    round(flat ? (TOP + BOTTOM) / 2 : TOP + ((max - price) / (max - min)) * (BOTTOM - TOP));
  const price = (value: number) => formatPrice(value, currency);

  let line = `M${x(first.from)} ${y(first.price)} H${x(first.to)}`;
  for (const point of points.slice(1)) line += ` V${y(point.price)} H${x(point.to)}`;

  return html`<svg class="chart" width="100%" height="${HEIGHT}" role="img"
    aria-label="Vývoj najnižšej ceny od ${formatDate(first.from)}: najvyššia ${price(max)}, najnižšia ${price(min)}, teraz ${price(last.price)}.">
    <svg width="100%" height="${HEIGHT}" viewBox="0 0 ${INNER_WIDTH} ${HEIGHT}" preserveAspectRatio="none" overflow="visible">
      <path class="chart-area" d="${line} V${BASE} H0 Z" />
      <path class="chart-line" d="${line}" vector-effect="non-scaling-stroke" />
    </svg>
    <line class="chart-base" x1="0" x2="100%" y1="${BASE}" y2="${BASE}" />
    ${flat
      ? ''
      : html`<line class="chart-ref" x1="0" x2="100%" y1="${TOP}" y2="${TOP}" />
          <line class="chart-ref" x1="0" x2="100%" y1="${BOTTOM}" y2="${BOTTOM}" />
          <text class="chart-min" x="0" y="${BOTTOM + 19}">${price(min)}</text>`}
    <text class="chart-max" x="0" y="${y(max) - 9}">${price(max)}</text>
    <circle class="chart-dot" cx="100%" cy="${y(last.price)}" r="6" />
    <text x="0" y="${HEIGHT - 6}">${formatDate(first.from)}</text>
    <text x="100%" y="${HEIGHT - 6}" text-anchor="end">dnes</text>
  </svg>`;
}
