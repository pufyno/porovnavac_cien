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

Slúži len na pozretie webu, nie ako ostrá prevádzka. Vercel si aplikáciu
zostaví sám zo súboru `src/index.ts`.

Projekt na Verceli sa volá `porovnavac-cien`, je prepojený s repozitárom na
GitHube a má adresu <https://porovnavac-cien-nu.vercel.app>. Všetky adresy
sú chránené prihlásením do Vercelu (Vercel Authentication, nastavenie „all“),
takže ukážku vidí len majiteľ účtu. Kým web nemá prevádzkovateľa, právne
texty a odosielanie e-mailov, ochranu nevypínať.

1. Vytvoriť hostovanú PostgreSQL 17 s rozšíreniami `pg_trgm`, `unaccent`
   a `citext` (napríklad Neon alebo Supabase).
2. V projekte na Verceli nastaviť premenné `DATABASE_URL` a `DEMO=1`.
   `PUBLIC_BASE_URL` netreba; použije sa adresa, ktorú pridelí Vercel.
3. Raz naplniť databázu ukážkovými dátami z ľubovoľného počítača:

   ```
   DATABASE_URL=… PUBLIC_BASE_URL=https://ADRESA-UKAZKY pnpm demo:seed
   ```

   Príkaz spustí migrácie a vloží vzorové e-shopy so 100 dňami histórie.
   Odmietne bežať nad databázou, v ktorej už nejaké obchody sú.

Lokálne sa zostavenie dá overiť príkazom `vercel build`. Vercel prekladá
súbory jednotlivo, preto `tsconfig.json` musí mať zapnuté
`rewriteRelativeImportExtensions`; inak funkcia po štarte nenájde moduly. E-maily sa ani tu
neodosielajú a nočný import nebeží, takže história cien končí dňom naplnenia.

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
- **Právne texty.** Stránky `/o-nas` a `/ochrana-sukromia` sú pracovná verzia
  s viditeľne označenými miestami na doplnenie.
- **Obmedzenie počtu požiadaviek** na `/api/`, `/mcp` a `/alert` na úrovni
  reverzného proxy.
- **Logy reverzného proxy** môžu obsahovať IP adresy; zásady ochrany súkromia
  tvrdia, že pri preklikoch IP neukladáme, čo platí len pre aplikáciu.
