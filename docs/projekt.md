# Porovnávač cien – popis projektu

Tento dokument hovorí, **čo staviame a prečo**. Aktuálny stav, fázy a termíny sú
v [plan.md](plan.md).

„Porovnávač cien“ je pracovný názov. Názov produktu ani doména zatiaľ nie sú
vybrané.

## 1. Čo staviame

Službu, ktorá AI asistentom (ChatGPT, Claude, Gemini) dodáva živé ceny
elektroniky zo slovenských a českých e-shopov. Používateľ sa v chate opýta
napríklad „Kde kúpim najlacnejšie Roborock S8 a je tá zľava reálna?“ a asistent
si odpoveď vypýta od nášho API.

Problém, ktorý riešime: globálne AI modely nepoznajú lokálne ceny, skladovú
dostupnosť ani to, či je zľava skutočná.

Naša pridaná hodnota oproti bežnému porovnávaču:

- **História cien.** Dnešnú cenu porovnáme s priemerom za 30 a 90 dní.
- **Detekcia falošných zliav.** Upozorníme, keď e-shop pred „akciou“ cenu zdvihol.
- **Odporúčanie.** Vrátime verdikt (kúpiť teraz / počkať) so zdôvodnením.

## 2. Ako zarábame

AI chat je bezplatný distribučný kanál. Zarábame na dvoch miestach:

| Vrstva | Kedy | Ako |
| --- | --- | --- |
| Affiliate preklik | Používateľ chce kúpiť hneď | Každá ponuka má náš odkaz `/redirect?offer_id=…`. Zaznamená preklik a presmeruje do e-shopu s affiliate parametrami. |
| Stráženie ceny | Cena je zatiaľ vysoká | Odpoveď obsahuje odkaz `/alert?ean=…&target=…`. Používateľ na webe zadá len e-mail; keď cena klesne, pošleme mu správu s affiliate odkazom. |

Používateľ sa v chate nikde neprihlasuje.

## 3. Moduly

Pôvodné zadanie malo štyri moduly. Web (Modul 4) sa oproti zadaniu rozrástol,
preto má vlastnú kapitolu 4.

### Modul 1 – Ingestor feedov a história cien

- Zdrojom sú oficiálne XML feedy z affiliate sietí vo formáte Heureka
  (`SHOPITEM`, `ITEM_ID`, `PRODUCTNAME`, `EAN`, `PRICE_VAT`, `URL`,
  `DELIVERY_DATE`). Žiadny scraping.
- Nočný job feedy sťahuje a spracúva streamovo, aby veľký súbor nezahltil pamäť.
- Ponuky sa párujú na produkty cez EAN; ak EAN chýba, cez podobnosť názvu.
- Zmeny cien sa zapisujú do histórie a prepočítajú sa štatistiky a varovania.

### Modul 2 – API pre AI asistentov

- `GET /api/v1/product-compare?query=…&country=SK`, cieľ odpovede pod 500 ms.
- Toleruje nepresný vstup (preklepy, chýbajúca diakritika).
- Pri nejednoznačnom vstupe nevracia chybu 4xx/5xx, ale inštrukciu pre AI, nech
  sa používateľa opýta na spresnenie.
- Každá odpoveď má pole `_ai_instruction`, ktoré AI povie, ako výsledok zobraziť.
- To isté API je dostupné ako REST s OpenAPI 3.1 (ChatGPT, Gemini) aj ako MCP
  nástroj (Claude).

### Modul 3 – Redirector a meranie preklikov

- `GET /redirect?offer_id=…&source=chatgpt` zapíše anonymný preklik a vráti
  HTTP 302 na affiliate adresu e-shopu.
- Identifikátor prekliku sa posiela sieti ako sub-ID, takže v reporte provízií
  vidno, ktorá AI platforma objednávku priniesla.

### Modul 4 – Web

Pozri kapitolu 4.

## 4. Web: funkcie a vizuál

Web má tri úlohy, v tomto poradí dôležitosti:

1. **Získať schválenie v affiliate sieťach.** Bez webu nás siete neschvália,
   a bez schválenia nie sú feedy.
2. **Zachytiť stráženie ceny** z odkazu v chate.
3. **Slúžiť ako porovnávač** pre ľudí, ktorí prídu mimo AI chatu.

### Funkcie

| Časť | Čo robí | Kedy |
| --- | --- | --- |
| Úvodná stránka | Vysvetlí službu a ukáže, ako ju použiť v ChatGPT, Claude a Gemini. | Prvá verzia webu |
| Obsah | Články a návody (nakupovanie elektroniky, ako spoznať falošnú zľavu). | Prvá verzia webu |
| Právne stránky | Prevádzkovateľ, kontakt, ochrana súkromia, označenie affiliate odkazov. | Prvá verzia webu |
| Vyhľadávač produktov | Vyhľadanie produktu a zoznam výsledkov. | Až budú dáta z feedov |
| Stránka produktu | Porovnanie ponúk, graf histórie ceny, verdikt, tlačidlo na stráženie. | Až budú dáta z feedov |
| Stráženie ceny (`/alert`) | Predvyplnený produkt a cieľová cena, používateľ zadá e-mail. Potvrdenie e-mailom, odhlásenie jedným klikom. | Fáza stráženia ceny |

### Vizuál

Zatiaľ nerozhodnuté. Treba určiť názov a logo, farby a typografiu, tón textov
a to, či web cieli najprv na mobil.

## 5. Technológie a prevádzka

| Vrstva | Voľba |
| --- | --- |
| Databáza | PostgreSQL 17 s rozšíreniami `pg_trgm`, `unaccent`, `citext` |
| Backend | TypeScript na Node 22, framework Hono, `@hono/zod-openapi` |
| MCP | Oficiálne `@modelcontextprotocol/sdk` v tom istom procese ako API |
| Ingestor | Samostatný worker, streamový XML parser, zápis cez `COPY` |
| Web | Vykresľovaný na serveri z tej istej aplikácie |
| Hosting | Vlastný VPS (2 jadrá, 7,8 GB RAM), za existujúcim reverzným proxy |
| E-maily | Zatiaľ nerozhodnuté (Brevo alebo Resend) |

Prevádzkové pravidlá:

- Produkčnú databázu a nasadenie nastavuje majiteľ pod vlastným účtom. Účet,
  pod ktorým beží Claude, má zámerne obmedzené práva.
- Zálohy databázy musia odchádzať mimo VPS. História cien sa nedá získať znova.

## 6. Dáta

Schéma je v [`db/migrations/0001_init.sql`](../db/migrations/0001_init.sql).

| Tabuľka | Obsah |
| --- | --- |
| `affiliate_networks`, `shops`, `shop_feeds` | E-shopy, ich feedy a affiliate nastavenia |
| `feed_imports` | Záznam o každom importe vrátane odmietnutých |
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
  v rámci jednej krajiny.
- **Prekliky sú anonymné**, neukladá sa IP adresa.
- **Podozrivý import sa odmietne** (napríklad náhly prepad počtu položiek), aby
  jeden pokazený feed nevypol všetky ponuky.

## 7. Odpoveď API (návrh)

Finálny tvar sa určí pri návrhu API. Oproti zadaniu je už rozhodnuté, že polia
sa volajú `price` a `currency`, nie `price_eur`. Pole `history_days` je návrh.

```json
{
  "product_name": "Roborock S8 White",
  "ean": "6970995786842",
  "country": "SK",
  "currency": "EUR",
  "price_analysis": {
    "current_lowest_price": 489.00,
    "average_90d_price": 545.00,
    "history_days": 90,
    "verdict": "BUY_NOW",
    "verdict_reason": "Aktuálna cena je o 56 € pod 90-dňovým priemerom."
  },
  "offers": [
    {
      "shop_name": "E-shop Alfa",
      "price": 489.00,
      "in_stock": true,
      "fake_discount_warning": false,
      "buy_url": "https://go.DOMENA/redirect?offer_id=99182"
    }
  ],
  "price_alert_url": "https://DOMENA/alert?ean=6970995786842&target=450",
  "_ai_instruction": "Zobraz porovnanie v tabuľke, pri každom obchode daj odkaz z buy_url."
}
```

## 8. Rozhodnutia

| Dátum | Rozhodnutie | Dôvod |
| --- | --- | --- |
| 2026-11-15 | TypeScript (Hono) + PostgreSQL 17 | Jedna schéma pre REST, OpenAPI aj MCP; fuzzy vyhľadávanie priamo v databáze. |
| 2026-11-15 | Hosting na vlastnom VPS, nie Supabase | VPS už je k dispozícii, bez limitu veľkosti databázy a bez studených štartov. |
| 2026-11-15 | Polia API `price` + `currency` | Český trh je v CZK. |
| 2026-11-15 | História cien len pri zmene | Veľkosť tabuľky. |
| 2026-11-15 | Web sa robí pred ingestorom | Bez webu nie je schválenie v sieťach, bez schválenia nie sú feedy. |

## 9. Riziká

| Riziko | Dopad | Čo s tým |
| --- | --- | --- |
| Feed neobsahuje „pôvodnú“ cenu | Štandardný Heureka XML má len aktuálnu cenu. Varovanie typu „zľava 30 % z 740 €“ z neho nezískame. | Falošnú zľavu detegovať z vlastnej histórie (cena pred akciou stúpla). Stĺpec `list_price` je pripravený pre feedy, ktoré pôvodnú cenu majú. |
| Studený štart histórie | 90-dňový priemer má zmysel až po 90 dňoch zberu. | Ingestor spustiť hneď po prvom feede. API nevydá verdikt, kým dát nie je dosť. |
| Siete alebo inzerenti neschvália AI chat ako zdroj | Bez schválenia nie sú feedy alebo sa nevyplatia provízie. | Zdroj návštevnosti uviesť v žiadosti otvorene a overiť pravidlá vopred. |
| Všetko beží na jednom VPS | Výpadok alebo strata disku zastaví službu a zničí históriu. | Zálohy mimo VPS od prvého dňa zberu. |
| E-maily v strážení ceny sú osobné údaje | Povinnosti podľa GDPR. | Potvrdenie e-mailom, odhlásenie, uvedený prevádzkovateľ, zásady ochrany súkromia. |

## 10. Otvorené otázky

- Názov produktu a doména.
- Na koho sa registrovať v sieťach: vyplácajú provízie fyzickej osobe, alebo
  treba živnosť či firmu?
- Vizuál webu (kapitola 4).
- Začať len so Slovenskom a Česko pridať neskôr, alebo obe krajiny naraz?
  Schéma podporuje obe.
- Ktoré siete a e-shopy osloviť ako prvé.
- Služba na odosielanie e-mailov a kam ukladať zálohy.
