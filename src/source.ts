/** Odkiaľ preklik alebo dopyt prišiel. Do odkazov a logov sa dostane len hodnota z tohto zoznamu. */
export const SOURCES = ['chatgpt', 'claude', 'gemini', 'mcp', 'api', 'web', 'email'] as const;
export type Source = (typeof SOURCES)[number] | 'unknown';

export function normalizeSource(raw: string | undefined | null): Source {
  const value = raw?.trim().toLowerCase();
  return (SOURCES as readonly string[]).includes(value ?? '') ? (value as Source) : 'unknown';
}
