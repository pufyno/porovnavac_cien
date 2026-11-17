import { formatDays, formatPrice } from '../format.ts';

export type Verdict = 'BUY_NOW' | 'FAIR_PRICE' | 'WAIT' | 'INSUFFICIENT_DATA';

export interface PriceStats {
  currentMin: number;
  avg30d: number | null;
  avg90d: number | null;
  min90d: number | null;
  /** Koľko dní z posledných 90 cenu naozaj sledujeme. */
  historyDays: number;
  currency: string;
}

/** Pod touto dĺžkou histórie verdikt nevydávame. */
const MIN_HISTORY_DAYS = 14;
/** Od tejto dĺžky histórie sa porovnáva s 90-dňovým priemerom, inak s kratším. */
const LONG_HISTORY_DAYS = 60;
/** Odchýlka od priemeru, od ktorej je cena „výhodná“ alebo „vysoká“. */
const THRESHOLD = 0.05;

/**
 * Odporúčanie, či kúpiť teraz. Prahy sú prvý odhad a majú sa doladiť
 * na reálnych dátach.
 */
export function decideVerdict(stats: PriceStats): { verdict: Verdict; reason: string } {
  const { currentMin, historyDays, currency } = stats;
  const long = historyDays >= LONG_HISTORY_DAYS;
  const average = long ? stats.avg90d : stats.avg30d;

  if (historyDays < MIN_HISTORY_DAYS || average === null) {
    return {
      verdict: 'INSUFFICIENT_DATA',
      reason: `Cenu sledujeme len ${formatDays(historyDays)}, na posúdenie výhodnosti je to zatiaľ málo.`,
    };
  }

  const period = `posledných ${Math.min(historyDays, long ? 90 : 30)} dní`;
  const averageInstr = long ? '90-dňovým priemerom' : `priemerom za ${period}`;
  const averageGen = long ? '90-dňového priemeru' : `priemeru za ${period}`;
  const diff = formatPrice(Math.abs(currentMin - average), currency);
  const ratio = currentMin / average;

  if (ratio <= 1 - THRESHOLD) {
    const lowest = stats.min90d !== null && currentMin <= stats.min90d;
    const trackedPeriod = `posledných ${Math.min(historyDays, 90)} dní`;
    return {
      verdict: 'BUY_NOW',
      reason: `Aktuálna cena je o ${diff} pod ${averageInstr}${lowest ? ` a je najnižšia za ${trackedPeriod}` : ''}.`,
    };
  }
  if (ratio >= 1 + THRESHOLD) {
    return {
      verdict: 'WAIT',
      reason: `Aktuálna cena je o ${diff} nad ${averageInstr}. Oplatí sa počkať alebo si nastaviť stráženie ceny.`,
    };
  }
  return {
    verdict: 'FAIR_PRICE',
    reason: `Aktuálna cena je na úrovni ${averageGen} (${formatPrice(average, currency)}).`,
  };
}
