# Porovnávač cien

Služba, ktorá AI asistentom (ChatGPT, Claude, Gemini) dodáva živé ceny
elektroniky zo slovenských a českých e-shopov: porovnanie ponúk, históriu
cien, upozornenie na zdanlivé zľavy a odporúčanie, či kúpiť teraz.

„Porovnávač cien“ je pracovný názov.

## Stav

Funkčný prototyp všetkých štyroch modulov (import feedov, rozhranie pre AI
cez MCP a REST, merané prekliky, web so strážením ceny) nad vzorovými dátami.
Reálne feedy, doména ani odosielanie e-mailov zatiaľ nie sú.

## Vyskúšanie

```
pnpm install
pnpm demo
```

Ukážka beží na <http://localhost:3000> bez databázy a bez Dockeru. Skúste
vyhľadať `roborock s8 pro ultra`. Ďalšie príkazy: `pnpm test`,
`pnpm typecheck`, `pnpm bench`.

## Dokumentácia

- [`docs/projekt.md`](docs/projekt.md) – čo staviame a prečo, moduly, rozhodnutia, riziká
- [`docs/plan.md`](docs/plan.md) – aktuálny stav, fázy a časová os
- [`docs/prieskum.md`](docs/prieskum.md) – AI platformy, affiliate siete a konkurencia, so zdrojmi
- [`docs/prevadzka.md`](docs/prevadzka.md) – spustenie, nasadenie, pridanie e-shopu

## Vývoj s Claude Code

`.claude/settings.json` zapína na úrovni projektu tieto pluginy:

| Plugin | Marketplace | Zdroj |
| --- | --- | --- |
| `superpowers` | `claude-plugins-official` | [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) |
| `mattpocock-skills` | `mattpocock` | [mattpocock/skills](https://github.com/mattpocock/skills) |

Po čerstvom klonovaní je potrebné Claude Code reštartovať, aby sa pluginy
načítali. Ručná inštalácia:

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin install superpowers@claude-plugins-official

/plugin marketplace add mattpocock/skills
/plugin install mattpocock-skills@mattpocock
```
