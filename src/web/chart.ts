import { html } from 'hono/html';
import type { Currency } from '../currency.ts';
import { diffDays } from '../dates.ts';
import { formatDate, formatPrice } from '../format.ts';
import type { HistoryPoint } from '../stats/history.ts';
import type { Html } from './layout.ts';

const WIDTH = 640;
const HEIGHT = 180;
const PAD = { top: 26, right: 8, bottom: 26, left: 8 };

const round = (n: number) => Math.round(n * 10) / 10;

/** Schodový graf najnižšej ceny. Bez aspoň dvoch dní histórie vráti `null`. */
export function historyChart(points: HistoryPoint[], currency: Currency): Html | null {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const totalDays = diffDays(first.from, last.to);
  if (totalDays < 2) return null;

  const prices = points.map((p) => p.price);
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (date: string) => round(PAD.left + (diffDays(first.from, date) / totalDays) * plotW);
  const y = (price: number) => round(PAD.top + (max === min ? 0.5 : (max - price) / (max - min)) * plotH);

  let path = `M${x(first.from)} ${y(first.price)} H${x(first.to)}`;
  for (const point of points.slice(1)) path += ` V${y(point.price)} H${x(point.to)}`;

  return html`<svg viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" style="width:100%;height:auto;max-width:${WIDTH}px"
    aria-label="Graf: najvyššia cena ${formatPrice(max, currency)}, najnižšia ${formatPrice(min, currency)}">
    <line x1="${PAD.left}" x2="${WIDTH - PAD.right}" y1="${HEIGHT - PAD.bottom}" y2="${HEIGHT - PAD.bottom}" stroke="#dfe3e8" />
    <path d="${path}" fill="none" stroke="#1a5fb4" stroke-width="2.5" stroke-linejoin="round" />
    <text x="${PAD.left}" y="16" font-size="13" fill="#5f6670">
      ${max === min ? formatPrice(max, currency) : `${formatPrice(min, currency)} až ${formatPrice(max, currency)}`}
    </text>
    <text x="${PAD.left}" y="${HEIGHT - 8}" font-size="13" fill="#5f6670">${formatDate(first.from)}</text>
    <text x="${WIDTH - PAD.right}" y="${HEIGHT - 8}" font-size="13" fill="#5f6670" text-anchor="end">dnes</text>
  </svg>`;
}
