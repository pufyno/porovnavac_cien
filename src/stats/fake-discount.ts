import { diffDays } from '../dates.ts';
import { formatDays, formatPrice } from '../format.ts';

export interface PriceInterval {
  from: string;
  /** Exkluzívne; null = platí dodnes. */
  to: string | null;
  price: number;
}

/** Zľava staršia než toľkoto dní sa už neposudzuje. */
const MAX_DROP_AGE_DAYS = 30;
/** Zvýšená cena, ktorá platila dlhšie, sa berie ako skutočná cena, nie ako príprava na akciu. */
const MAX_PEAK_DAYS = 21;
/** O koľko musela cena pred „zľavou“ stúpnuť, aby šlo o podozrivé zdraženie. */
const MIN_HIKE_RATIO = 1.08;
/** Ak je nová cena aspoň o toľko nižšia než cena pred zdražením, zľavu považujeme za skutočnú. */
const REAL_DISCOUNT_RATIO = 0.97;

/**
 * Rozpozná vzor „zdraženie tesne pred akciou“: cena krátko stúpla a potom
 * „klesla“ približne tam, kde bola predtým. Vychádza len z vlastnej histórie
 * cien, lebo feedy pôvodnú (prečiarknutú) cenu neuvádzajú.
 *
 * `intervals` sú zoradené od najstaršieho, posledný je aktuálne platná cena.
 */
export function detectFakeDiscount(
  intervals: PriceInterval[],
  opts: { today: string; currency: string },
): { detail: string } | null {
  const current = intervals.at(-1);
  const peak = intervals.at(-2);
  const before = intervals.at(-3);
  if (!current || !peak || !before || current.to !== null) return null;
  // Intervaly musia na seba nadväzovať; medzera znamená, že ponuka nebola v predaji.
  if (peak.to !== current.from || before.to !== peak.from) return null;

  if (diffDays(current.from, opts.today) > MAX_DROP_AGE_DAYS) return null;
  if (current.price >= peak.price) return null;
  const peakDays = diffDays(peak.from, current.from);
  if (peakDays > MAX_PEAK_DAYS) return null;
  if (peak.price < before.price * MIN_HIKE_RATIO) return null;
  if (current.price < before.price * REAL_DISCOUNT_RATIO) return null;

  const price = (v: number) => formatPrice(v, opts.currency);
  const advertised = Math.round(((peak.price - current.price) / peak.price) * 100);
  let comparison: string;
  if (current.price > before.price) {
    comparison = `oproti cene pred zdražením je produkt o ${price(current.price - before.price)} drahší.`;
  } else if (current.price === before.price) {
    comparison = 'oproti cene pred zdražením je cena rovnaká.';
  } else {
    const real = Math.round(((before.price - current.price) / before.price) * 100);
    comparison = `skutočná zľava oproti cene pred zdražením je ${real === 0 ? 'menej než 1' : real} %.`;
  }

  return {
    detail:
      `Cena bola ${price(before.price)}, potom na ${formatDays(peakDays)} stúpla na ${price(peak.price)} ` +
      `a teraz je ${price(current.price)}. ` +
      `Zľava ${advertised} % sa počíta z krátkodobo navýšenej ceny; ${comparison}`,
  };
}
