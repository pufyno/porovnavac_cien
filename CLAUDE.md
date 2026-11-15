# Porovnávač cien

Pred prácou si prečítaj:

- `docs/projekt.md` – čo staviame a prečo, moduly, technológie, rozhodnutia, riziká
- `docs/plan.md` – fázy, časová os a aktuálny stav (sekcia „Kde sme“)

## Pravidlá práce

- Postupujeme krok po kroku, jedna fáza naraz. Negeneruj kód pre ďalšie fázy dopredu.
- Po dokončenom kroku alebo novom rozhodnutí aktualizuj `docs/plan.md`: sekciu
  „Kde sme“, stav fázy a denník. Rozhodnutia a zmeny rozsahu zapíš aj do
  `docs/projekt.md`.
- Komunikácia aj dokumentácia sú po slovensky, stručne a technicky presne.
- Zmeny databázy idú ako nové migrácie v `db/migrations/` a testujú sa na
  PostgreSQL 17.
