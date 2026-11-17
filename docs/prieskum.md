# Prieskum: distribúcia v AI chatoch, siete a konkurencia

Stav k 17. 11. 2026. Tento dokument zhŕňa, čo sme zistili o predpokladoch
zadania. Rozhodnutia, ktoré z toho vyplývajú, sú v [projekt.md](projekt.md).

Pri každom zistení je uvedené, ako veľmi sa naň dá spoľahnúť:

- **Overené** – prečítané priamo v primárnom zdroji.
- **Zo sekundárnych zdrojov** – zhodne to uvádza viac článkov, primárny zdroj
  sa nepodarilo otvoriť.
- **Neoverené** – jeden zdroj alebo náznak; pred rozhodnutím treba overiť.

## 1. ChatGPT ruší vlastné GPT s Actions

**Zo sekundárnych zdrojov.** OpenAI k 11. 12. 2026 končí s vlastnými GPT.
Vlastné Actions (volanie REST API podľa OpenAPI) sa nemigrujú. Náhradou sú
pluginy, ktoré sa k vlastnému backendu pripájajú cez **MCP server**.

Oficiálna stránka OpenAI s otázkami a odpoveďami pri pokuse o načítanie
vrátila chybu 403, preto dátum stojí na zhode viacerých článkov:

- <https://help.openai.com/en/articles/20001519-custom-gpt-retirement-and-migration-faq> (primárny zdroj, nepodarilo sa načítať)
- <https://virtualizationreview.com/articles/2026/09/28/openai-to-retire-custom-gpts-replace-them-with-plugins.aspx>
- <https://campustechnology.com/articles/2026/10/05/openai-discontinuing-custom-gpts-and-moving-to-plugin-architecture.aspx>
- <https://www.edtechinnovationhub.com/news/openai-to-retire-custom-gpts-in-december-as-creators-move-to-plugins>
- <https://www.developersdigest.tech/blog/custom-gpt-retirement-migrate-to-plugins>

**Dopad:** zadanie počítalo s „ChatGPT Custom Actions“ ako hlavným kanálom.
Ten zaniká skôr, než by sme stihli spustiť. Hlavným rozhraním je preto MCP
server; REST API s OpenAPI ostáva ako druhé rozhranie pre nástroje, ktoré ho
používajú.

**Gemini – neoverené.** Jeden sekundárny zdroj uvádza, že Gemini prijíma
adresu vlastného MCP servera. Treba overiť v dokumentácii Google pred fázou
distribúcie.

## 2. Pravidlá katalógov: zákaz reklamy

Toto je najväčšie riziko obchodného modelu.

### OpenAI

**Overené.** Zdroj: <https://developers.openai.com/apps-sdk/app-developer-guidelines>

- „Plugins must not serve advertisements and must not exist primarily as an
  advertising vehicle.“
- Obchod je povolený len pre fyzický tovar.
- „Plugins should use external checkout, directing users to complete purchases
  on your own domain.“
- Plugin nesmie „Link directly to a checkout or other transactional page“.
- „Do not scrape external websites, relay queries, or integrate with
  third-party APIs without proper authorization.“
- „We cannot approve plugins that primarily function as unofficial connectors
  to third-party services.“

Affiliate odkazy pravidlá **výslovne nespomínajú**, ani ako povolené, ani ako
zakázané.

### Anthropic

**Overené.** Zdroj: <https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy>

Katalóg neprijme softvér, ktorý „serves advertisements, sponsored content,
paid product placements“ alebo ktorý „exists primarily as an advertising or
promotional vehicle“. Affiliate odkazy opäť nie sú spomenuté. Dokument
nehovorí, či sa pravidlá týkajú aj konektora, ktorý si používateľ pridá sám
mimo katalógu.

### Čo z toho plynie

Porovnávač, ktorý zarába na províziách z preklikov, je v sivej zóne. V náš
prospech hovorí, že ponuky radíme podľa ceny, nie podľa provízie, obchod si za
umiestnenie nemôže zaplatiť a nákup prebieha v e-shope, nie u nás. Proti nám,
že každý odkaz na obchod je platený a bez provízií by služba neexistovala.

Rozhodnúť to môže len žiadosť o zaradenie alebo priama otázka na podporu.
Pripojenie cez vlastný konektor (používateľ si zadá adresu MCP servera sám)
schválenie nepotrebuje, ale má oveľa menší dosah.

## 3. Čo treba na zaradenie do katalógu ChatGPT

**Overené.** Zdroj: <https://developers.openai.com/plugins/deploy/submission>

- Overený jednotlivec alebo organizácia.
- Zverejnené zásady ochrany súkromia.
- Verejný HTTPS endpoint, transport `streamable-http`.
- Autentifikácia žiadna alebo OAuth; API kľúče v hlavičkách nie sú prípustné.
- Každý nástroj má anotácie `readOnlyHint`, `destructiveHint`
  a `openWorldHint` výslovne nastavené na `true` alebo `false`.
- Overenie domény cez `/.well-known/openai-apps-challenge`.
- 5 pozitívnych a 3 negatívne testovacie prípady, demo video.

**Neoverené:** či sa môže prihlásiť vývojár zo Slovenska alebo Česka. Zdroj
to neuvádza.

Prototyp spĺňa technickú časť: MCP server je bezstavový cez streamable HTTP,
bez autentifikácie a nástroj má všetky tri anotácie. Chýba verejná doména
s HTTPS, zásady ochrany súkromia s uvedeným prevádzkovateľom a overenie domény.

## 4. Formát feedu Heureka

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

## 5. Affiliate siete

### Dognet

**Overené** vo všeobecných podmienkach a v sekcii otázok.
Zdroje: <https://www.dognet.com/faq/>, <https://www.dognet.sk/vop/vop-sk-26092023.pdf>,
<https://www.dognet.com/magazine/about-dognet/commission-disbursement-process/>

- Minimálna suma na výplatu je 100 €.
- Provízie vyplácajú aj fyzickej osobe bez živnosti na základe písomného
  vyhlásenia; podnikateľ fakturuje.
- Dane si rieši partner sám.

### eHub

**Overené** na stránkach jednotlivých kampaní (<https://ehub.cz/en/wiki/start>).

- XML feed sa poskytuje na vyžiadanie pre konkrétnu kampaň.
- Provízie pri elektronike, ktoré sme videli: Sencor 3 %, Haier 8–15 %,
  iWant 0–0,8 %.

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

## 6. Konkurencia

- **ChatGPT má vlastné nakupovanie.** Funkcia „Shopping research“ má pomocné
  stránky v slovenčine aj češtine.
  Zdroje: <https://openai.com/sk-SK/index/chatgpt-shopping-research/>,
  <https://help.openai.com/sk-sk/articles/12911370-using-shopping-research-in-chatgpt>
- **České firmy už v ChatGPT sú.** Slevomat a porovnávač poistenia Suri.
  Zdroje: <https://www.lupa.cz/aktuality/slevomat-ma-jako-jedna-z-prvnich-firem-vlastni-aplikaci-v-chatgpt-ai-muze-doporucovat-jeho-nabidku/>,
  <https://forbes.cz/prvni-ceska-aplikace-soucasti-chatgpt-suri-prinasi-srovnani-pojistek-do-ai-nastroje/>
- **Heureka** je podľa uvedených článkov štvrtým najcitovanejším zdrojom
  v ChatGPT a jej vedenie chce AI využiť, nie sa jej brániť. Má stráženie
  cien a podľa druhého článku chce zobrazovať aj to, čo je skutočná zľava.
  Zdroje: <https://forbes.cz/misto-kata-spojenec-heureku-mela-ai-zabit-jeji-sef-ma-ale-plan-se-na-ni-svezt/>,
  <https://cc.cz/heureka-chce-upozornit-na-realne-ceny-nove-ukaze-kolik-zbozi-stoji-u-konkurence-i-co-jsou-slevy-a-akce/>

**Dopad:** to, že Slevomat a Suri v ChatGPT sú, ukazuje, že česká komerčná
služba sa do katalógu dostať dá. Zároveň to znamená, že okno „prvý na trhu“
sa zatvára a naša odlišnosť musí byť v obsahu (história cien, zdanlivé
zľavy), nie v tom, že sme v chate.

## 7. Čo ostáva overiť

| Otázka | Ako overiť |
| --- | --- |
| Platí dátum 11. 12. 2026 a čo presne nahrádza Actions? | Otvoriť stránku OpenAI v prehliadači. |
| Považuje OpenAI a Anthropic affiliate odkazy za reklamu? | Otázka na podporu alebo žiadosť o zaradenie. |
| Môže sa do katalógu ChatGPT prihlásiť vývojár zo SK/CZ? | Skúsiť overenie účtu vývojára. |
| Podporuje Gemini vlastný MCP server pre bežných používateľov? | Dokumentácia Google. |
| Povolia siete a inzerenti odkazy v AI chate ako zdroj návštevnosti? | Otázka pri registrácii, pri Alze písomne. |
