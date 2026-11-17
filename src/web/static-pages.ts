import { html } from 'hono/html';
import type { AppConfig } from '../config.ts';
import type { Html } from './layout.ts';

interface StaticPage {
  path: string;
  title: string;
  description: string;
  body: (config: AppConfig) => Html;
}

/** Viditeľné označenie textu, ktorý musí pred zverejnením doplniť prevádzkovateľ. */
const todo = (what: string) => html`<mark>[DOPLNIŤ: ${what}]</mark>`;

const draftNotice = html`<div class="box warn">
  <strong>Pracovná verzia.</strong> Tento text je návrh. Pred zverejnením treba doplniť označené údaje
  a dať ho skontrolovať.
</div>`;

export const STATIC_PAGES: StaticPage[] = [
  {
    path: '/ako-to-funguje',
    title: 'Ako to funguje',
    description: 'Odkiaľ berieme ceny, ako počítame priemery a ako spoznáme zdanlivú zľavu.',
    body: () => html`<h1>Ako to funguje</h1>
      <h2>Odkiaľ sú ceny</h2>
      <p>
        Ceny a dostupnosť berieme z oficiálnych produktových feedov, ktoré e-shopy samy poskytujú svojim
        partnerom. Stránky obchodov neprehľadávame. Údaje aktualizujeme raz denne, preto si konečnú cenu vždy
        overte priamo v obchode.
      </p>
      <p>
        Porovnávame len obchody, s ktorými spolupracujeme. Inde môže byť cena nižšia; pri každom produkte
        uvádzame, koľko obchodov sme porovnali.
      </p>
      <h2>História ceny a odporúčanie</h2>
      <p>
        Pri každom produkte si denne zapisujeme najnižšiu cenu. Z nej počítame priemer za posledných 30 a 90 dní
        a aktuálnu cenu s ním porovnávame:
      </p>
      <ul>
        <li><strong>Dobrá cena</strong>: aspoň 5 % pod priemerom.</li>
        <li><strong>Bežná cena</strong>: do 5 % od priemeru.</li>
        <li><strong>Radšej počkať</strong>: aspoň 5 % nad priemerom.</li>
      </ul>
      <p>
        Kým produkt nesledujeme aspoň 14 dní, odporúčanie nedávame. Je to odhad z minulých cien, nie záruka,
        že cena ešte neklesne.
      </p>
      <h2>Zdanlivé zľavy</h2>
      <p>
        Niektoré „akcie“ vznikajú tak, že obchod cenu nakrátko zvýši a potom ju vráti na pôvodnú úroveň so
        zľavovým štítkom. Keďže si pamätáme ceny pred akciou, takú zľavu označíme a ukážeme, koľko produkt stál
        predtým. Upozornenie dáme vtedy, keď zvýšenie trvalo najviac tri týždne, bolo aspoň o 8 % a „zľavnená“
        cena je prakticky rovnaká ako pred ním.
      </p>
      <h2>Stráženie ceny</h2>
      <p>
        Ak sa vám cena zdá vysoká, zadajte cenu, pri ktorej máte záujem, a e-mail. Keď cena klesne, pošleme
        vám jednu správu. Stráženie treba potvrdiť odkazom z e-mailu a dá sa kedykoľvek zrušiť.
      </p>`,
  },
  {
    path: '/pre-ai-asistentov',
    title: 'Ceny priamo v AI chate',
    description: 'Ako sa na ceny elektroniky pýtať v ChatGPT, Claude alebo Gemini.',
    body: (config) => html`<h1>Ceny priamo v AI chate</h1>
      <p>
        AI asistenti nepoznajú aktuálne ceny v slovenských a českých obchodoch ani to, či je zľava skutočná.
        Naša služba im tieto údaje dodá. Stačí sa opýtať bežnou vetou, napríklad „Kde kúpim najlacnejšie
        Roborock S8 a je tá zľava reálna?“
      </p>
      <h2>Pripojenie</h2>
      <p>Službu pripojíte ako vlastný konektor (MCP server) v nastaveniach svojho asistenta:</p>
      <p><code>${config.publicBaseUrl}/mcp</code></p>
      <p>
        Pre nástroje, ktoré používajú popis rozhrania OpenAPI:
        <code>${config.publicBaseUrl}/openapi.json</code>
      </p>
      <p class="muted">Zaradenie do oficiálnych katalógov asistentov pripravujeme.</p>
      <h2>Čo asistent dostane</h2>
      <ul>
        <li>ponuky obchodov s cenou a dostupnosťou,</li>
        <li>priemernú cenu za 30 a 90 dní a odporúčanie, či kúpiť teraz,</li>
        <li>upozornenie na zdanlivú zľavu,</li>
        <li>odkaz na nastavenie stráženia ceny.</li>
      </ul>
      <p>
        Odkazy do obchodov sú partnerské a asistent má pokyn to pri odpovedi uviesť.
        <a href="/affiliate">Ako zarábame</a>
      </p>`,
  },
  {
    path: '/affiliate',
    title: 'Ako zarábame',
    description: 'Odkazy do e-shopov sú partnerské. Čo to znamená pre vás.',
    body: () => html`<h1>Ako zarábame</h1>
      <p>
        Služba je pre používateľov bezplatná. Odkazy do e-shopov sú partnerské (affiliate): ak cez ne prejdete
        do obchodu a nakúpite, obchod nám môže vyplatiť províziu. Cena, ktorú zaplatíte, je rovnaká, ako keby
        ste do obchodu prišli priamo.
      </p>
      <h2>Čo provízia neovplyvňuje</h2>
      <ul>
        <li>Ponuky radíme podľa ceny, nie podľa výšky provízie.</li>
        <li>Odporúčanie a upozornenie na zdanlivú zľavu sa počítajú len z cien.</li>
        <li>Za lepšie umiestnenie sa u nás nedá zaplatiť.</li>
      </ul>
      <h2>Čo ovplyvňuje</h2>
      <p>
        Porovnávame len obchody, ktoré majú partnerský program a s ktorými spolupracujeme. Obchod, ktorý
        v zozname chýba, môže mať cenu nižšiu.
      </p>`,
  },
  {
    path: '/o-nas',
    title: 'O službe a kontakt',
    description: 'Kto službu prevádzkuje a ako nás kontaktovať.',
    body: () => html`<h1>O službe a kontakt</h1>
      ${draftNotice}
      <p>
        Porovnávame ceny elektroniky v slovenských a českých e-shopoch, sledujeme ich vývoj a upozorňujeme na
        zdanlivé zľavy.
      </p>
      <h2>Prevádzkovateľ</h2>
      <p>${todo('meno alebo obchodné meno, adresa, IČO')}</p>
      <h2>Kontakt</h2>
      <p>${todo('kontaktný e-mail')}</p>`,
  },
  {
    path: '/ochrana-sukromia',
    title: 'Ochrana súkromia',
    description: 'Aké údaje spracúvame, prečo a ako dlho.',
    body: () => html`<h1>Ochrana súkromia</h1>
      ${draftNotice}
      <h2>Kto údaje spracúva</h2>
      <p>${todo('prevádzkovateľ a kontakt pre otázky k osobným údajom')}</p>
      <h2>Stráženie ceny</h2>
      <p>
        Keď si nastavíte stráženie ceny, uložíme váš e-mail, produkt a cieľovú cenu. E-mail použijeme len na
        potvrdenie stráženia a na jednu správu, keď cena klesne. Nepoužívame ho na reklamu a nikomu ho
        neposkytujeme, okrem služby, ktorá e-maily technicky odosiela: ${todo('názov služby na odosielanie e-mailov')}.
      </p>
      <ul>
        <li>Nepotvrdené stráženie zmažeme do 7 dní.</li>
        <li>Ukončené alebo zrušené stráženie zmažeme do 30 dní.</li>
        <li>Stráženie zrušíte odkazom, ktorý je v každom našom e-maile.</li>
      </ul>
      <p>Právnym základom je váš súhlas, ktorý dávate potvrdením odkazu v e-maile.</p>
      <h2>Prekliky do obchodov</h2>
      <p>
        Pri prekliku do obchodu si zapíšeme, na ktorú ponuku ste klikli, kedy a z akého zdroja (napríklad web
        alebo AI asistent). Záznam neobsahuje vašu IP adresu ani iný údaj, podľa ktorého by sme vás vedeli
        identifikovať. Obchod a partnerská sieť môžu po prekliku používať vlastné cookies podľa svojich
        pravidiel.
      </p>
      <h2>Cookies a analytika</h2>
      <p>Tento web nepoužíva cookies ani analytické nástroje tretích strán.</p>
      <h2>Vaše práva</h2>
      <p>
        Máte právo na prístup k údajom, ich opravu a vymazanie, na odvolanie súhlasu a na podanie sťažnosti
        na Úrad na ochranu osobných údajov SR. ${todo('kontakt, kam žiadosti posielať')}
      </p>`,
  },
];
