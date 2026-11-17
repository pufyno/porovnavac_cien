# Spustenie a prevádzka

## Požiadavky

- Node 22.18 alebo novší a pnpm
- PostgreSQL 17 (len pre ostrú prevádzku; testy a ukážka si spustia vlastnú)

```
pnpm install
```

## Ukážka bez databázy a bez feedov

```
pnpm demo
```

Spustí dočasnú PostgreSQL bez Dockeru, vygeneruje vzorové feedy štyroch
vymyslených e-shopov so 100 dňami histórie, naimportuje ich rovnakou cestou
ako ostrý import a pustí aplikáciu na <http://localhost:3000>. Port sa mení
premennou `PORT`.

Čo skúsiť:

| Dopyt | Čo ukáže |
| --- | --- |
| `roborock s8 pro ultra` | Dobrá cena v jednom obchode, zdanlivá zľava v druhom |
| `iphone 15 128gb` | Po zdražení odporúča počkať |
| `samsung galaxy s24` | Dva varianty, žiada spresnenie |
| `dyson v15 detect` | Krátka história, verdikt sa nevydá |
| `sony xm5` | Rozlíšenie modelov podľa čísla |

Pripojenie ukážky do Claude Code ako MCP servera:

```
claude mcp add --transport http porovnavac http://localhost:3000/mcp
```

E-maily stráženia ceny sa v ukážke vypisujú do konzoly. Prekliky do obchodov
končia na ukážkovej stránke, lebo e-shopy neexistujú.

## Ukážka na Verceli

Slúži len na pozretie webu, nie ako ostrá prevádzka.

| | |
| --- | --- |
| Adresa | <https://porovnavac-cien-nu.vercel.app> |
| Projekt | `porovnavac-cien` v osobnom tíme majiteľa |
| Zdroj | Repozitár `pufyno/porovnavac_cien` na GitHube; každý push sa nasadí sám |
| Produkčná vetva | `main`. Ostatné vetvy dostanú vlastnú náhľadovú adresu; na hlavnú adresu sa dostanú až ručným nasadením alebo zlúčením do `main`. |
| Vstupný bod | `src/index.ts`, Vercel ho nájde sám (framework Hono) |
| Región funkcií | Frankfurt (`fra1`) |
| Prístup | Len po prihlásení do Vercelu (Vercel Authentication, nastavenie „all“) |
| Premenné | `DEMO=1`, `DATABASE_URL` |

Ochranu prihlásením nevypínať, kým web nemá prevádzkovateľa, hotové právne
texty a odosielanie e-mailov.

### Databáza ukážky

| | |
| --- | --- |
| Služba | Neon, bezplatný plán |
| Projekt | `shiny-star-23924927`, organizácia `org-spring-recipe-48010383` |
| Vetva | `production` |
| Región | Frankfurt (AWS `eu-central-1`), rovnaký ako funkcie na Verceli |
| Verzia | PostgreSQL 18. Testy aj ostrá prevádzka sú na verzii 17; ukážka na 18 prešla bez zmien. |

Repozitár je s projektom prepojený nástrojom `neon` (súbory `.neon`
a `neon.ts`). Prístupové údaje stiahne `neon env pull` do `.env.local`; oba
súbory s údajmi sú v `.gitignore`. Neon dáva dve adresy tej istej databázy:

- `DATABASE_URL` ide cez pooler. Používa ju bežiaca aplikácia, teda aj funkcia
  na Verceli.
- `DATABASE_URL_UNPOOLED` je priame pripojenie. Používajú ho `pnpm migrate`
  a `pnpm demo:seed`, ak je nastavené; inak siahnu po `DATABASE_URL`.

Ukážkové dáta sa vložili príkazom:

```
PUBLIC_BASE_URL=https://porovnavac-cien-nu.vercel.app node --env-file=.env.local src/dev/demo-seed-cli.ts
```

Príkaz spustí migrácie a vloží štyri vymyslené e-shopy so 100 dňami histórie.
Odmietne bežať nad databázou, v ktorej už nejaké obchody sú. `PUBLIC_BASE_URL`
určuje, kam povedú prekliky z ukážky.

Na Verceli musí byť tá istá hodnota `DATABASE_URL` (s poolerom) nastavená pre
prostredia Production aj Preview. Po zmene premennej treba nasadiť znova, inak
funkcia beží so starou hodnotou.

### Stav k 17. 11. 2026

Ukážka funguje celá: vyhľadávanie, stránka produktu s grafom, stráženie ceny,
API, MCP aj preklik na zástupnú stránku e-shopu. `DATABASE_URL` je na Verceli
uložená ako citlivá premenná, takže jej hodnotu už nejde prečítať, len
prepísať:

```
node --env-file=.env.local -e "process.stdout.write(process.env.DATABASE_URL)" | vercel env add DATABASE_URL production --force --yes --sensitive
```

To isté pre `preview`. Príkaz treba spustiť v priečinku prepojenom s projektom
(`vercel link`). Pozor: `vercel link` v novom priečinku stiahne premenné do
`.env.local` a prepísal by súbor s údajmi z Neonu; v tomto repozitári ho preto
nespúšťať, prepojenie spraviť v pomocnom priečinku a použiť `--cwd`.

Produkčné nasadenie z vetvy sa robí ručne (nasadenie s cieľom `production`
a vetvou `prototyp-api-ingestor`); push na vetvu vytvorí len náhľad.

### Na čo si dať pozor

- **TypeScript 7 nepoužívať.** Zostavovací nástroj Vercelu s ním padá
  (`Cannot read properties of undefined (reading 'readFile')`). Projekt je
  preto na TypeScripte 6.
- **`rewriteRelativeImportExtensions` v `tsconfig.json` musí ostať zapnuté.**
  Vercel prekladá súbory jednotlivo; bez tejto voľby ostanú v preložených
  súboroch importy s príponou `.ts` a funkcia po štarte nenájde moduly.
- **Vstupný bod musí priamo importovať `hono`** a exportovať aplikáciu ako
  predvolený export, inak ho Vercel nerozpozná.
- **Prvé nasadenie nového projektu ide vždy do produkcie**, aj z inej vetvy.
- E-maily sa ani tu neodosielajú a nočný import nebeží, takže história cien
  končí dňom naplnenia.

Lokálne sa zostavenie dá overiť príkazom `vercel build`; stačí súbor
`.vercel/project.json` s nastavením `{"settings":{"framework":"hono"}}`
a vymyslenými identifikátormi `projectId` a `orgId`.

## Testy a merania

```
pnpm test        # všetky testy proti dočasnej PostgreSQL 17
pnpm typecheck
pnpm bench       # rýchlosť importu a vyhľadávania na 100 000 produktoch (asi 3 minúty)
```

## Ostrá prevádzka

Tieto kroky robí majiteľ pod vlastným účtom.

### 1. Databáza

```sql
CREATE ROLE porovnavac LOGIN PASSWORD '…';
CREATE DATABASE porovnavac OWNER porovnavac;
\c porovnavac
CREATE EXTENSION pg_trgm;
CREATE EXTENSION unaccent;
CREATE EXTENSION citext;
```

Rozšírenia musí vytvoriť správca databázy; migrácie ich potom nájdu hotové.

### 2. Nastavenie

Premenné prostredia sú popísané v [`.env.example`](../.env.example). Povinná
je len `DATABASE_URL`. Aplikácia súbor `.env` sama nenačíta; odovzdajte ho
cez `node --env-file=.env` alebo cez `EnvironmentFile=` v systemd.

### 3. Migrácie a štart

```
pnpm migrate
pnpm start
```

Aplikácia počúva na `127.0.0.1:3000`. Na internet ju vystavuje reverzný proxy
s HTTPS. Stav sa dá overiť na `/health`.

### 4. Pridanie e-shopu

Správa e-shopov zatiaľ nemá rozhranie, vkladajú sa priamo do databázy:

```sql
INSERT INTO affiliate_networks (code, name) VALUES ('dognet', 'Dognet')
ON CONFLICT (code) DO NOTHING;

INSERT INTO shops (slug, name, country, currency, website_url)
VALUES ('nazov-obchodu', 'Názov obchodu', 'SK', 'EUR', 'https://www.obchod.sk');

INSERT INTO shop_feeds (shop_id, network_id, feed_url, deeplink_template, commission_pct)
VALUES (
  (SELECT id FROM shops WHERE slug = 'nazov-obchodu'),
  (SELECT id FROM affiliate_networks WHERE code = 'dognet'),
  'https://www.obchod.sk/feed/heureka.xml',
  'https://ADRESA-SIETE/click?a_aid=VAS_KOD&data1={click_id}&desturl={url}',
  3.0
);
```

V šablóne `deeplink_template` sa `{url}` nahradí adresou ponuky a `{click_id}`
identifikátorom prekliku. Presný tvar šablóny určuje sieť.

### 5. Nočný import

```
pnpm ingest
```

Stiahne a naimportuje všetky aktívne feedy, prepočíta štatistiky, rozošle
upozornenia na stráženú cenu a zmaže staré e-maily. Skončí s nenulovým kódom,
keď niektorý feed zlyhal. Spúšťať raz denne v noci (cron alebo systemd timer).
Deň importu sa riadi časom v Bratislave.

Výsledok každého importu je v tabuľke `feed_imports`:

```sql
SELECT s.slug, i.started_at, i.status, i.items_total, i.items_changed, i.error
FROM feed_imports i
JOIN shop_feeds f ON f.id = i.feed_id
JOIN shops s ON s.id = f.shop_id
ORDER BY i.id DESC LIMIT 20;
```

### 6. Zálohy

História cien sa nedá získať znova. Denný `pg_dump` musí odchádzať mimo VPS.

## Čo pred ostrým spustením chýba

- **Odosielanie e-mailov.** Aplikácia e-maily len vypisuje do logu. Kým nie je
  vybraná služba a napísaný druhý `Mailer`, stráženie ceny nesmie byť verejné:
  formulár by sľuboval e-mail, ktorý nepríde.
- **Právne texty.** Údaje prevádzkovateľa sa nastavia v `.env` premennými
  `OPERATOR_*`; kým chýbajú, stránky ich označia na doplnenie. V zásadách
  ochrany súkromia treba doplniť poskytovateľa hostingu, službu na e-maily
  a dobu uchovania logov; celé texty dať skontrolovať.
- **Obmedzenie počtu požiadaviek** na `/api/`, `/mcp` a `/alert` na úrovni
  reverzného proxy.
- **Logy reverzného proxy** obsahujú IP adresy. Zásady ochrany súkromia to
  uvádzajú; dobu uchovania treba nastaviť na proxy a doplniť do textu.
