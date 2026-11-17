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

/** Prvky, ktoré zdieľa viac stránok. */
const PARTS = `
.badge{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font-size:13px;font-weight:700;line-height:1.3;white-space:nowrap}
.badge-bad-dark{background:rgba(255,122,110,.14);color:var(--coral)}
.badge-good-dark{background:rgba(75,227,166,.14);color:var(--mint)}
.feature-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 52px;width:52px;height:52px;border-radius:14px;background:var(--navy);color:var(--accent)}
.badge-neutral-dark{background:rgba(238,243,251,.1);color:var(--on-dark-2)}
.badge-wait-dark{background:rgba(255,201,120,.14);color:#FFC978}
.icon-box{display:inline-flex;align-items:center;justify-content:center;flex:0 0 44px;width:44px;height:44px;border-radius:12px;background:var(--navy);color:var(--accent)}
`;

/** Úvodná stránka (home.ts). */
const HOME = `
.radar{position:absolute;width:960px;height:960px;right:-300px;top:50%;transform:translateY(-50%);border-radius:50%;pointer-events:none;
  background:conic-gradient(rgba(53,224,161,0) 0deg,rgba(53,224,161,.2) 72deg,rgba(53,224,161,0) 72deg),repeating-radial-gradient(circle,transparent 0 79px,rgba(53,224,161,.12) 79px 80px);
  -webkit-mask-image:radial-gradient(circle,#000 40%,transparent 70%);mask-image:radial-gradient(circle,#000 40%,transparent 70%)}
.radar-left{right:auto;left:-420px}
@media (max-width:999px){.radar{width:680px;height:680px;right:-340px;top:-60px;transform:none}.radar-left{left:-380px;top:auto;bottom:-300px}}
.hero{position:relative;overflow:hidden;background:var(--navy);color:var(--on-dark);padding:48px 0 64px}
@media (min-width:1000px){.hero{padding:72px 0 88px}}
.hero-grid{position:relative;display:grid;gap:40px;align-items:center}
@media (min-width:1000px){.hero-grid{grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:56px}}
.kicker{display:inline-flex;align-items:center;gap:10px;margin:0 0 20px;padding:6px 14px;border:1px solid var(--line-dark);border-radius:999px;background:rgba(19,29,51,.8);color:var(--on-dark-2);font-size:14px;font-weight:500;line-height:1.4}
.kicker .dot{flex:0 0 8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px rgba(53,224,161,.18)}
.hero h1{margin:0 0 20px;font-size:clamp(44px,8vw,76px);line-height:1.02;letter-spacing:-.035em;color:var(--on-dark-strong)}
.accent{color:var(--accent)}
.lead{max-width:34em;margin:0 0 28px;font-size:clamp(17px,2.2vw,20px);line-height:1.55;color:var(--on-dark-3)}
.hero .search-full{max-width:640px;border-color:transparent;box-shadow:0 24px 60px rgba(3,8,20,.45)}
.trust{display:flex;flex-wrap:wrap;gap:10px 24px;margin:20px 0 0;padding:0;list-style:none;color:var(--on-dark-2);font-size:15px}
.trust li{display:inline-flex;align-items:center;gap:8px}
.trust .icon{color:var(--accent)}
.example{margin:0;padding:24px;background:var(--surface);border:1px solid var(--line-dark);border-radius:24px;box-shadow:0 30px 60px rgba(3,8,20,.35)}
.example-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:12px}
.example-head p{margin:0}
.example-kicker{color:var(--on-dark-muted);font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.example-head p+p{margin-top:4px}
.example-title{font:700 22px/1.2 var(--display);color:var(--on-dark-strong)}
.example-sub{color:var(--on-dark-muted);font-size:14px}
.example-figure{margin:0}
.example-chart{display:block;width:100%;height:auto;margin:16px 0 12px}
.example-chart text{font-family:var(--font);font-size:16px;fill:var(--on-dark-muted)}
.example-chart .t-peak{font-size:20px;font-weight:700;fill:var(--coral)}
.example-chart .t-coral{font-size:17px;fill:var(--coral)}
.example-chart .t-axis{font-size:15px;fill:#8E9FBA}
/* Na úzkom displeji sa graf zmenší asi na 60 %, preto väčšie písmo v jednotkách grafu. */
@media (max-width:559px){.example{padding:18px}.example-chart text{font-size:21px}.example-chart .t-peak{font-size:25px}.example-chart .t-coral{font-size:22px}.example-chart .t-axis{font-size:19px}}
.example figcaption{color:var(--on-dark-2);font-size:15px;line-height:1.55}
.example-foot{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-top:16px;padding-top:16px;border-top:1px solid var(--line-dark)}
.example-foot p{margin:0;color:var(--on-dark-2);font-size:15px}
.example-foot strong{color:var(--on-dark-strong)}
.example-foot a{display:inline-flex;align-items:center;gap:6px;color:var(--accent);font-weight:600}
.section{padding:64px 0}
@media (min-width:1000px){.section{padding:88px 0}}
.section-white{background:var(--card)}
.section h2{margin:0 0 12px;font-size:clamp(28px,4vw,40px);line-height:1.1;letter-spacing:-.025em}
.eyebrow{margin:0 0 12px;color:var(--good);font-size:14px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.features{display:grid;gap:16px;margin:32px 0 0;padding:0;list-style:none}
@media (min-width:800px){.features{grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}}
.feature{padding:24px;background:var(--card);border:1px solid var(--border);border-radius:20px}
.feature h3{margin:18px 0 8px;font-size:21px}
.feature p{margin:0;color:var(--muted)}
.ai-grid{display:grid;gap:40px;align-items:center}
@media (min-width:1000px){.ai-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:64px}}
.ai-copy>p{max-width:34em;color:var(--muted);font-size:18px}
.steps{display:grid;gap:12px;margin:24px 0 28px;padding:0;list-style:none;counter-reset:krok}
.steps li{display:flex;align-items:flex-start;gap:14px;counter-increment:krok}
.steps li::before{content:counter(krok);flex:0 0 32px;height:32px;border-radius:50%;background:var(--navy);color:var(--accent);margin-top:-3px;font:700 15px/32px var(--display);text-align:center}
.chat-demo{margin:0;overflow:hidden;background:var(--navy);border:1px solid var(--line-dark);border-radius:24px;box-shadow:0 30px 60px rgba(11,18,32,.18)}
.chat-bar{display:flex;align-items:center;gap:6px;padding:14px 18px;border-bottom:1px solid var(--line-dark);color:var(--on-dark-muted);font-size:13px}
.chat-bar i{width:10px;height:10px;border-radius:50%;background:var(--line-dark)}
.chat-bar span{margin-left:8px}
.chat-body{display:grid;gap:14px;padding:20px}
.bubble{max-width:88%;margin:0;padding:14px 16px;border-radius:18px;font-size:15px;line-height:1.55}
.bubble p{margin:0 0 .6em}
.bubble p:last-of-type{margin-bottom:0}
.bubble-user{justify-self:end;background:var(--accent);color:var(--navy);border-bottom-right-radius:6px}
.bubble-ai{justify-self:start;background:var(--surface);color:var(--on-dark);border:1px solid var(--line-dark);border-bottom-left-radius:6px}
.bubble-ai p strong{color:var(--coral)}
.chat-card{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-top:12px;padding:12px 14px;background:var(--navy);border:1px solid var(--line-dark);border-radius:14px;color:var(--on-dark-2)}
.chat-card strong{color:var(--on-dark-strong)}
.chat-demo figcaption{padding:12px 20px 16px;border-top:1px solid var(--line-dark);color:var(--on-dark-muted);font-size:13px}
.alert-band{position:relative;overflow:hidden;padding:72px 0;background:var(--navy);color:var(--on-dark)}
.alert-grid{position:relative;display:grid;gap:32px;align-items:center}
@media (min-width:900px){.alert-grid{grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:56px}}
.alert-copy h2{margin:0 0 12px;font-size:clamp(28px,4vw,40px);line-height:1.1;color:var(--on-dark-strong)}
.alert-copy p{max-width:32em;margin:0 0 24px;color:var(--on-dark-3);font-size:18px}
.mail-sample{margin:0;padding:20px;background:var(--card);color:var(--ink);border-radius:20px;box-shadow:0 30px 60px rgba(3,8,20,.45)}
.mail-head{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:14px;font-weight:600}
.icon-tile{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:var(--good-bg);color:var(--good)}
.mail-title{margin:14px 0 6px;font:700 20px/1.25 var(--display)}
.mail-sample p:not(.mail-title){margin:0;color:var(--muted);font-size:15px}
.mail-sample figcaption{margin-top:14px;padding-top:12px;border-top:1px solid var(--border);color:var(--muted);font-size:13px}
.money{display:flex;flex-direction:column;gap:20px;padding:28px;background:var(--card);border:1px solid var(--border);border-radius:24px}
@media (min-width:700px){.money{flex-direction:row;align-items:flex-start;padding:36px 40px}}
.money h2{font-size:clamp(24px,3vw,30px)}
.money p{max-width:52em;color:var(--muted)}
.money a{display:inline-flex;align-items:center;gap:6px;font-weight:600}
`;

/** Stránka produktu (search.ts, chart.ts). */
const PRODUCT = `
.product-head{margin-bottom:20px}
.product-head h1{margin:0;font-size:clamp(28px,4.4vw,40px);line-height:1.15;overflow-wrap:anywhere}
.product-meta{margin:8px 0 0;color:var(--muted);font-size:14px}
.product-top,.product-summary{display:grid;gap:10px}
.product-bottom{display:grid;gap:24px;margin-top:32px}
@media (min-width:1000px){.product-top{grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:24px;align-items:start}.product-bottom{grid-template-columns:minmax(0,7fr) minmax(0,5fr);gap:32px;align-items:start}.alert-card{position:sticky;top:24px}}
.verdict{position:relative;overflow:hidden;padding:20px;border-radius:22px;background:var(--navy);color:var(--on-dark)}
@media (min-width:640px){.verdict{padding:28px}}
.verdict-radar{position:absolute;right:-110px;top:-110px;width:280px;height:280px;border-radius:50%;pointer-events:none;background:repeating-radial-gradient(circle,transparent 0 33px,rgba(53,224,161,.16) 33px 34px)}
.verdict-inner{position:relative}
.verdict-inner p{margin:0}
.verdict-inner .verdict-kicker{margin-top:16px;color:var(--on-dark-muted);font-size:13px}
.verdict-inner .verdict-price{margin-top:2px;font:700 48px/1.05 var(--display);font-variant-numeric:tabular-nums;letter-spacing:-.03em;color:var(--on-dark-strong)}
.verdict-inner .verdict-shop{margin-top:4px;color:var(--on-dark-2);font-size:15px}
.verdict-inner .verdict-reason{margin-top:14px;padding-top:14px;border-top:1px solid var(--line-dark);color:var(--on-dark-2);font-size:15px;line-height:1.5}
.verdict-cta{display:flex;min-height:52px;margin-top:16px;border-radius:14px}
.verdict-inner .verdict-fine{margin-top:10px;color:#8E9FBA;font-size:13px;text-align:center}
.tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0}
.tiles div{min-width:0;padding:12px;background:var(--card);border:1px solid var(--border);border-radius:14px}
.tiles dt{color:var(--muted);font-size:12px;line-height:1.3}
.tiles dd{margin:6px 0 0;font:700 clamp(16px,4.4vw,20px)/1.2 var(--display);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.tiles-note{margin:0;color:var(--muted);font-size:13px}
.chart-card{padding:18px 16px 16px;background:var(--card);border:1px solid var(--border);border-radius:20px}
@media (min-width:640px){.chart-card{padding:24px}}
.chart-card h2{margin:0;font-size:18px;line-height:1.3}
.chart-card>p{margin:4px 0 0;color:var(--muted);font-size:13px}
.chart{display:block;margin-top:16px;overflow:visible}
.chart-area{fill:var(--accent);fill-opacity:.16}
.chart-line{fill:none;stroke:var(--navy);stroke-width:2.5px;stroke-linejoin:round}
.chart-base{stroke:var(--border);stroke-width:1px}
.chart-ref{stroke:#8E9AAE;stroke-width:1px;stroke-dasharray:4 4}
.chart-dot{fill:var(--accent);stroke:var(--navy);stroke-width:2px}
.chart text{font-family:var(--font);font-size:13px;fill:var(--muted)}
.chart .chart-max{font-weight:600;fill:var(--ink-2)}
.chart .chart-min{font-weight:700;fill:var(--ink)}
.offers-section h2{margin:0;font-size:22px;letter-spacing:-.01em}
.offers-section>p{margin:4px 0 0;color:var(--muted);font-size:14px}
.offers{display:grid;gap:10px;margin:14px 0 0;padding:0;list-style:none}
.offer{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px 16px;padding:16px;background:var(--card);border:1px solid var(--border);border-radius:18px}
.offer-best{padding:15px;border:2px solid var(--navy)}
.offer p{margin:0}
.offer-shop{font-weight:600;overflow-wrap:anywhere}
.offer .stock{display:flex;align-items:center;gap:6px;margin-top:4px;color:var(--muted);font-size:13px}
.offer .stock-yes{color:var(--good)}
.offer-price{text-align:right}
.offer-price .num{font:700 24px/1.15 var(--display);font-variant-numeric:tabular-nums;white-space:nowrap}
.offer .offer-label{margin-top:2px;color:var(--good);font-size:12px;font-weight:600}
.offer-warn{grid-column:1/-1;display:flex;gap:10px;padding:12px;border-radius:12px;background:var(--bad-bg);color:var(--bad);font-size:14px;line-height:1.5}
.offer-warn .icon{margin-top:2px;color:var(--bad-icon)}
.offer-cta{grid-column:1/-1}
.offer-best .offer-cta .icon{color:var(--accent)}
@media (min-width:640px){.offer{grid-template-columns:minmax(0,1fr) auto auto;align-items:center}.offer-cta{grid-column:3;grid-row:1}.offer-warn{grid-row:2}}
.offers-note{margin:12px 0 0;color:var(--muted);font-size:13px}
.alert-card{padding:20px;background:var(--card);border:1px solid var(--border);border-radius:20px}
.alert-card-head{display:flex;align-items:center;gap:12px}
.alert-card h2{margin:0;font-size:20px;line-height:1.25}
.alert-card p{margin:12px 0 0;color:var(--muted);font-size:15px;line-height:1.55}
.alert-card .button{display:flex;margin-top:14px}
`;

/** Vyhľadávanie a stráženie ceny (search.ts, alert.ts). */
const FLOWS = `
.search-page{max-width:760px;margin:0 auto}
.search-page h1{font-size:clamp(28px,4.4vw,40px)}
.search-page .search-full{margin-bottom:24px}
.results{display:grid;gap:10px;margin:16px 0 0;padding:0;list-style:none}
.result a{display:flex;align-items:center;gap:16px;padding:16px 18px;background:var(--card);border:1px solid var(--border);border-radius:16px;color:var(--ink);text-decoration:none}
.result a:hover{border-color:var(--navy)}
.result-text{display:grid;gap:2px;flex:1 1 auto;min-width:0}
.result-name{font-weight:600;overflow-wrap:anywhere}
.result-price{color:var(--muted);font-size:15px;font-variant-numeric:tabular-nums}
.result .icon{color:var(--good)}
.alert-product{margin:0 0 4px;padding:16px;background:var(--bg);border:1px solid var(--border);border-radius:14px}
.alert-product p{margin:0}
.alert-product .alert-product-name{font-weight:700;overflow-wrap:anywhere}
.alert-product p+p{margin-top:4px;color:var(--muted)}
.field-error{display:flex;align-items:flex-start;gap:6px;margin:8px 0 0;color:var(--bad);font-size:14px;font-weight:600}
.field-error .icon{margin-top:2px;color:var(--bad-icon)}
input[aria-invalid=true]{border:2px solid var(--bad-icon)}
.form-note{margin:16px 0 20px;color:var(--muted);font-size:14px}
.alert-form button{width:100%}
@media (min-width:640px){.alert-form button{width:auto}}
`;

const STYLES = [FONTS, BASE, FORMS, CHROME, PARTS, HOME, PRODUCT, FLOWS].join('\n');

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
