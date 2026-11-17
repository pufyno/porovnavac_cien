# Vizuál A „Radar“ – plán implementácie

> **Pre agentov:** povinná podzručnosť superpowers:executing-plans (majiteľ
> chce vykonanie v jednej relácii, bez subagentov). Kroky sú zaškrtávacie
> (`- [ ]`).

**Cieľ:** Prepísať web Cenoradaru zo zámerne neutrálneho vzhľadu na smer A
„Radar“ podľa návrhu na plátne.

**Architektúra:** Web ostáva vykresľovaný na serveri cez `hono/html`, bez
JavaScriptu a cookies. Štýly sú jeden reťazec v `src/web/layout.ts`, ikony
a logo ako vložené SVG. Statické súbory (písma, favicon, OG obrázok) sú
v `public/`: na Verceli ich podáva CDN, na VPS trasa aplikácie so zoznamom
povolených súborov.

**Technológie:** TypeScript 6, Hono 4, vitest 5 s embedded-postgres 17,
písma Fontsource 5.3.0, obrázky vykreslené cez @resvg/resvg-js 2.6.2 (len
jednorazovo, nie závislosť projektu).

**Návrh:** [docs/projekt.md](../../projekt.md), kapitola 4 „Vizuál“.
Predloha: plátno <https://claude.ai/artifact/3JcfEyAZU2oFLn75mJ1QoF>, plochy
„A · Radar“.

## Globálne obmedzenia

- Farby: tmavomodrá `#0B1220`, plocha na tmavom `#131D33`, zvýraznenie
  `#35E0A1`, svetlé pozadie `#F3F6FA`, karty biele s okrajom `#DFE5EE`,
  tlmený text `#4E5B72`; dobrá cena `#0B7A55` na `#DDF6EC`, radšej počkať
  `#A1520B` na `#FDF0DF`, zdanlivá zľava `#8A1C12` na `#FDECEA`.
- Písma: Space Grotesk (nadpisy, ceny, logo), Inter (text); WOFF2
  z Fontsource 5.3.0, latinka a rozšírená latinka; licencia OFL vedľa súborov.
- Žiadny `<script>`, žiadne cookies, mobilné menu cez `<details>`.
- CSP doplniť o `font-src 'self'`, inak bez zmeny.
- Kontrast textu aspoň 4,5 : 1; význam nikdy len farbou (vždy text a ikona).
- Vykanie; žiadne vymyslené počty používateľov ani hodnotenia; Gemini sa na
  webe nespomína; ukážky na úvodnej stránke sú výslovne označené ako
  ilustračné a nevedú do obchodu.
- Sekcia „Ceny, ktoré sa pohli“ sa nerobí.
- Overenie: `pnpm test` a `pnpm typecheck` zelené; commity po slovensky.

## Na čo dať pozor pri kontrole

1. Najlacnejšia ponuka nie je skladom: karta verdiktu musí ukázať obchod
   s najnižšou cenou skladom a v zozname ho označiť „Najlacnejšie skladom“,
   nie „Najnižšia cena“ (test v Task 5).
2. Produkt bez dostatočnej histórie: dlaždice ukážu „nevieme“, verdikt
   „Zatiaľ málo údajov“, stránka nespadne (test v Task 5).
3. Česká stránka produktu: vyhľadávanie v hlavičke si ponechá krajinu CZ
   (test v Task 3).
4. Neznámy alebo podvrhnutý statický súbor (`/fonts/../package.json`,
   `/fonts/x.woff2`) vráti 404 a nič neprečíta mimo zoznamu (test v Task 1).
5. Na Verceli sa písma a obrázky nesmú dostať do funkcie, ktorá ich nemá:
   overiť po nasadení hlavičky z CDN (Task 7).

---

### Task 1: Statické súbory a písma

**Súbory:**
- Vytvoriť: `src/web/static-files.ts`, `public/fonts/*` (4 × WOFF2 + 2 licencie), `vercel.json`
- Upraviť: `src/web/index.ts` (CSP, registrácia trasy)
- Test: `test/web-static.test.ts`

**Rozhrania:**
- Poskytuje: `registerStaticFiles(app: Hono | OpenAPIHono): void`;
  `STATIC_FILES: Record<string, string>` (cesta → MIME typ); názvy písiem
  `/fonts/inter-v20-latin-wght.woff2`, `/fonts/inter-v20-latin-ext-wght.woff2`,
  `/fonts/space-grotesk-v22-latin-wght.woff2`,
  `/fonts/space-grotesk-v22-latin-ext-wght.woff2`.

- [ ] **Krok 1: Testy**
  - `písmo vráti s typom font/woff2 a trvalou vyrovnávacou pamäťou`:
    status 200, `content-type` = `font/woff2`, `cache-control` obsahuje
    `immutable`, telo neprázdne.
  - `neznámy alebo podvrhnutý súbor vráti 404`: `/fonts/neexistuje.woff2`,
    `/fonts/..%2F..%2Fpackage.json`.
  - `CSP povoľuje písma len z vlastného servera`: CSP na `/` obsahuje
    `font-src 'self'`.
- [ ] **Krok 2:** `pnpm test test/web-static.test.ts` → FAIL (404, chýba
  `font-src`).
- [ ] **Krok 3:** Skopírovať písma a licencie, implementovať trasu (súbory
  z `new URL('../../public/', import.meta.url)`, len cesty zo
  `STATIC_FILES`; písma `public, max-age=31536000, immutable`, ostatné
  `public, max-age=86400`), doplniť CSP, `vercel.json` s rovnakou hlavičkou
  pre `/fonts/(.*)`.
- [ ] **Krok 4:** test → PASS, `pnpm test` celé zelené.
- [ ] **Krok 5:** commit.

### Task 2: Logo, favicon a obrázok na zdieľanie

**Súbory:**
- Vytvoriť: `design/og-image.svg`, `design/README.md`, `public/favicon.svg`,
  `public/favicon.ico`, `public/apple-touch-icon.png`, `public/og.png`
- Upraviť: `src/web/static-files.ts` (zoznam), `test/web-static.test.ts`

- [ ] **Krok 1: Testy** `obrázky značky vráti so správnym typom`:
  `/favicon.svg` → `image/svg+xml`, `/favicon.ico` → `image/x-icon`,
  `/apple-touch-icon.png` a `/og.png` → `image/png`; PNG má rozmery z IHDR
  180 × 180 a 1200 × 630.
- [ ] **Krok 2:** test → FAIL (404).
- [ ] **Krok 3:** Logo zo smeru A ako `favicon.svg`; ICO (PNG 16 a 32 px vo
  formáte ICO), ikonu pre iOS a OG obrázok vykresliť skriptom v pracovnom
  priečinku (resvg so statickými TTF Space Grotesk a Inter); OG: tmavé
  pozadie, radar, logo, „Je to naozaj zľava?“, podnadpis.
- [ ] **Krok 4:** test → PASS; obrázky skontrolovať pohľadom.
- [ ] **Krok 5:** commit.

### Task 3: Rozloženie stránky

**Súbory:**
- Upraviť: `src/web/layout.ts` (prepis), `src/web/search.ts`,
  `src/web/alert.ts`, `src/web/index.ts`, `src/redirect/route.ts` (volania)
- Vytvoriť: `src/web/icons.ts`
- Test: `test/web.test.ts` (nový `describe('rozloženie')`)

**Rozhrania:**
- Poskytuje:
  `page(opts: { site: { siteName: string; publicBaseUrl: string }; title: string; body: Html; description?: string; noindex?: boolean; layout?: 'landing' | 'wide' | 'narrow'; search?: Country | false }): Html`
  (`search` = krajina pre vyhľadávanie v hlavičke, `false` ho vynechá;
  `landing` ho vynecháva vždy); `logo(size: number): Html`;
  `icon(name: IconName, size?: number): Html`;
  `searchForm(query: string, country: Country, variant?: 'full' | 'compact'): Html`.

- [ ] **Krok 1: Testy**
  - `hlavička má logo, menu pre mobil a odkaz na obsah`: `<details`,
    `href="#obsah"`, `id="obsah"`.
  - `stránky nemajú JavaScript ani cookies`: pre `/`, `/ako-to-funguje`,
    `/produkt/{roborock}` žiadne `<script`, hlavička `set-cookie` = null.
  - `zdieľanie má obrázok s absolútnou adresou`:
    `<meta property="og:image" content="https://domena.example/og.png"`,
    `og:title`, `twitter:card`, `<link rel="icon" href="/favicon.svg"`.
  - `vyhľadávanie v hlavičke si drží krajinu`: `/produkt/{roborock}?country=CZ`
    obsahuje `name="country" value="CZ"` v kompaktnom formulári; `/` nemá
    kompaktný formulár.
- [ ] **Krok 2:** testy → FAIL.
- [ ] **Krok 3:** Prepísať `layout.ts` (tokeny farieb, `@font-face`,
  hlavička s desktopovou navigáciou a `<details>`, pätička s logom
  a priznaním partnerských odkazov, `.sheet` pre úzke stránky); upraviť
  volania `page()`.
- [ ] **Krok 4:** `pnpm test` a `pnpm typecheck` zelené.
- [ ] **Krok 5:** commit.

### Task 4: Úvodná stránka

**Súbory:** Upraviť `src/web/index.ts` (presun obsahu do `src/web/home.ts`),
test `test/web.test.ts`.

- [ ] **Krok 1: Testy** (text bez značiek cez pomocnú `text(html)`):
  - `úvod sa pýta, či je zľava skutočná`: `Je to naozaj zľava?`, formulár
    `action="/hladat"`.
  - `príklad je označený ako ilustračný a nevedie do obchodu`:
    `Ilustračný príklad`, bez `rel="sponsored`.
  - `AI chat spomína len ChatGPT a Claude`: obsahuje oboje,
    `href="/pre-ai-asistentov"`, neobsahuje `Gemini`.
  - `úvod vedie k stráženiu ceny a vysvetľuje, ako zarábame`:
    `Nechajte ju strážiť`, `href="/affiliate"`.
- [ ] **Krok 2:** testy → FAIL.
- [ ] **Krok 3:** Sekcie podľa plochy „A · Radar – úvodná stránka“ okrem
  „Ceny, ktoré sa pohli“; produkt v príklade bez značky („Robotický
  vysávač“), obchody vymyslené, ukážka e-mailu a rozhovoru bez odkazov.
- [ ] **Krok 4:** testy → PASS.
- [ ] **Krok 5:** commit.

### Task 5: Stránka produktu a graf

**Súbory:** Upraviť `src/web/search.ts` (`productBody`), `src/web/chart.ts`;
testy `test/web.test.ts`, `test/web-chart.test.ts`.

- [ ] **Krok 1: Testy**
  - `karta verdiktu vedie do obchodu s najnižšou cenou skladom`: text
    `Do obchodu E-shop alfa`, odkaz cez redirector s `rel="sponsored`.
  - `najlacnejšiu ponuku označí`: `Najnižšia cena` pri prvej ponuke.
  - `lacnejšiu ponuku mimo skladu neoznačí ako najlepšiu` (izolovaná DB,
    beta za 479 € s dodaním 3 dni): `Najlacnejšie skladom`, karta verdiktu
    vedie na alfa.
  - `bez histórie ukáže, že priemery nevieme`: štatistiky NULL,
    `history_days = 3` → `Zatiaľ málo údajov`, `nevieme`, status 200.
  - graf: `ceny najvyššej a najnižšej úrovne sú viditeľné popisky` →
    `<text …>545 €</text>` a `<text …>489 €</text>`; existujúce testy
    schodovej čiary platia.
- [ ] **Krok 2:** testy → FAIL.
- [ ] **Krok 3:** Karta verdiktu, dlaždice, graf v karte, ponuky ako `<ol>`
  kariet, karta stráženia; graf s plochou pod čiarou, prerušovanými
  čiarami minima a maxima a bodom na konci.
- [ ] **Krok 4:** `pnpm test` zelené.
- [ ] **Krok 5:** commit.

### Task 6: Vyhľadávanie, stráženie a obsahové stránky

**Súbory:** Upraviť `src/web/search.ts`, `src/web/alert.ts`,
`src/web/static-pages.ts`; test `test/web.test.ts`.

- [ ] **Krok 1: Testy**
  - `stránka pre AI asistentov nespomína Gemini`.
  - `výsledky vyhľadávania sú karty s cenou`: `class="result"`,
    `od 699 €`.
- [ ] **Krok 2:** testy → FAIL.
- [ ] **Krok 3:** Výsledky ako karty, formulár stráženia s viditeľnými
  popismi a chybou pri poli, obsahové stránky v liste `.sheet`.
- [ ] **Krok 4:** `pnpm test`, `pnpm typecheck` zelené.
- [ ] **Krok 5:** commit.

### Task 7: Overenie, dokumentácia a nasadenie

- [ ] Prehliadnuť stránky v prehliadači (ak sa dá spustiť bez
  administrátorských práv), inak aspoň vykresliť HTML a skontrolovať
  šírku 390 a 1440 px.
- [ ] `docs/plan.md` („Kde sme“, rozhodnutie 6, fáza 2, úloha majiteľa,
  denník), `docs/projekt.md` (funkcie webu), `docs/prevadzka.md`
  (statické súbory).
- [ ] Commit a push vetvy `prototyp-api-ingestor`.
- [ ] Nasadenie na Vercel (MCP `create_deployment`, gitSource), overiť
  `/`, `/produkt/…`, `/fonts/…` (`cache-control` s `immutable`), `/og.png`.
