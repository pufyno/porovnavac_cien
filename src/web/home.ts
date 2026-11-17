import { html } from 'hono/html';
import { searchForm } from './components.ts';
import { icon } from './icons.ts';
import type { Html } from './layout.ts';

/**
 * Ilustračný príklad zdanlivej zľavy: 515 €, týždeň 740 €, potom 519 €
 * „so zľavou 30 %“. Os y: 515 € → 150, 740 € → 48 (0,4533 px/€); os x:
 * 60 dní na 12 až 508. Obchody aj ceny sú vymyslené, nič neodkazuje do obchodu.
 */
const exampleChart = html`<svg class="example-chart" viewBox="0 0 520 244" role="img"
  aria-label="Graf ceny v Obchode Beta za 60 dní: 515 eur, týždeň 740 eur a potom 519 eur so zľavou 30 percent.">
  <rect x="392.3" y="48" width="57.8" height="152" fill="#FF7A6E" fill-opacity="0.12" />
  <line x1="12" y1="200" x2="508" y2="200" stroke="#24314D" stroke-width="1.5" />
  <line x1="12" y1="150" x2="508" y2="150" stroke="#5B6B86" stroke-width="1.5" stroke-dasharray="5 5" />
  <path d="M12 150 H392.3 V48 H450.1 V148.2 H508" fill="none" stroke="#FF8F84" stroke-width="3"
    stroke-linejoin="round" />
  <circle cx="508" cy="148.2" r="5.5" fill="#FF8F84" stroke="#131D33" stroke-width="3" />
  <text x="421.2" y="34" text-anchor="middle" class="t-peak">740 €</text>
  <text x="14" y="138">cena pred akciou 515 €</text>
  <text x="508" y="184" text-anchor="end" class="t-coral"><tspan font-weight="700">519 €</tspan> „zľava −30 %“</text>
  <text x="12" y="236" class="t-axis">pred 60 dňami</text>
  <text x="508" y="236" text-anchor="end" class="t-axis">dnes</text>
</svg>`;

const features = [
  {
    icon: 'tag',
    title: 'Kde je najlacnejšie',
    text: 'Ceny a dostupnosť z partnerských obchodov na jednom mieste, zoradené len podľa ceny.',
  },
  {
    icon: 'chart-line',
    title: 'Či je cena dobrá',
    text: 'Porovnáme ju s priemerom za 30 a 90 dní a s najnižšou cenou za 90 dní. Povieme, či kúpiť teraz, alebo počkať.',
  },
  {
    icon: 'shield-alert',
    title: 'Či je zľava skutočná',
    text: 'Upozorníme, keď obchod pred akciou cenu zdvihol, aby zľava vyzerala väčšia.',
  },
] as const;

export function homeBody(siteName: string): Html {
  return html`<section class="hero dark">
      <div class="radar" aria-hidden="true"></div>
      <div class="wrap hero-grid">
        <div class="hero-copy">
          <p class="kicker"><span class="dot"></span>Porovnávač cien elektroniky · Slovensko a Česko</p>
          <h1>Je to <span class="accent">naozaj</span> zľava?</h1>
          <p class="lead">
            ${siteName} každý deň sleduje ceny elektroniky v e-shopoch. Ukáže, kde je produkt najlacnejší, či je cena
            dobrá a kedy obchod pred „akciou“ cenu zdvihol.
          </p>
          ${searchForm('', 'SK')}
          <ul class="trust">
            <li>${icon('check', 18)}Bez registrácie</li>
            <li>${icon('check', 18)}Poradie ponúk len podľa ceny</li>
            <li>${icon('check', 18)}História cien za 90 dní</li>
          </ul>
        </div>
        <div class="example">
          <div class="example-head">
            <div>
              <p class="example-kicker">Ilustračný príklad</p>
              <p class="example-title">Robotický vysávač</p>
              <p class="example-sub">Obchod Beta · posledných 60 dní</p>
            </div>
            <span class="badge badge-bad-dark">${icon('alert-triangle', 16)}Zdanlivá zľava</span>
          </div>
          <figure class="example-figure">
            ${exampleChart}
            <figcaption>
              Týždeň pred „akciou“ obchod zdvihol cenu z 515 € na 740 €. Zľava 30 % sa počíta z navýšenej ceny.
            </figcaption>
          </figure>
          <div class="example-foot">
            <span class="badge badge-good-dark">${icon('check', 16)}Dobrá cena</span>
            <p><strong class="num">489 €</strong> v Obchode Alfa, najnižšia za 90 dní</p>
            <a href="/ako-to-funguje">Ako to počítame${icon('arrow-right', 16)}</a>
          </div>
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="pomoc">
      <div class="wrap">
        <p class="eyebrow">Ako vám ${siteName} pomôže</p>
        <h2 id="pomoc">Pri každom produkte zistíte tri veci</h2>
        <ul class="features">
          ${features.map(
            (feature) => html`<li class="feature">
              <span class="feature-icon">${icon(feature.icon, 24)}</span>
              <h3>${feature.title}</h3>
              <p>${feature.text}</p>
            </li>`,
          )}
        </ul>
      </div>
    </section>

    <section class="section section-white" aria-labelledby="ai">
      <div class="wrap ai-grid">
        <div class="ai-copy">
          <p class="eyebrow">Priamo v AI chate</p>
          <h2 id="ai">Pýtajte sa v ChatGPT alebo Claude. Ceny dodá ${siteName}.</h2>
          <p>
            Pripojte si ${siteName} do AI chatu a pýtajte sa bežnou vetou. Asistent dostane aktuálne ceny a ich
            históriu priamo od nás, nemusí ich odhadovať.
          </p>
          <ol class="steps">
            <li>V chate otvorte nastavenia aplikácií alebo konektorov.</li>
            <li>Pridajte ${siteName} podľa nášho návodu.</li>
            <li>Opýtajte sa, napríklad: „Oplatí sa teraz kúpiť…?“</li>
          </ol>
          <a class="button" href="/pre-ai-asistentov">Návod na pripojenie${icon('arrow-right', 18)}</a>
        </div>
        <figure class="chat-demo">
          <div class="chat-bar" aria-hidden="true"><i></i><i></i><i></i><span>AI chat</span></div>
          <div class="chat-body">
            <p class="bubble bubble-user">
              Oplatí sa teraz kúpiť robotický vysávač v Obchode Beta za 519 €? Píšu, že je zľava 30 %.
            </p>
            <div class="bubble bubble-ai">
              <p>
                ${siteName} ukazuje, že ide o <strong>zdanlivú zľavu</strong>. Týždeň pred akciou stál 515 €, potom ho
                obchod zdvihol na 740 € a zľavu počíta z tejto ceny.
              </p>
              <p>Rovnaký model má Obchod Alfa za 489 €, najlacnejšie za posledných 90 dní.</p>
              <div class="chat-card">
                <span class="badge badge-good-dark">${icon('check', 16)}Dobrá cena</span>
                <span><strong class="num">489 €</strong> · Obchod Alfa · skladom</span>
              </div>
            </div>
          </div>
          <figcaption>Ukážka rozhovoru. Obchody a ceny sú vymyslené.</figcaption>
        </figure>
      </div>
    </section>

    <section class="alert-band dark" aria-labelledby="strazenie">
      <div class="radar radar-left" aria-hidden="true"></div>
      <div class="wrap alert-grid">
        <div class="alert-copy">
          <h2 id="strazenie">Cena je zatiaľ vysoká? Nechajte ju strážiť.</h2>
          <p>Pri produkte zadáte cenu, ktorú chcete zaplatiť. Keď na ňu klesne, pošleme vám e-mail. Bez registrácie.</p>
          <a class="button button-accent" href="/hladat">Vybrať produkt na stráženie${icon('arrow-right', 18)}</a>
        </div>
        <figure class="mail-sample">
          <div class="mail-head"><span class="icon-tile">${icon('bell', 18)}</span>Stráženie ceny</div>
          <p class="mail-title">Bezdrôtové slúchadlá teraz za 279 €</p>
          <p>Cena klesla na 279 €. Vaša cieľová cena bola 280 €. Najlacnejšia ponuka: Obchod Beta, skladom.</p>
          <figcaption>Ukážka e-mailu</figcaption>
        </figure>
      </div>
    </section>

    <section class="section" aria-labelledby="zarabame">
      <div class="wrap">
        <div class="money">
          <span class="feature-icon">${icon('scale', 24)}</span>
          <div>
            <h2 id="zarabame">Ako zarábame</h2>
            <p>
              Keď cez nás nakúpite, obchod nám môže zaplatiť províziu. Cenu pre vás to nemení a poradie ponúk určuje
              len cena. Porovnávame len obchody, s ktorými spolupracujeme.
            </p>
            <a href="/affiliate">Viac o tom, ako zarábame${icon('arrow-right', 16)}</a>
          </div>
        </div>
      </div>
    </section>`;
}
