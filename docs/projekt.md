# Porovnávač cien – popis projektu

Tento dokument hovorí, **čo staviame a prečo**. Ďalšie dokumenty:

- [plan.md](plan.md) – aktuálny stav, fázy a termíny
- [prieskum.md](prieskum.md) – čo sme zistili o AI platformách, sieťach a konkurencii, so zdrojmi
- [prevadzka.md](prevadzka.md) – ako aplikáciu spustiť, nasadiť a pridať e-shop

„Porovnávač cien“ je pracovný názov. Názov produktu ani doména zatiaľ nie sú
vybrané.

## 1. Čo staviame

Službu, ktorá AI asistentom (ChatGPT, Claude, Gemini) dodáva živé ceny
elektroniky zo slovenských a českých e-shopov. Používateľ sa v chate opýta
napríklad „Kde kúpim najlacnejšie Roborock S8 a je tá zľava reálna?“ a asistent
si odpoveď vypýta od nás.

Problém, ktorý riešime: globálne AI modely nepoznajú lokálne ceny, skladovú
dostupnosť ani to, či je zľava skutočná.

Naša pridaná hodnota oproti bežnému porovnávaču:

- **História cien.** Dnešnú cenu porovnáme s priemerom za 30 a 90 dní.
- **Odhalenie zdanlivých zliav.** Upozorníme, keď e-shop pred „akciou“ cenu zdvihol.
- **Odporúčanie.** Vrátime verdikt (kúpiť teraz / počkať) so zdôvodnením.

## 2. Ako zarábame

AI chat je bezplatný distribučný kanál. Zarábame na dvoch miestach:

| Vrstva | Kedy | Ako |
| --- | --- | --- |
| Affiliate preklik | Používateľ chce kúpiť hneď | Každá ponuka má náš odkaz `/redirect?offer_id=…`. Zaznamená preklik a presmeruje do e-shopu s affiliate parametrami. |
| Stráženie ceny | Cena je zatiaľ vysoká | Odpoveď obsahuje odkaz `/alert?ean=…&target=…`. Používateľ na webe zadá len e-mail; keď cena klesne, pošleme mu správu s affiliate odkazom. |

Používateľ sa v chate nikde neprihlasuje.

**Otvorené riziko:** katalógy OpenAI aj Anthropic zakazujú reklamu a platené
umiestnenia a affiliate odkazy výslovne neriešia. Pozri kapitolu 9
a [prieskum.md](prieskum.md).

## 3. Moduly

Všetky štyri moduly existujú ako otestovaný prototyp nad vzorovými feedmi.
Reálne dáta zatiaľ nemáme.

### Modul 1 – Ingestor feedov a história cien

- Zdrojom sú oficiálne XML feedy z affiliate sietí vo formáte Heureka. Žiadny
  scraping.
- Nočný job (`pnpm ingest`) feedy sťahuje cez HTTP(S), rozbalí gzip a spracúva
  ich streamovo, takže veľký súbor nezahltí pamäť.
- Ponuky sa párujú na produkty cez EAN. Ponuka bez EAN ostáva nespárovaná;
  párovanie podľa názvu zatiaľ nie je (treba ho ladiť na reálnych dátach).
- Zmeny cien sa zapisujú do histórie, potom sa prepočítajú štatistiky
  a varovania a rozošlú upozornenia na stráženú cenu.
- Poistky: prázdny feed alebo prepad počtu položiek pod polovicu sa odmietne,
  poškodený feed nezmení nič, zlyhanie jedného feedu nezastaví ostatné.

### Modul 2 – Rozhranie pre AI asistentov

- **MCP server** na `/mcp` (streamable HTTP, bezstavový, bez prihlásenia)
  s jedným nástrojom `compare_prices`. Je to hlavné rozhranie, pozri
  rozhodnutie z 17. 11. 2026.
- **REST API** `GET /api/v1/product-compare?query=…&country=SK` s popisom
  OpenAPI 3.1 na `/openapi.json`. Rovnaká logika, druhé rozhranie.
- Toleruje preklepy a chýbajúcu diakritiku. Číslo modelu z dopytu musí
  sedieť, takže „iPhone 15“ nikdy nevráti iPhone 14.
- Nejasný vstup nekončí chybou 4xx/5xx. Odpoveď má `status`:
  `ok`, `needs_clarification` (zoznam kandidátov) alebo `not_found`.
- Každá odpoveď má pole `_ai_instruction`, ktoré asistentovi povie, ako
  výsledok podať: tabuľka, upozornenie na zdanlivú zľavu, priznanie
  partnerských odkazov a obmedzeného pokrytia, ponuka stráženia ceny.

### Modul 3 – Redirector a meranie preklikov

- `GET /redirect?offer_id=…&source=chatgpt` zapíše anonymný preklik a vráti
  HTTP 302 na affiliate adresu e-shopu.
- Identifikátor prekliku sa posiela sieti ako sub-ID, takže v reporte provízií
  vidno, ktorá platforma objednávku priniesla.
- Cieľ presmerovania sa skladá len z údajov v databáze, endpoint sa nedá
  zneužiť ako otvorený redirect.

### Modul 4 – Web

Pozri kapitolu 4.

## 4. Web: funkcie a vizuál

Web má tri úlohy, v tomto poradí dôležitosti:

1. **Získať schválenie v affiliate sieťach.** Bez webu nás siete neschvália,
   a bez schválenia nie sú feedy.
2. **Zachytiť stráženie ceny** z odkazu v chate.
3. **Slúžiť ako porovnávač** pre ľudí, ktorí prídu mimo AI chatu.

### Funkcie

| Časť | Adresa | Stav |
| --- | --- | --- |
| Úvodná stránka | `/` | Hotová |
| Ako to funguje (zdroje dát, verdikt, zdanlivé zľavy) | `/ako-to-funguje` | Hotová |
| Pripojenie do AI chatu | `/pre-ai-asistentov` | Hotová |
| Ako zarábame | `/affiliate` | Hotová |
| O službe a kontakt, ochrana súkromia | `/o-nas`, `/ochrana-sukromia` | Pracovná verzia; chýba prevádzkovateľ a kontakt |
| Vyhľadávač | `/hladat` | Hotový |
| Stránka produktu (ponuky, verdikt, graf ceny) | `/produkt/{ean}` | Hotová |
| Stráženie ceny (formulár, potvrdenie, odhlásenie) | `/alert` | Hotové; e-maily sa zatiaľ neodosielajú |
| Ďalší obsah (články, návody) | – | Nie je |

Web nepoužíva cookies, JavaScript ani analytiku tretích strán.

### Vizuál

Zatiaľ nerozhodnuté. Prototyp má zámerne neutrálny vzhľad bez značky; všetky
štýly sú v `src/web/layout.ts`. Treba určiť názov a logo, farby a typografiu
a tón textov.

## 5. Technológie a prevádzka

| Vrstva | Voľba |
| --- | --- |
| Databáza | PostgreSQL 17 s rozšíreniami `pg_trgm`, `unaccent`, `citext` |
| Backend | TypeScript 6 na Node 22 bez kroku zostavenia, framework Hono, `@hono/zod-openapi` |
| MCP | Oficiálne `@modelcontextprotocol/sdk` v tom istom procese ako API |
| Ingestor | Samostatný príkaz, streamový XML parser `saxes`, zápis po dávkach v jednej transakcii |
| Web | Vykresľovaný na serveri z tej istej aplikácie (`hono/html`) |
| Testy | vitest proti skutočnej PostgreSQL 17 (`embedded-postgres`, bez Dockeru) |
| Hosting | Ostrá prevádzka: vlastný VPS (2 jadrá, 7,8 GB RAM), za existujúcim reverzným proxy |
| Ukážka | Vercel, projekt `porovnavac-cien`, chránený prihlásením; potrebuje hostovanú PostgreSQL |
| E-maily | Nerozhodnuté; kód má rozhranie `Mailer`, zatiaľ len výpis do logu |

Prevádzkové pravidlá:

- Produkčnú databázu a nasadenie nastavuje majiteľ pod vlastným účtom. Účet,
  pod ktorým beží Claude, má zámerne obmedzené práva.
- Zálohy databázy musia odchádzať mimo VPS. História cien sa nedá získať znova.

Postup spustenia a nasadenia je v [prevadzka.md](prevadzka.md).

Aplikácia má dva vstupné body nad tým istým kódom: `src/server.ts` pre VPS
(sám počúva na porte) a `src/index.ts` pre Vercel (exportuje aplikáciu, ktorú
obslúži Vercel). Nočný import na Verceli nebeží; ukážka má dáta len z
jednorazového naplnenia.

### Výkon

Merané príkazom `pnpm bench` na tomto VPS so syntetickým katalógom
100 000 produktov v troch obchodoch (300 000 ponúk), PostgreSQL
s predvoleným nastavením. Rozsahy sú zo štyroch behov:

| Čo | Výsledok |
| --- | --- |
| Import jedného feedu so 100 000 položkami (35 MB XML) | 7–17 s |
| Pamäť procesu počas toho importu | bez nárastu (168 → 169 MB) |
| Denný import troch takých feedov | 11–15 s |
| Prepočet štatistík | 5–9 s, prvý deň 13–21 s |
| Porovnanie podľa EAN | 1–3 ms |
| Porovnanie podľa názvu | medián 50–100 ms, p95 80–400 ms |
| Najpomalší dopyt v behu | 435–727 ms |
| Veľkosť databázy | približne 420 MB |

Nočný import v tejto veľkosti trvá okolo minúty a pamäť nezaťažuje.

Cieľ zadania (odpoveď pod 500 ms) platí pre drvivú väčšinu dopytov, ale nie
pre všetky: v dvoch zo štyroch behov ho najpomalší dopyt prekročil. Pomalé sú
dlhé názvy zložené z častých slov. Syntetické názvy sa opakujú viac než
reálne, takže skutočný katalóg môže vyjsť lepšie; overí sa to až na reálnom
feede. Pri výrazne väčšom katalógu bude treba vyhľadávanie zrýchliť.

## 6. Dáta

Schéma je v [`db/migrations/`](../db/migrations/).

| Tabuľka | Obsah |
| --- | --- |
| `affiliate_networks`, `shops`, `shop_feeds` | E-shopy, ich feedy a affiliate nastavenia |
| `feed_imports` | Záznam o každom importe vrátane odmietnutých a zlyhaných |
| `products`, `product_eans` | Unifikované produkty; jeden produkt môže mať viac EAN |
| `offers` | Konkrétne ponuky e-shopov |
| `offer_price_history` | História ceny ponuky |
| `product_price_history`, `product_price_stats` | Najnižšia cena produktu v krajine a predpočítané štatistiky |
| `price_alerts` | Stráženie ceny |
| `click_logs` | Anonymné prekliky |

Dôležité vlastnosti:

- **História sa zapisuje len pri zmene ceny** ako interval platnosti, nie každý
  deň. Tabuľka tak rastie rádovo pomalšie než pri denných snímkach.
- **Ceny sú v mene e-shopu** (EUR pre SK, CZK pre CZ) a porovnávajú sa len
  v rámci jednej krajiny. Databáza to vynucuje.
- **Najnižšia cena produktu** je najlacnejšia ponuka skladom; ak nie je
  skladom nikde, najlacnejšia vôbec.
- **Prekliky sú anonymné**, neukladá sa IP adresa.
- **E-maily zo stráženia sa mažú:** nepotvrdené po 7 dňoch, ukončené po 30.

## 7. Pravidlá výpočtu

Prahy sú prvý odhad a majú sa doladiť na reálnych dátach.

**Verdikt** (`src/compare/verdict.ts`):

- Pri histórii kratšej než 14 dní sa verdikt nevydáva (`INSUFFICIENT_DATA`).
- Aktuálna cena sa porovnáva s priemerom za 90 dní; pri histórii kratšej než
  60 dní s priemerom za 30 dní.
- Aspoň 5 % pod priemerom je `BUY_NOW`, aspoň 5 % nad ním `WAIT`, inak
  `FAIR_PRICE`.

**Zdanlivá zľava** (`src/stats/fake-discount.ts`) sa hlási, keď platí všetko:

- cena pred najviac 30 dňami klesla,
- predtým bola najviac 21 dní zvýšená aspoň o 8 %,
- a súčasná cena je najmenej 97 % ceny pred zvýšením.

**Vyhľadanie** (`src/compare/match.ts`): kandidáti podľa trigramovej
podobnosti názvu; každé číslo z dopytu musí byť v názve produktu; ak je viac
rovnocenných kandidátov, vráti sa zoznam namiesto hádania.

## 8. Odpoveď API

Skutočná odpoveď z ukážkových dát, skrátená:

```json
{
  "status": "ok",
  "product_name": "Roborock S8 Pro Ultra White",
  "ean": "8580000000016",
  "country": "SK",
  "currency": "EUR",
  "price_analysis": {
    "current_lowest_price": 489,
    "average_30d_price": 524.47,
    "average_90d_price": 538.16,
    "lowest_90d_price": 489,
    "history_days": 90,
    "verdict": "BUY_NOW",
    "verdict_reason": "Aktuálna cena je o 49,16 € pod 90-dňovým priemerom a je najnižšia za posledných 90 dní."
  },
  "offers": [
    {
      "shop_name": "Alfa Elektro",
      "price": 489,
      "in_stock": true,
      "delivery_days": 0,
      "fake_discount_warning": false,
      "buy_url": "https://DOMENA/redirect?offer_id=1&source=chatgpt"
    },
    {
      "shop_name": "Beta Shop",
      "price": 519,
      "in_stock": false,
      "delivery_days": 3,
      "fake_discount_warning": true,
      "warning_detail": "Cena bola 515 €, potom na 7 dní stúpla na 740 € a teraz je 519 €. Zľava 30 % sa počíta z krátkodobo navýšenej ceny; oproti cene pred zdražením je produkt o 4 € drahší.",
      "buy_url": "https://DOMENA/redirect?offer_id=7&source=chatgpt"
    }
  ],
  "shops_compared": 3,
  "price_alert_url": "https://DOMENA/alert?ean=8580000000016&target=440&country=SK&source=chatgpt",
  "_ai_instruction": "Zobraz ponuky v tabuľke …"
}
```

Pri nejednoznačnom dopyte je `status` `needs_clarification` a odpoveď obsahuje
`candidates` (názov, EAN, najnižšia cena). Pri neznámom produkte `not_found`.
Pri výpadku služby vráti REST API kód 503 a MCP nástroj chybu, oboje
s pokynom pre asistenta, aby ceny neodhadoval.

## 9. Rozhodnutia

| Dátum | Rozhodnutie | Dôvod |
| --- | --- | --- |
| 2026-11-15 | TypeScript (Hono) + PostgreSQL 17 | Jedna schéma pre REST, OpenAPI aj MCP; fuzzy vyhľadávanie priamo v databáze. |
| 2026-11-15 | Hosting na vlastnom VPS, nie Supabase | VPS už je k dispozícii, bez limitu veľkosti databázy a bez studených štartov. |
| 2026-11-15 | Polia API `price` + `currency` | Český trh je v CZK. |
| 2026-11-15 | História cien len pri zmene | Veľkosť tabuľky. |
| 2026-11-15 | Web sa robí pred ingestorom | Bez webu nie je schválenie v sieťach, bez schválenia nie sú feedy. |
| 2026-11-17 | Prototyp celého reťazca na vzorových dátach skôr než web | Overiť realizovateľnosť distribúcie v AI chate nezávisle od čakania na siete. |
| 2026-11-17 | Hlavné rozhranie je MCP server, REST je druhé (**návrh, čaká na potvrdenie majiteľa**) | ChatGPT ruší vlastné GPT s Actions k 11. 12. 2026; MCP podporujú ChatGPT aj Claude. |
| 2026-11-17 | Zdanlivá zľava sa zisťuje len z vlastnej histórie | Formát Heureka pôvodnú cenu neobsahuje. |
| 2026-11-17 | Nejasný dopyt vracia kandidátov, nie najlepší odhad | Nesprávne spárovaný produkt by znamenal nesprávnu cenu a verdikt. |
| 2026-11-17 | Stráženie ceny je jednorazové a vyžaduje potvrdenie e-mailom | GDPR a ochrana pred zneužitím cudzej adresy. |
| 2026-11-17 | Ukážka na pozretie beží na Verceli (`src/index.ts`); ostrá prevádzka ostáva na VPS | Majiteľ si chce web pozrieť bez nastavovania VPS. Vercel potrebuje hostovanú PostgreSQL. |
| 2026-11-17 | TypeScript 6 namiesto 7 | Zostavovací nástroj Vercelu s TypeScriptom 7 padá; typová kontrola aj testy prechádzajú na oboch. |

## 10. Riziká

| Riziko | Dopad | Čo s tým |
| --- | --- | --- |
| Katalógy AI platforiem zakazujú reklamu a platené umiestnenia | Konektor s affiliate odkazmi nemusí byť schválený; bez katalógu je dosah malý. | Strategické rozhodnutie majiteľa. Možnosti: opýtať sa podpory vopred, podať žiadosť a uvidieť, alebo v chate odkazovať na vlastný web namiesto priamo na obchod. |
| ChatGPT má vlastné nakupovanie a Heureka je v ňom silno citovaná | Používateľ dostane ceny aj bez nás. | Odlíšiť sa históriou cien a odhalením zdanlivých zliav, ktoré tieto zdroje nedávajú. |
| Nízke provízie pri elektronike | Jednotky percent, pri niektorých obchodoch pod 1 %. | Počítať s tým pri odhade návratnosti; vyberať kampane aj podľa provízie. |
| Siete alebo inzerenti neschvália AI chat ako zdroj | Bez schválenia nie sú feedy alebo sa nevyplatia provízie; pri Alze hrozí zmluvná pokuta. | Zdroj návštevnosti uviesť v žiadosti otvorene, pri Alze mať súhlas písomne. |
| Studený štart histórie | Verdikt má zmysel po 14 dňoch, 90-dňový priemer po 90 dňoch zberu. | Ingestor spustiť hneď po prvom feede. API verdikt nevydá, kým dát nie je dosť. |
| Pokrytie | Porovnávame len obchody s partnerským programom; najlacnejší obchod môže chýbať. | Odpoveď aj web to priznávajú a uvádzajú počet porovnaných obchodov. |
| Ponuky bez EAN | Nespárujú sa a v porovnaní chýbajú. | Zmerať na prvom reálnom feede, koľko ich je; podľa toho doplniť párovanie podľa názvu. |
| Ukážka na Verceli sa nedopatrením zverejní | Návštevník uvidí pracovné právne texty a formulár stráženia, ktorý e-mail nepošle. | Ochrana prihlásením je zapnutá pre všetky adresy projektu; nevypínať, kým web nie je pripravený. |
| Všetko beží na jednom VPS | Výpadok alebo strata disku zastaví službu a zničí históriu. | Zálohy mimo VPS od prvého dňa zberu. |
| E-maily v strážení ceny sú osobné údaje | Povinnosti podľa GDPR. | Potvrdenie e-mailom, odhlásenie, mazanie po lehote sú hotové; chýba uvedený prevádzkovateľ a kontrola textov. |
| Roboty a náhľady odkazov v chatoch | Nafúknu počet preklikov. | Zatiaľ neriešené; pri vyhodnocovaní porovnávať s reportom siete. |

## 11. Otvorené otázky

Strategické, čakajú na majiteľa:

- Ako naložiť s affiliate odkazmi voči pravidlám katalógov (riziko vyššie).
- Potvrdiť MCP ako hlavné rozhranie.
- Názov produktu a doména.
- Na koho sa registrovať v sieťach (fyzická osoba, živnosť, firma).
- Vizuál webu.
- Len Slovensko na začiatok, alebo aj Česko. Kód podporuje obe.
- Služba na odosielanie e-mailov a kam ukladať zálohy.
- Kedy a podľa čoho projekt vyhodnotiť (napríklad počet preklikov po mesiaci).

Technické, vyriešia sa s reálnymi dátami:

- Párovanie ponúk bez EAN.
- Doladenie prahov verdiktu a zdanlivej zľavy.
- Jazyk popisov nástroja a pokynov pre asistenta (teraz slovensky; pre katalógy
  možno bude treba angličtinu) a české texty pre českých používateľov.
- Obmedzenie počtu požiadaviek (na úrovni reverzného proxy).
