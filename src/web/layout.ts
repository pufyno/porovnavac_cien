import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';

export type Html = HtmlEscapedString | Promise<HtmlEscapedString>;

/**
 * Zámerne neutrálny vzhľad bez značky: názov, farby a typografia sú
 * otvorené rozhodnutie. Všetky štýly sú na jednom mieste, aby sa dali vymeniť.
 */
const STYLES = `
:root { --fg:#1c1e21; --muted:#5f6670; --line:#dfe3e8; --bg:#fff; --soft:#f5f6f8; --accent:#1a5fb4; --warn:#9a3412; --warn-bg:#fff4e5; --good:#1a7f37; }
* { box-sizing: border-box; }
body { margin:0; font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; color:var(--fg); background:var(--bg); }
a { color:var(--accent); }
header, main, footer { max-width:60rem; margin:0 auto; padding:1rem; }
header { display:flex; flex-wrap:wrap; gap:.5rem 1.5rem; align-items:baseline; border-bottom:1px solid var(--line); }
header .brand { font-weight:700; font-size:1.15rem; text-decoration:none; color:var(--fg); }
header nav { display:flex; flex-wrap:wrap; gap:1rem; }
footer { margin-top:3rem; border-top:1px solid var(--line); color:var(--muted); font-size:.9rem; }
footer nav { display:flex; flex-wrap:wrap; gap:1rem; margin-bottom:.5rem; }
h1 { font-size:1.7rem; line-height:1.25; margin:1.2rem 0 .6rem; }
h2 { font-size:1.25rem; margin:2rem 0 .5rem; }
.muted { color:var(--muted); }
.box { background:var(--soft); border:1px solid var(--line); border-radius:.5rem; padding:1rem; margin:1rem 0; }
.warn { background:var(--warn-bg); border-color:#f3c998; color:var(--warn); }
.verdict-BUY_NOW strong { color:var(--good); }
.verdict-WAIT strong { color:var(--warn); }
table { width:100%; border-collapse:collapse; margin:1rem 0; }
th, td { text-align:left; padding:.6rem .5rem; border-bottom:1px solid var(--line); vertical-align:top; }
td.price, th.price { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
form.search { display:flex; gap:.5rem; flex-wrap:wrap; margin:1rem 0; }
input[type=search], input[type=email], input[type=number], select { font:inherit; padding:.6rem .7rem; border:1px solid #b6bcc5; border-radius:.4rem; min-width:0; }
input[type=search] { flex:1 1 16rem; }
button, a.button { font:inherit; padding:.6rem 1rem; border:0; border-radius:.4rem; background:var(--accent); color:#fff; cursor:pointer; text-decoration:none; display:inline-block; }
label { display:block; margin:.8rem 0 .25rem; font-weight:600; }
ul.plain { list-style:none; padding:0; }
ul.plain li { padding:.6rem 0; border-bottom:1px solid var(--line); }
@media (max-width:40rem) { table.offers thead { display:none; } table.offers td { display:block; border:0; padding:.15rem 0; } table.offers tr { display:block; padding:.7rem 0; border-bottom:1px solid var(--line); } td.price { text-align:left; font-weight:700; } }
`;

export function page(opts: { siteName: string; title: string; body: Html; noindex?: boolean; description?: string }): Html {
  return html`<!doctype html>
<html lang="sk">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${opts.title} | ${opts.siteName}</title>
    ${opts.description ? html`<meta name="description" content="${opts.description}" />` : ''}
    ${opts.noindex ? html`<meta name="robots" content="noindex" />` : ''}
    <style>${raw(STYLES)}</style>
  </head>
  <body>
    <header>
      <a class="brand" href="/">${opts.siteName}</a>
      <nav>
        <a href="/hladat">Hľadať produkt</a>
        <a href="/ako-to-funguje">Ako to funguje</a>
        <a href="/pre-ai-asistentov">V AI chate</a>
      </nav>
    </header>
    <main>${opts.body}</main>
    <footer>
      <nav>
        <a href="/o-nas">O službe a kontakt</a>
        <a href="/ochrana-sukromia">Ochrana súkromia</a>
        <a href="/affiliate">Ako zarábame</a>
      </nav>
      <p>
        Odkazy do e-shopov sú partnerské: ak cez ne nakúpite, môžeme od obchodu získať províziu. Cenu pre vás to
        nemení. Porovnávame len obchody, s ktorými spolupracujeme.
      </p>
    </footer>
  </body>
</html>`;
}
