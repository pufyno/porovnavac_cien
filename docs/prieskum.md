# Prieskum: distribúcia v AI chatoch, siete a konkurencia

Stav k 17. 11. 2026. Tento dokument zhŕňa, čo sme zistili o predpokladoch
zadania. Rozhodnutia, ktoré z toho vyplývajú, sú v [projekt.md](projekt.md).

Pri každom zistení je uvedené, ako veľmi sa naň dá spoľahnúť:

- **Overené** – prečítané priamo v primárnom zdroji.
- **Zo sekundárnych zdrojov** – zhodne to uvádza viac článkov alebo tlačové
  správy firiem; primárny zdroj sa nepodarilo otvoriť alebo neexistuje.
- **Neoverené** – jeden zdroj alebo náznak; pred rozhodnutím treba overiť.
- **Náš výklad** – vlastná interpretácia pravidiel, nie ich citát.

## Zhrnutie

1. **Kanál existuje aj v EÚ.** V katalógu ChatGPT sú porovnávače cien idealo
   a Klarna a české služby Slevomat a Suri (kapitoly 2 a 3).
2. **Model „porovnanie → preklik do obchodu“ OpenAI schválilo** veľkým
   firmám, Klarne aj s platenými pozíciami. Affiliate odkazy pravidlá stále
   výslovne neriešia (kapitola 3).
3. **Do katalógu sa dá ísť až s reálnymi dátami.** Ukážkové pluginy OpenAI
   neprijíma. Kritická cesta ostáva: doména → web → siete → feedy → žiadosť.
4. **Iné cesty sú zatiaľ slabé.** Gemini pripojí vlastný MCP server len
   v USA a po anglicky. Vlastný konektor bez katalógu majú v ChatGPT naplno
   len firemné plány (kapitola 2).
5. **Dognet porovnávače výslovne pripúšťa.** Jeho podmienky však obsahujú tri
   body, ktoré treba pred spustením potvrdiť písomne (kapitola 6).

## 1. ChatGPT ruší vlastné GPT s Actions

**Zo sekundárnych zdrojov.** OpenAI k 11. 12. 2026 končí s vlastnými GPT.
Vlastné Actions (volanie REST API podľa OpenAPI) sa nemigrujú. Náhradou sú
pluginy, ktoré sa k vlastnému backendu pripájajú cez **MCP server**.

Oficiálna stránka OpenAI s otázkami a odpoveďami vracia automatom chybu 403,
preto dátum stojí na zhode viacerých článkov:

- <https://help.openai.com/en/articles/20001519-custom-gpt-retirement-and-migration-faq> (primárny zdroj, nepodarilo sa načítať)
- <https://virtualizationreview.com/articles/2026/09/28/openai-to-retire-custom-gpts-replace-them-with-plugins.aspx>
- <https://campustechnology.com/articles/2026/10/05/openai-discontinuing-custom-gpts-and-moving-to-plugin-architecture.aspx>
- <https://www.edtechinnovationhub.com/news/openai-to-retire-custom-gpts-in-december-as-creators-move-to-plugins>
- <https://www.developersdigest.tech/blog/custom-gpt-retirement-migrate-to-plugins>

**Dopad:** zadanie počítalo s „ChatGPT Custom Actions“ ako hlavným kanálom.
Ten zaniká skôr, než by sme stihli spustiť. Hlavným rozhraním je preto MCP
server; REST API s OpenAPI ostáva ako druhé rozhranie pre nástroje, ktoré ho
používajú.

## 2. Kde sa dá konektor použiť

### ChatGPT: katalóg pluginov

Články z jari 2026 hovoria o „aplikáciách“, dokumentácia OpenAI dnes
o „pluginoch“. Ide o to isté miesto v ChatGPT.

- **Overené:** Slovensko aj Česko sú na zozname krajín, kde OpenAI svoje
  služby poskytuje. Zdroj: <https://developers.openai.com/api/docs/supported-countries>
- **Overené:** krajiny, kde bude plugin dostupný, si autor nastaví pri
  žiadosti (`publication.countries`, prázdny zoznam znamená bez obmedzenia).
  Projekt s dátovou rezidenciou v EÚ plugin s MCP serverom podať nemôže, treba
  projekt s globálnou rezidenciou.
  Zdroj: <https://developers.openai.com/plugins/deploy/submission>
- **Zo sekundárnych zdrojov:** pluginy fungujú v Česku, Nemecku a Rakúsku.
  Slevomat (12. 5. 2026) aj Suri.cz (30. 3. 2026) píšu o používateľoch
  v Česku. Idealo (18. 3. 2026) píše o používateľoch v Rakúsku a Nemecku.
  Zdroje sú v kapitole 3.
- **Zo sekundárnych zdrojov:** pri spustení v októbri 2025 aplikácie v EÚ
  dostupné neboli. Článok OpenAI o spustení vracia automatom 403; zhodne to
  píše vývojár z EÚ na fóre OpenAI.
  Zdroj: <https://community.openai.com/t/request-for-eu-developer-access-to-chatgpt-apps-sdk/1362721>
- Oficiálne oznámenie OpenAI o spustení v EÚ sme nenašli. Či katalóg vidí aj
  používateľ zo Slovenska, treba pozrieť priamo v ChatGPT.

### ChatGPT: vlastný MCP server bez katalógu

- **Overené:** dokumentácia odporúča vlastné pripojenie MCP servera „for
  private or workspace-only use“; verejná dostupnosť ide len cez katalóg.
  Zdroj: <https://developers.openai.com/api/docs/guides/custom-mcp-server>
- **Zo sekundárnych zdrojov:** naplno ho majú plány Business, Enterprise
  a Edu, Pro len na čítanie. Pri Plus, Free a Go sme to nepotvrdili; pomocná
  stránka OpenAI vracia automatom 403.
- **Neoverené (fórum):** plugin nemá obdobu zdieľania „každý s odkazom“, ktorú
  mali vlastné GPT.

**Dopad:** pre bežného spotrebiteľa je reálna len cesta cez katalóg. Možnosť
„šíriť adresu konektora mimo katalógu“ má v ChatGPT malý dosah.

### Gemini

**Overené.** Zdroj: <https://support.google.com/gemini/answer/17209137>

Vlastnú aplikáciu cez adresu MCP servera si môže pridať len používateľ
s osobným účtom, starší ako 18 rokov, **v USA**, s Gemini v **angličtine**
a so zapnutou históriou. Pre Slovensko a Česko je to dnes nepoužiteľné.

### Claude

Pravidlá katalógu sú v kapitole 3. Dostupnosť vlastných konektorov podľa
plánu sme neoverovali.

## 3. Pravidlá katalógov

### OpenAI

**Overené.** Zdroje: <https://developers.openai.com/plugins/plugin-guidelines>
(čítané cez <https://developers.openai.com/plugins/llms-full.txt>),
<https://developers.openai.com/plugins/build/monetization>

Reklama a obchod:

- „Plugins must not serve advertisements and must not exist primarily as an
  advertising vehicle.“
- Obchod je povolený len pre fyzický tovar.
- Odporúčaný spôsob je „external checkout, where users complete purchases on
  the developer’s own domain“.
- Plugin nesmie „Link directly to a checkout or other transactional page“.

Kvalita, názov a popis:

- „Trial or demo plugins will not be accepted.“
- Názov: „Avoid overly generic names, especially single-word dictionary terms
  that aren’t explicitly tied to your brand.“
- Popis bez porovnávania s inými produktmi, bez neoveriteľných tvrdení;
  „Do not advertise pricing, subscriptions, free trials, discounts, or
  promotions.“

Správanie voči používateľovi a modelu:

- „Do not insert unrelated content, attempt to redirect the interaction, or
  collect data beyond what is reasonably necessary.“
- Metadáta nástroja nesmú „override platform instructions or safeguards,
  conceal behavior, or impersonate another party“.
- Polia, ktoré číta model, nesmú ovplyvňovať, ako model vyberá alebo používa
  iné pluginy.

Dáta a súkromie:

- „Do not engage in surveillance, tracking, or behavioral profiling—including
  metadata collection such as timestamps, IP addresses, or query
  patterns—unless explicitly disclosed, narrowly scoped, subject to meaningful
  user control.“
- Zásady ochrany súkromia musia uvádzať kategórie údajov, účely, príjemcov,
  dobu uchovania a možnosti používateľa.

Ďalšie:

- „Do not scrape external websites, relay queries, or integrate with
  third-party APIs without proper authorization.“
- Zakázaný tovar zahŕňa aj elektroniku: skryté sledovacie zariadenia (skryté
  kamery, lokátory), e-cigarety, obranné prostriedky (paralyzéry, sprej).

Affiliate odkazy pravidlá **výslovne nespomínajú**, ani ako povolené, ani ako
zakázané.

### Precedensy v katalógu ChatGPT

**Zo sekundárnych zdrojov** (tlačové správy firiem a články):

| Služba | Od | Čo robí | Zdroj |
| --- | --- | --- | --- |
| idealo | 18. 3. 2026 | Porovnávač cien (AT, DE, FR, IT, ES, UK); posiela kupujúcich do obchodov, ktoré mu za návštevnosť platia | <https://www.ots.at/presseaussendung/OTM_20260318_OTM0014/fundierte-kaufentscheidungen-idealo-bringt-preisvergleich-in-chatgpt> |
| Klarna Shopping Search | 20. 5. 2026 | Ceny a dostupnosť z viacerých obchodov v 13 krajinách (ktorých, neuvádza); presmeruje do obchodu; „clearly labeled sponsored placements“ | <https://www.nasdaq.com/press-release/klarna-launches-ai-powered-shopping-search-app-chatgpt-2026-05-20> |
| Suri.cz | 30. 3. 2026 | Porovnávač povinného ručenia; výpočet beží na ich serveri, dokončenie na Suri.cz | <https://forbes.cz/prvni-ceska-aplikace-soucasti-chatgpt-suri-prinasi-srovnani-pojistek-do-ai-nastroje/> |
| Slevomat | 12. 5. 2026 | Ponuky zliav, vyvolá sa cez „@slevomat“ | <https://www.lupa.cz/aktuality/slevomat-ma-jako-jedna-z-prvnich-firem-vlastni-aplikaci-v-chatgpt-ai-muze-doporucovat-jeho-nabidku/> |

**Náš výklad:** OpenAI pustilo do katalógu porovnávače, ktoré zarábajú tým,
že posielajú kupujúcich do obchodov. Jeden z nich má aj platené pozície. Model
„porovnanie → preklik do obchodu“ teda sám o sebe nie je dôvod na zamietnutie.
Affiliate provízia je v princípe to isté ako platba idealu za preklik:
obchod platí za privedeného kupujúceho. Istota to nie je. Ide o veľké firmy,
nevieme, či nemali s OpenAI dohodu, a pravidlá sa od jari mohli sprísniť.

### Anthropic

**Overené.** Zdroj: <https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy>

Katalóg neprijme softvér, ktorý „serves advertisements, sponsored content,
paid product placements“ alebo ktorý „exists primarily as an advertising or
promotional vehicle“. Affiliate odkazy opäť nie sú spomenuté. Dokument
nehovorí, či sa pravidlá týkajú aj konektora, ktorý si používateľ pridá sám
mimo katalógu.

### Čo z toho plynie

Porovnávač, ktorý zarába na províziách z preklikov, je v sivej zóne, ale
precedensy idealo a Klarna ho posúvajú k povolenému. V náš prospech hovorí,
že ponuky radíme podľa ceny, nie podľa provízie, obchod si za umiestnenie
nemôže zaplatiť, partnerské odkazy priznávame a nákup prebieha v e-shope.
Proti nám, že každý odkaz na obchod je platený a bez provízií by služba
neexistovala.

Rozhodne až žiadosť o zaradenie alebo priama otázka na podporu.

## 4. Čo treba na zaradenie do katalógu ChatGPT

**Overené.** Zdroje: <https://developers.openai.com/plugins/deploy/submission>,
<https://developers.openai.com/plugins/deploy/app-review>

- Overenie totožnosti pre meno, pod ktorým sa plugin zverejní: jednotlivec
  (vlastné meno) alebo firma (obchodné meno). Neoverené meno znamená
  zamietnutie.
- Zverejnené zásady ochrany súkromia.
- Verejný HTTPS endpoint, transport `streamable-http`.
- Autentifikácia žiadna alebo OAuth; API kľúče v hlavičkách nie sú prípustné.
- Každý nástroj má anotácie `readOnlyHint`, `destructiveHint`
  a `openWorldHint` výslovne nastavené na `true` alebo `false`.
- Overenie domény cez `/.well-known/openai-apps-challenge`.
- 5 pozitívnych a 3 negatívne testovacie prípady, demo video.
- Pri obchode sa v žiadosti označí `review.commerce`.
- Po zverejnení OpenAI MCP server denne skenuje. Adresa MCP servera sa potom
  dá zmeniť len cez podporu.

**Zo sekundárnych zdrojov:** české firmy (Suri, Slevomat) schválením prešli.
Či prejde aj jednotlivec, nevieme; dokumentácia overenie jednotlivca pripúšťa.

Prototyp spĺňa technickú časť: MCP server je bezstavový cez streamable HTTP,
bez autentifikácie a nástroj má všetky tri anotácie. Chýba verejná doména
s HTTPS, zásady ochrany súkromia s uvedeným prevádzkovateľom, overenie domény
a **reálne dáta** (ukážku neprijmú).

## 5. Formát feedu Heureka

**Overené.** Zdroj: <https://heureka.github.io/xml-feed-specs>

- Koreň `SHOP`, položky `SHOPITEM`.
- Povinné: `ITEM_ID` (`[a-zA-Z0-9_-]{1,36}`), `PRODUCTNAME`, `URL`, `IMGURL`,
  `PRICE_VAT` (`\d+([.,]\d{1,2})?`), `CATEGORYTEXT`, `DELIVERY_DATE` (počet dní
  alebo dátum), `DELIVERY`.
- Nepovinné: `EAN` (13 číslic), `MANUFACTURER`, `PRODUCT`, `PARAM` a ďalšie.
- **Pôvodná ani prečiarknutá cena vo formáte nie je.**

**Dopad:** príklad zo zadania („zľava 30 % zo 740 €“) sa z feedu vyčítať nedá.
Zdanlivú zľavu vieme odhaliť len z vlastnej histórie cien, teda najskôr pár
týždňov po začiatku zberu. Tak je to aj naprogramované.

## 6. Affiliate siete

### Dognet

**Overené** vo všeobecných podmienkach (VOP z 26. 9. 2023) a v sekcii otázok.
Zdroje: <https://www.dognet.sk/vop/vop-sk-26092023.pdf>, <https://www.dognet.com/faq/>,
<https://www.dognet.com/magazine/about-dognet/commission-disbursement-process/>

Výplaty:

- Minimálna suma na výplatu je 100 €.
- Provízie vyplácajú aj fyzickej osobe bez živnosti na základe písomného
  vyhlásenia; podnikateľ fakturuje.
- Dane si rieši partner sám.

Čo hovoria podmienky o porovnávači:

- Partnerom môže byť výslovne aj prevádzkovateľ „porovnávacieho portálu“
  (čl. 1.6).
- Partner ponúka priestor „na svojich internetových webových stránkach,
  profile alebo skupine na sociálnej sieti alebo na inom mediálnom priestore,
  ktorý má v správe“ (čl. 3.4).
- Schválenie závisí od posúdenia webu: „profesionalita…, obsah, dizajn, rozsah
  internetovej prezentácie a celkový prínos“ (čl. 5.1).
- Kto používa XML feedy, musí kombinovať aspoň 3 feedy rôznych inzerentov
  a ponuku aktualizovať aspoň raz za 7 dní (čl. 7.14).
- Zakázaný je „redirectový traffic, teda presmerovanie domén na stránku
  Inzerenta“ a pop-up návštevnosť; výnimka len písomne (čl. 7.14).
- Partner nesmie zavádzať, napríklad „nepravdivo vysokými zľavami“
  a automaticky generovanými recenziami (čl. 7.14), ani „poškodzovať dobré meno
  Inzerenta“ (čl. 7.17).
- Údaje o kampaniach vrátane výsledkov sa nesmú odovzdať ani zverejniť tretím
  osobám; pokuta 15 000 € za každé porušenie (čl. 9.3). Výška provízie je
  obchodné tajomstvo (čl. 7.9).
- Dognet pri preklikoch spracúva cookies a IP adresy návštevníkov, aby
  vyhodnotil provízie (čl. 9.4).
- Priama spolupráca s inzerentom, ktorého sieť sprostredkovala, je obmedzená
  (čl. 14.5 a 14.6).

**Náš výklad, treba potvrdiť písomne pri registrácii:**

1. **AI chat ako „iný mediálny priestor“.** Text to nevylučuje, ale
   výslovne to nespomína.
2. **Údaje z feedov zobrazené cez ChatGPT.** Na webe je to bežné použitie
   feedu. Keď ich však MCP server odovzdá platforme tretej strany, dá sa to
   čítať ako odovzdanie údajov o kampani (čl. 9.3, pokuta 15 000 €).
3. **Upozornenie na zdanlivú zľavu s názvom obchodu.** Je to presný opak
   zakázaných „nepravdivo vysokých zliav“. Inzerent ho však môže vnímať ako
   poškodzovanie dobrého mena (čl. 7.17).
4. **Náš merací preklik `/redirect`.** Je to bežný odkaz na našej stránke,
   nie presmerovanie domény; zákaz v čl. 7.14 by sa ho týkať nemal.

### eHub

**Overené** na stránkach jednotlivých kampaní (<https://ehub.cz/en/wiki/start>).

- XML feed sa poskytuje na vyžiadanie pre konkrétnu kampaň.
- Provízie pri elektronike, ktoré sme videli: Sencor 3 %, Haier 8–15 %,
  iWant 0–0,8 %.

**Neoverené:** verejné podmienky pre partnerov sme nenašli. Obmedzenia zdroja
návštevnosti sa zrejme určujú pri jednotlivých kampaniach; treba sa opýtať pri
registrácii.

### Alza

**Zo zdrojov nižšie; pred registráciou si treba prečítať aktuálne znenie podmienok.**
Zdroj: <https://www.alza.cz/alza-affiliate-art15346.htm>

- Vlastný partnerský program mimo sietí.
- Každú adresu, kde sa odkazy používajú, treba nahlásiť; zmluvná pokuta je
  2 000 € za každé porušenie.
- Alza.at je v sieti CJ s platnosťou cookie 1 deň (zo sekundárnych zdrojov).

**Dopad:** odkazy v AI chate nie sú „adresa“, ktorá sa dá nahlásiť. Pri Alze
treba súhlas vopred a písomne, inak je riziko pokuty reálne.

### Spoločné

Provízie pri elektronike sú nízke, rádovo jednotky percent a pri niektorých
obchodoch pod 1 %. Pri objednávke za 500 € a provízii 3 % je to 15 €, pri
0,8 % iba 4 €.

## 7. Konkurencia

- **ChatGPT má vlastné nakupovanie.** Funkcia „Shopping research“ má pomocné
  stránky v slovenčine aj češtine.
  Zdroje: <https://openai.com/sk-SK/index/chatgpt-shopping-research/>,
  <https://help.openai.com/sk-sk/articles/12911370-using-shopping-research-in-chatgpt>
- **Obchody môžu posielať feedy priamo do ChatGPT** (Business Hub, s výberom
  krajín a mien). ChatGPT okrem feedov používa aj verejné webové zdroje.
  **Overené.** Zdroj: <https://developers.openai.com/commerce/guides/submit-product-feeds>
- **Porovnávače v ChatGPT už sú:** idealo a Klarna Shopping Search (kapitola 3).
  Idealo na Slovensku ani v Česku nepôsobí. Či Klarna pokrýva SK alebo CZ,
  sme neoverili.
- **České firmy v ChatGPT:** Slevomat a porovnávač poistenia Suri (kapitola 3).
- **Heureka** je podľa článkov nižšie štvrtým najcitovanejším zdrojom
  v ChatGPT a jej vedenie chce AI využiť, nie sa jej brániť. Má stráženie
  cien a podľa druhého článku chce zobrazovať aj to, čo je skutočná zľava.
  Vlastný plugin Heureky v ChatGPT sme k 17. 11. 2026 nenašli (len
  vyhľadávanie, neoverené).
  Zdroje: <https://forbes.cz/misto-kata-spojenec-heureku-mela-ai-zabit-jeji-sef-ma-ale-plan-se-na-ni-svezt/>,
  <https://cc.cz/heureka-chce-upozornit-na-realne-ceny-nove-ukaze-kolik-zbozi-stoji-u-konkurence-i-co-jsou-slevy-a-akce/>

**Dopad:** kanál je overený, ale okno „prvý na trhu“ sa zatvára. Heureka alebo
Klarna môžu do ChatGPT priniesť slovenské a české ceny s oveľa väčším
pokrytím. Naša odlišnosť musí byť v obsahu (história cien, zdanlivé zľavy),
nie v tom, že sme v chate.

## 8. Prototyp voči pravidlám katalógov

**Náš výklad.** Prototyp sa nemení; toto treba upraviť pred žiadosťou
o zaradenie (fáza 8).

| Čo | Stav v prototype | Riziko | Čo s tým |
| --- | --- | --- | --- |
| Pole `_ai_instruction` v odpovedi | Pokyny pre model: tabuľka, upozornenie na zdanlivú zľavu, priznanie affiliate, ponuka stráženia ceny | Posudzovateľ ho môže čítať ako pokusy riadiť model; ponuka stráženia ceny môže pôsobiť ako „redirect the interaction“ | Pred žiadosťou prečítať texty proti pravidlám, ponechať vecný obsah (priznanie affiliate, obmedzené pokrytie); zvážiť neutrálny názov poľa |
| Prekliky | `click_logs` ukladá čas, ponuku, obchod, produkt, zdroj a cenu, bez IP a prehliadača | Sieť pri preklike spracúva cookies a IP (VOP Dognet čl. 9.4) | Zásady ochrany súkromia uvádzajú IP adresu a cookies siete aj záznamy servera; doplniť poskytovateľa hostingu a službu na e-maily |
| Zakázaný tovar | Import berie celý feed | Skryté kamery, lokátory, e-cigarety či paralyzéry vo feede elektroniky | Pred žiadosťou vyradiť tieto kategórie pri importe |
| Názov | Cenoradar (od 17. 11.) | Všeobecný slovníkový názov katalóg neprijme | Vyriešené: nie je slovníkové slovo, v TMview nie je zhodná ochranná známka |
| Dáta | Ukážkové obchody | „Trial or demo plugins will not be accepted.“ | Žiadať až s reálnymi feedmi |
| Adresa MCP servera | Zatiaľ na Verceli, chránená prihlásením | Po zverejnení sa mení len cez podporu | Žiadať až s adresou na vlastnej doméne |

## 9. Údaje o prevádzkovateľovi na webe

**Overené** v znení účinnom od 1. 7. 2024; text novšieho znenia
(od 28. 6. 2025) sa nepodarilo načítať.
Zdroj: <https://static.slov-lex.sk/static/SK/ZZ/2004/22/20240701.html>

Zákon č. 22/2004 Z. z. o elektronickom obchode sa vzťahuje na každú fyzickú
alebo právnickú osobu, ktorá „na účely podnikania alebo na iné účely“
poskytuje službu na diaľku „spravidla za úhradu“ (§ 2). Poskytovateľ musí na
webe ľahko a trvalo sprístupniť (§ 4 ods. 1):

- fyzická osoba: meno, priezvisko, miesto podnikania a **adresu bydliska**;
  právnická osoba: názov a sídlo;
- adresu elektronickej pošty a **telefónne číslo**;
- DIČ, ak je platiteľom DPH, a register so zápisom, ak v ňom je;
- názov a adresu orgánu dozoru alebo dohľadu.

Dohľad vykonáva Slovenská obchodná inšpekcia (§ 7). Za porušenie zákona
môže uložiť pokutu od 50 € (§ 7a). Web ju preto uvádza na stránke `/o-nas`
s adresou ústredného inšpektorátu.

**Náš výklad:** porovnávač financovaný provízami je služba „za úhradu“, aj keď
používateľ nič neplatí. Pri prevádzke na fyzickú osobu teda na web patrí aj
adresa bydliska a telefón. Pred zverejnením webu je dobré overiť to
u účtovníka alebo právnika.

## 10. Recenzie produktov a hodnotenie obchodov

Nápad majiteľa zo 17. 11. 2026: zhrnúť, či má produkt prevažne kladné alebo
záporné recenzie, a ukázať, koľko hodnotení má obchod.

**Odkiaľ by boli dáta.** Feedy vo formáte Heureka recenzie ani hodnotenie
obchodu neobsahujú (kapitola 5). Recenzie sú na Heureke, v e-shopoch a na
Googli. Hodnotenie „Overené zákazníkmi“ obchod prepája so svojím webom cez
vlastný kľúč k Heureke.
Zdroj: <https://apps.shopify.com/heureka?locale=cs>

**AI asistenti to už robia sami.** ChatGPT od 24. 11. 2025 ponúka nákupný
prieskum („shopping research“): zostaví prehľad produktov s rozdielmi, cenami
a recenziami z webu, pre všetkých prihlásených používateľov.
Zdroj: <https://www.retaildive.com/news/openai-launches-chatgpt-shopping-research-feature/806656/>

**Pravidlá EÚ pre recenzie.** Smernica (EÚ) 2019/2161 (Omnibus) zakazuje
tvrdiť, že recenzie sú od skutočných zákazníkov, ak to obchodník primerane
neoverí, a zakazuje falošné alebo skreslené recenzie (príloha I k smernici
o nekalých obchodných praktikách, body 23b a 23c). Kto recenzie sprístupňuje,
musí uviesť, či a ako overuje, že pochádzajú od zákazníkov.
Zdroj: <https://www.legislation.gov.uk/eudr/2019/2161/article/3/data.htm>

**Náš výklad:**

- Recenzie z cudzích stránok by sme museli získať scrapingom, ktorý sme
  vylúčili, alebo dohodou. Databázy recenzií chráni aj právo k databáze
  a podmienky týchto služieb. Hodnotenie obchodu z Heureky by sme mohli
  ukazovať len so súhlasom obchodu a ak to dovolia podmienky Heureky; to sme
  neoverili.
- Zhrnutie recenzií v chate by zdvojovalo to, čo asistent urobí sám. Našou
  odlišnosťou ostáva to, čo asistent nezíska: lokálne ceny, ich história
  a zdanlivé zľavy.
- Vlastné recenzie od používateľov nemáme od koho zbierať, kým nemáme
  návštevnosť, a nákup overiť nevieme; podľa smernice by sme to museli
  priznať.
- Vlastný ukazovateľ obchodu z histórie cien (napríklad ako často robí
  zdanlivé zľavy) by bol jedinečný, ale podmienky sietí zakazujú poškodzovať
  dobré meno inzerenta (kapitola 6).
- Odporúčanie: do MVP nie. Vrátiť sa k tomu po spustení, keď budú partnerské
  obchody a návštevnosť.

## 11. Čo ostáva overiť

| Otázka | Kto a ako |
| --- | --- |
| Vidí používateľ zo Slovenska v ChatGPT katalóg pluginov a dá sa v jeho pláne pridať vlastný MCP server? | Majiteľ: v ChatGPT otvoriť sekciu aplikácií alebo pluginov, vyhľadať napríklad „idealo“ alebo „Slevomat“ a pozrieť nastavenia konektorov. Pár minút. |
| Pokrýva Klarna Shopping Search Slovensko alebo Česko? | Majiteľ: v ChatGPT pripojiť Klarnu a opýtať sa na cenu v SK. |
| Platí dátum 11. 12. 2026 a čo presne nahrádza Actions? | Majiteľ: otvoriť stránku OpenAI v prehliadači. Pre nás to už nič nemení, MCP je pripravené. |
| Považuje OpenAI affiliate odkazy za reklamu? | Otázka na podporu OpenAI alebo rovno žiadosť o zaradenie (až s reálnymi dátami). |
| Prejde žiadosťou jednotlivec, alebo treba firmu? | Pri overení totožnosti v OpenAI Platform; súvisí s rozhodnutím, na koho sa registrovať. |
| Body 1 až 4 z kapitoly 6 pre Dognet | Písomne pri registrácii v Dognete. |
| Pravidlá eHubu pre zdroj návštevnosti | Pri registrácii v eHube. |
| Súhlas Alzy s odkazmi v AI chate | Písomne pred použitím odkazov. |
