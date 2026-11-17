# Zdroje obrázkov značky

Smer vizuálu A „Radar“ (pozri `docs/projekt.md`, kapitola 4).

| Súbor | Na čo je |
|---|---|
| `../public/favicon.svg` | Logo: radar s bodom. Ikona v prehliadači a zdroj ICO 32 px. |
| `favicon-16.svg` | Logo zjednodušené pre 16 px: hrubší okraj, bez vnútorného kruhu. |
| `apple-touch-icon.svg` | Ikona pre iOS 180 × 180, nepriehľadné pozadie (rohy zaobľuje systém). |
| `og-image.svg` | Obrázok na zdieľanie (`og:image`) 1200 × 630. |
| `vykreslit-obrazky.mjs` | Vykreslí `public/og.png`, `public/apple-touch-icon.png` a `public/favicon.ico`. |

## Ako obrázky vykresliť znova

1. V prázdnom priečinku mimo repozitára: `npm i @resvg/resvg-js@2.6.2`.
2. Do iného prázdneho priečinka stiahnite statické TTF z Fontsource 5.3.0:
   `https://cdn.jsdelivr.net/fontsource/fonts/<písmo>@5.3.0/<sada>-<váha>-normal.ttf`
   pre `space-grotesk` (váhy 600 a 700) a `inter` (400 a 600), sady `latin`
   a `latin-ext`.
3. Z koreňa repozitára:
   `node design/vykreslit-obrazky.mjs <priečinok s resvg> <priečinok s TTF>`.
4. Výsledok si prezrite. Nadpis musí byť v Space Grotesk: statické TTF majú
   v tabuľke mien rodinu „Space Grotesk Light“, skript ju pri vykresľovaní
   dosadí sám.

Písma Space Grotesk a Inter sú pod licenciou SIL Open Font License 1.1
(texty licencií sú v `public/fonts`).
