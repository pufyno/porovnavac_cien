// Vykreslí PNG a ICO v public/ zo zdrojových SVG (postup v design/README.md).
// Použitie z koreňa repozitára:
//   node design/vykreslit-obrazky.mjs <priečinok s @resvg/resvg-js> <priečinok s TTF>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const [nastroj, pisma] = process.argv.slice(2);
if (!nastroj || !pisma) {
  console.error('Použitie: node design/vykreslit-obrazky.mjs <priečinok s resvg> <priečinok s TTF>');
  process.exit(1);
}
const { Resvg } = createRequire(join(nastroj, 'package.json'))('@resvg/resvg-js');
const root = new URL('../', import.meta.url);
const fontFiles = readdirSync(pisma)
  .filter((f) => f.endsWith('.ttf'))
  .map((f) => join(pisma, f));

function png(svgPath, width) {
  // Statické TTF Space Grotesk z Fontsource majú v tabuľke mien rodinu „Space Grotesk Light“
  // a resvg z font-family použije len prvú rodinu, preto ju tu premenujeme.
  const svg = readFileSync(new URL(svgPath, root), 'utf8').replaceAll(
    'font-family="Space Grotesk"',
    'font-family="Space Grotesk Light"',
  );
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter' },
  })
    .render()
    .asPng();
}

/** ICO s obrázkami PNG (podporujú ho všetky súčasné prehliadače). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

writeFileSync(new URL('public/og.png', root), png('design/og-image.svg', 1200));
writeFileSync(new URL('public/apple-touch-icon.png', root), png('design/apple-touch-icon.svg', 180));
writeFileSync(
  new URL('public/favicon.ico', root),
  ico([
    { size: 16, data: png('design/favicon-16.svg', 16) },
    { size: 32, data: png('public/favicon.svg', 32) },
  ]),
);
console.log('Hotovo: public/og.png, public/apple-touch-icon.png, public/favicon.ico');
