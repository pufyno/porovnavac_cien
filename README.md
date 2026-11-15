# Porovnávač cien

AI porovnávač cien elektroniky na internete. Podobný Heureke, ale efektívnejší
a dostupný priamo v ChatGPT chate.

## Cieľ

- Vyhľadať produkt (elektroniku) naprieč e-shopmi
- Porovnať ceny, dostupnosť a dopravu
- Odpovedať prirodzeným jazykom priamo v chate (ChatGPT)

## Stav

Hotový je návrh stacku a databázová schéma. Kód aplikácie zatiaľ neexistuje.

- **Popis projektu:** [`docs/projekt.md`](docs/projekt.md)
- **Plán, časová os a aktuálny stav:** [`docs/plan.md`](docs/plan.md)
- **Schéma databázy:** [`db/migrations/0001_init.sql`](db/migrations/0001_init.sql)

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
