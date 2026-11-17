export interface Candidate {
  id: string;
  name: string;
  /** Názov bez diakritiky malými písmenami (stĺpec products.search_text). */
  searchText: string;
  /** Trigramová podobnosť dopytu s názvom, 0 až 1. */
  wordSim: number;
}

export type MatchResult =
  | { kind: 'match'; candidate: Candidate }
  /** `exact: false` znamená, že žiadny kandidát nesedí číslom modelu; sú to len podobné produkty. */
  | { kind: 'ambiguous'; exact: boolean; candidates: Candidate[] }
  | { kind: 'none' };

/** Kandidát s podobnosťou do tejto vzdialenosti od najlepšieho sa berie ako rovnocenný. */
const RIVAL_MARGIN = 0.15;
/** Pod touto podobnosťou nie je ani najlepší kandidát istá zhoda. */
const MIN_CONFIDENT_SIM = 0.45;
const MAX_CANDIDATES = 5;

/** Čísla v texte vrátane tých v označeniach modelov: „s24 256gb“ → ["24", "256"]. */
export function numericTokens(text: string): string[] {
  return text.match(/\d+/g) ?? [];
}

/**
 * Z kandidátov nájdených podľa podobnosti názvu vyberie jednoznačnú zhodu.
 * Trigramová podobnosť sama nerozlíši „iPhone 15“ od „iPhone 14“, preto musí
 * každé číslo z dopytu byť aj v názve produktu.
 */
export function pickMatch(query: string, candidates: Candidate[]): MatchResult {
  if (candidates.length === 0) return { kind: 'none' };
  const sorted = [...candidates].sort((a, b) => b.wordSim - a.wordSim);

  const required = numericTokens(query);
  const matching = sorted.filter((c) => {
    const present = new Set(numericTokens(c.searchText));
    return required.every((n) => present.has(n));
  });
  if (matching.length === 0) {
    return { kind: 'ambiguous', exact: false, candidates: sorted.slice(0, MAX_CANDIDATES) };
  }

  const best = matching[0]!;
  if (best.wordSim < MIN_CONFIDENT_SIM) {
    return { kind: 'ambiguous', exact: false, candidates: matching.slice(0, MAX_CANDIDATES) };
  }
  const rivals = matching.filter((c) => c.wordSim >= best.wordSim - RIVAL_MARGIN);
  if (rivals.length === 1) return { kind: 'match', candidate: best };
  return { kind: 'ambiguous', exact: true, candidates: rivals.slice(0, MAX_CANDIDATES) };
}
