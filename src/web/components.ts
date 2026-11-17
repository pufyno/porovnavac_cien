import { html } from 'hono/html';
import type { Country } from '../compare/schema.ts';
import { icon } from './icons.ts';
import type { Html } from './layout.ts';

/**
 * Vyhľadávanie. `full` je veľký formulár s výberom krajiny (úvod, stránka
 * hľadania), `compact` je v hlavičke a krajinu stránky nesie v skrytom poli.
 */
export function searchForm(query: string, country: Country, variant: 'full' | 'compact' = 'full'): Html {
  if (variant === 'compact') {
    return html`<form class="search-compact" action="/hladat" method="get" role="search">
      <input type="search" name="q" value="${query}" placeholder="Hľadať produkt alebo EAN"
        aria-label="Názov produktu alebo EAN" maxlength="200" required />
      <input type="hidden" name="country" value="${country}" />
      <button type="submit" class="button-accent" aria-label="Hľadať">${icon('search')}</button>
    </form>`;
  }
  return html`<form class="search-full" action="/hladat" method="get" role="search">
    <span class="search-icon">${icon('search', 22)}</span>
    <input type="search" name="q" value="${query}" placeholder="Napríklad Roborock S8 alebo EAN kód"
      aria-label="Názov produktu alebo EAN" maxlength="200" required />
    <select name="country" aria-label="Krajina">
      <option value="SK" ${country === 'SK' ? 'selected' : ''}>Slovensko</option>
      <option value="CZ" ${country === 'CZ' ? 'selected' : ''}>Česko</option>
    </select>
    <button type="submit" class="button-accent">Hľadať</button>
  </form>`;
}
