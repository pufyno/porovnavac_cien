// Dátumy sa v celej aplikácii prenášajú ako reťazce YYYY-MM-DD (deň importu, nie okamih).
const DAY_MS = 86_400_000;

const toMs = (date: string) => Date.parse(`${date}T00:00:00Z`);

export function addDays(date: string, days: number): string {
  return new Date(toMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Počet dní od `from` do `to`; záporný, ak je `to` skôr. */
export function diffDays(from: string, to: string): number {
  return Math.round((toMs(to) - toMs(from)) / DAY_MS);
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
