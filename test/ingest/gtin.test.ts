import { describe, expect, it } from 'vitest';
import { normalizeEan } from '../../src/ingest/gtin.ts';

describe('normalizeEan', () => {
  it('ponechá platný EAN-13', () => {
    expect(normalizeEan('6970995786842')).toBe('6970995786842');
  });

  it('odstráni medzery a pomlčky', () => {
    expect(normalizeEan(' 6970-9957 86842 ')).toBe('6970995786842');
  });

  it('odmietne nesprávnu kontrolnú číslicu', () => {
    expect(normalizeEan('6970995786843')).toBeNull();
  });

  it('odmietne samé nuly, aj keď majú formálne správny súčet', () => {
    expect(normalizeEan('0000000000000')).toBeNull();
  });

  it('odmietne nečíselný alebo prázdny vstup', () => {
    expect(normalizeEan('ABC123')).toBeNull();
    expect(normalizeEan('')).toBeNull();
    expect(normalizeEan(undefined)).toBeNull();
  });

  it('odmietne nepodporovanú dĺžku', () => {
    expect(normalizeEan('12345')).toBeNull();
  });

  it('UPC-12 doplní nulou na EAN-13, aby sa spároval s tým istým produktom', () => {
    expect(normalizeEan('036000291452')).toBe('0036000291452');
  });

  it('GTIN-14 s úvodnou nulou skráti na EAN-13', () => {
    expect(normalizeEan('06970995786842')).toBe('6970995786842');
  });

  it('ponechá platný EAN-8', () => {
    expect(normalizeEan('73513537')).toBe('73513537');
  });
});
