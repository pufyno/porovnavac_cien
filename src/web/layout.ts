import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import type { Country } from '../compare/schema.ts';
import { searchForm } from './components.ts';
import { icon, logo } from './icons.ts';

export type Html = HtmlEscapedString | Promise<HtmlEscapedString>;

/** Čo stránka potrebuje z konfigurácie; AppConfig to spĺňa. */
export interface Site {
  siteName: string;
  publicBaseUrl: string;
}

/** Rozsahy znakov podľa CSS Fontsource 5.3.0. Slovenčina potrebuje obe sady. */
const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,' +
  'U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,' +
  'U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

const fontFace = (family: string, file: string, weight: string, range: string) =>
  `@font-face{font-family:"${family}";font-style:normal;font-display:swap;font-weight:${weight};` +
  `src:url(/fonts/${file}) format("woff2");unicode-range:${range}}`;

const FONTS = [
  fontFace('Inter', 'inter-v20-latin-wght.woff2', '100 900', LATIN),
  fontFace('Inter', 'inter-v20-latin-ext-wght.woff2', '100 900', LATIN_EXT),
  fontFace('Space Grotesk', 'space-grotesk-v22-latin-wght.woff2', '300 700', LATIN),
  fontFace('Space Grotesk', 'space-grotesk-v22-latin-ext-wght.woff2', '300 700', LATIN_EXT),
].join('\n');

/**
 * Smer A „Radar“ (docs/projekt.md, kapitola 4). Všetky štýly sú tu, web nemá
 * iný súbor CSS. Kontrast textu aspoň 4,5 : 1, okraje polí aspoň 3 : 1.
 */
const BASE = `
:root{
  --navy:#0B1220;--surface:#131D33;--line-dark:#24314D;--line-dark-soft:#1C2740;--field-dark:#5B6B86;
  --accent:#35E0A1;--accent-hover:#5CE9B6;
  --on-dark:#EEF3FB;--on-dark-strong:#F4F7FC;--on-dark-2:#C9D4E5;--on-dark-3:#B8C5D9;--on-dark-muted:#A3B3CC;
  --coral:#FF8F84;--mint:#4BE3A6;
  --bg:#F3F6FA;--card:#FFFFFF;--border:#DFE5EE;--field:#7D8AA1;
  --ink:#0B1220;--ink-2:#24314D;--muted:#4E5B72;
  --good:#0B7A55;--good-bg:#DDF6EC;--wait:#A1520B;--wait-bg:#FDF0DF;--bad:#8A1C12;--bad-bg:#FDECEA;--bad-icon:#B42318;
  --focus:#0B7A55;
  --font:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --display:"Space Grotesk","Inter",system-ui,sans-serif;
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;font:16px/1.6 var(--font);color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:var(--display);font-weight:700;letter-spacing:-.02em;line-height:1.15;margin:0 0 .5em}
p{margin:0 0 1em}
a{color:var(--good);text-underline-offset:.15em}
a:hover{text-decoration-thickness:2px}
:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.dark :focus-visible{outline-color:var(--accent)}
.wrap{width:100%;max-width:1160px;margin:0 auto;padding-left:16px;padding-right:16px}
@media (min-width:640px){.wrap{padding-left:24px;padding-right:24px}}
.icon,.logo{flex-shrink:0}
.num{font-variant-numeric:tabular-nums}
.muted{color:var(--muted)}
.visually-hidden{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
.skip{position:absolute;left:16px;top:-80px;z-index:50;padding:12px 16px;border-radius:10px;background:var(--accent);color:var(--navy);font-weight:700;text-decoration:none}
.skip:focus{top:12px}
mark{background:#FFF1B8;color:var(--ink);padding:0 .25em;border-radius:4px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.1em .4em;overflow-wrap:anywhere}
.box{background:var(--bg);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin:16px 0}
.warn{background:var(--bad-bg);border-color:#F4C7C1;color:var(--bad)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
`;

const FORMS = `
label{display:block;margin:20px 0 6px;font-weight:600}
input[type=text],input[type=email],input[type=search],select{font:inherit;color:var(--ink);background:var(--card);border:1px solid var(--field);border-radius:12px;min-height:48px;padding:0 14px;max-width:100%}
input[type=text],input[type=email],input[type=search]{-webkit-appearance:none;appearance:none}
input[type=text],input[type=email]{width:100%}
input::placeholder{color:#5E6B84;opacity:1}
button,.button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 20px;border:1.5px solid var(--navy);border-radius:12px;background:var(--navy);color:#fff;font:600 16px/1.2 var(--font);text-decoration:none;cursor:pointer;transition:background-color .15s,border-color .15s}
button:hover,.button:hover{background:var(--ink-2);border-color:var(--ink-2)}
.button-accent{background:var(--accent);border-color:var(--accent);color:var(--navy)}
.button-accent:hover{background:var(--accent-hover);border-color:var(--accent-hover)}
.button-outline{background:var(--card);color:var(--navy)}
.button-outline:hover{background:var(--bg);border-color:var(--navy)}
.search-full{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px;background:var(--card);border:1px solid var(--field);border-radius:18px;box-shadow:0 12px 32px rgba(11,18,32,.10)}
.search-full .search-icon{display:flex;padding-left:8px;color:var(--muted)}
.search-full input[type=search]{flex:1 1 200px;min-width:0;min-height:52px;padding:0 8px;border:0;background:transparent;font-size:18px}
.search-full select{min-height:52px;background:var(--bg)}
.search-full button{min-height:52px;padding:0 24px}
@media (max-width:559px){
  .search-full .search-icon{display:none}
  .search-full input[type=search]{flex-basis:100%;border-bottom:1px solid var(--border);border-radius:10px 10px 0 0}
  .search-full select,.search-full button{flex:1 1 0}
}
`;

const CHROME = `
.site-header{position:relative;background:var(--navy);color:var(--on-dark);border-bottom:1px solid var(--line-dark-soft)}
.header-row{display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px;min-height:72px;padding-top:12px;padding-bottom:12px}
.brand{display:inline-flex;align-items:center;gap:10px;color:var(--on-dark-strong);text-decoration:none;font:700 22px/1 var(--display);letter-spacing:-.02em}
.nav-desktop{display:flex;align-items:center;gap:4px;margin-left:auto}
.nav-desktop a{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;border-radius:12px;color:var(--on-dark-2);font-weight:500;text-decoration:none}
.nav-desktop a:hover{color:var(--on-dark-strong);background:var(--surface)}
.nav-desktop .pill{margin-left:4px;border:1px solid var(--line-dark);color:var(--on-dark-strong)}
.nav-desktop .pill .icon{color:var(--accent)}
.nav-mobile{display:none;margin-left:auto}
.nav-mobile summary{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border:1px solid var(--line-dark);border-radius:12px;color:var(--on-dark-strong);font-weight:600;cursor:pointer;list-style:none}
.nav-mobile summary::-webkit-details-marker{display:none}
.nav-mobile[open] summary{background:var(--surface)}
.nav-mobile nav{position:absolute;left:0;right:0;top:100%;z-index:30;display:grid;padding:8px 16px 16px;background:var(--surface);border-bottom:1px solid var(--line-dark);box-shadow:0 24px 40px rgba(3,8,20,.45)}
.nav-mobile nav a{display:flex;align-items:center;min-height:48px;color:var(--on-dark-strong);font-weight:600;text-decoration:none;border-bottom:1px solid var(--line-dark)}
.nav-mobile nav a:last-child{border-bottom:0}
.search-compact{display:flex;gap:8px;flex:1 1 200px;max-width:560px}
.search-compact input[type=search]{flex:1;min-width:0;min-height:44px;background:var(--surface);border-color:var(--field-dark);color:var(--on-dark-strong)}
.search-compact input::placeholder{color:var(--on-dark-muted)}
.search-compact button{width:44px;min-height:44px;padding:0}
@media (max-width:959px){
  .nav-desktop{display:none}
  .nav-mobile{display:block}
  .search-compact{order:3;flex-basis:100%;max-width:none}
}
.main-wide{padding-top:28px;padding-bottom:64px}
.main-narrow{padding:32px 16px 64px}
.sheet{max-width:760px;margin:0 auto;background:var(--card);border:1px solid var(--border);border-radius:24px;padding:24px 20px}
@media (min-width:640px){.sheet{padding:40px 48px}}
.sheet h1{font-size:clamp(28px,4.4vw,40px);line-height:1.1;margin-bottom:16px}
.sheet h2{font-size:22px;margin-top:32px}
.sheet p,.sheet li{max-width:70ch}
.sheet ul,.sheet ol{padding-left:1.25em}
.sheet li{margin:.35em 0}
.site-footer{background:var(--navy);color:var(--on-dark-muted);padding:48px 0 32px}
.footer-grid{display:grid;gap:24px}
@media (min-width:900px){.footer-grid{grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);gap:48px}}
.footer-brand p{margin:12px 0 0;max-width:40ch;color:var(--on-dark-3)}
.footer-nav{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));column-gap:24px}
.footer-nav a{display:flex;align-items:center;min-height:44px;color:var(--on-dark-2);text-decoration:none;border-bottom:1px solid var(--line-dark-soft)}
.footer-nav a:hover{color:var(--on-dark-strong)}
.footer-note{margin-top:32px;padding-top:24px;border-top:1px solid var(--line-dark);font-size:14px}
.footer-note p{margin:0;max-width:80ch}
`;

const STYLES = [FONTS, BASE, FORMS, CHROME].join('\n');

const navLinks = (variant: 'desktop' | 'mobile') =>
  variant === 'desktop'
    ? html`<a href="/ako-to-funguje">Ako to funguje</a>
        <a href="/affiliate">Ako zarábame</a>
        <a class="pill" href="/pre-ai-asistentov">${icon('message-circle', 18)}V AI chate</a>`
    : html`<a href="/ako-to-funguje">Ako to funguje</a>
        <a href="/pre-ai-asistentov">V AI chate</a>
        <a href="/affiliate">Ako zarábame</a>`;

/**
 * Celá stránka. `landing` je úvod s vlastnými sekciami cez celú šírku,
 * `wide` obsah v mriežke (produkt, vyhľadávanie), `narrow` text v liste
 * (obsahové stránky, stráženie). `search` je krajina pre vyhľadávanie
 * v hlavičke; `false` ho vynechá a úvod ho nemá nikdy.
 */
export function page(opts: {
  site: Site;
  title: string;
  body: Html;
  description?: string;
  noindex?: boolean;
  layout?: 'landing' | 'wide' | 'narrow';
  search?: Country | false;
}): Html {
  const { site, title, description } = opts;
  const layout = opts.layout ?? 'narrow';
  const search = layout === 'landing' ? false : (opts.search ?? 'SK');
  const main =
    layout === 'landing'
      ? html`<main id="obsah" class="main-landing">${opts.body}</main>`
      : layout === 'wide'
        ? html`<main id="obsah" class="wrap main-wide">${opts.body}</main>`
        : html`<main id="obsah" class="main-narrow"><div class="sheet">${opts.body}</div></main>`;

  return html`<!doctype html>
<html lang="sk">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} | ${site.siteName}</title>
    ${description ? html`<meta name="description" content="${description}" />` : ''}
    ${opts.noindex ? html`<meta name="robots" content="noindex" />` : ''}
    <meta name="theme-color" content="#0B1220" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="preload" href="/fonts/inter-v20-latin-wght.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/fonts/space-grotesk-v22-latin-wght.woff2" as="font" type="font/woff2" crossorigin />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${site.siteName}" />
    <meta property="og:locale" content="sk_SK" />
    <meta property="og:title" content="${title}" />
    ${description ? html`<meta property="og:description" content="${description}" />` : ''}
    <meta property="og:image" content="${site.publicBaseUrl}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${site.siteName}: Je to naozaj zľava?" />
    <meta name="twitter:card" content="summary_large_image" />
    <style>${raw(STYLES)}</style>
  </head>
  <body>
    <a class="skip" href="#obsah">Preskočiť na obsah</a>
    <header class="site-header dark">
      <div class="wrap header-row">
        <a class="brand" href="/">${logo(32)}<span>${site.siteName}</span></a>
        ${search === false ? '' : searchForm('', search, 'compact')}
        <nav class="nav-desktop" aria-label="Hlavné menu">${navLinks('desktop')}</nav>
        <details class="nav-mobile">
          <summary>${icon('menu')}<span>Menu</span></summary>
          <nav aria-label="Hlavné menu">${navLinks('mobile')}</nav>
        </details>
      </div>
    </header>
    ${main}
    <footer class="site-footer dark">
      <div class="wrap footer-grid">
        <div class="footer-brand">
          <a class="brand" href="/">${logo(28)}<span>${site.siteName}</span></a>
          <p>Porovnávač cien elektroniky s históriou cien a strážením ceny pre Slovensko a Česko.</p>
        </div>
        <nav class="footer-nav" aria-label="Odkazy v pätičke">
          <a href="/ako-to-funguje">Ako to funguje</a>
          <a href="/pre-ai-asistentov">V AI chate</a>
          <a href="/affiliate">Ako zarábame</a>
          <a href="/o-nas">O službe a kontakt</a>
          <a href="/ochrana-sukromia">Ochrana súkromia</a>
        </nav>
      </div>
      <div class="wrap footer-note">
        <p>
          Odkazy do e-shopov sú partnerské: ak cez ne nakúpite, môžeme od obchodu získať províziu. Cenu pre vás to
          nemení. Porovnávame len obchody, s ktorými spolupracujeme.
        </p>
      </div>
    </footer>
  </body>
</html>`;
}
