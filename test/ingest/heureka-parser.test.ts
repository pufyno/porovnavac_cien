import { describe, expect, it } from 'vitest';
import { parseHeurekaFeed, type FeedItem, type ParseStats } from '../../src/ingest/heureka-parser.ts';

const TODAY = '2026-11-17';

function feed(items: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>\n<SHOP>\n${items}\n</SHOP>`;
}

function item(fields: Record<string, string>): string {
  const base: Record<string, string> = {
    ITEM_ID: 'a1',
    PRODUCTNAME: 'Roborock S8 White',
    URL: 'https://alfa.example/p/a1',
    PRICE_VAT: '489',
    ...fields,
  };
  const inner = Object.entries(base)
    .map(([k, v]) => `<${k}>${v}</${k}>`)
    .join('');
  return `<SHOPITEM>${inner}</SHOPITEM>`;
}

async function* chunks(...parts: (string | Uint8Array)[]) {
  for (const p of parts) yield p;
}

async function parse(xml: string | Uint8Array, stats?: ParseStats): Promise<FeedItem[]> {
  const out: FeedItem[] = [];
  for await (const it of parseHeurekaFeed(chunks(xml), { today: TODAY, stats })) out.push(it);
  return out;
}

function newStats(): ParseStats {
  return { total: 0, skipped: 0, reasons: {} };
}

describe('parseHeurekaFeed', () => {
  it('načíta základné polia položky', async () => {
    const xml = feed(
      item({
        EAN: '6970995786842',
        MANUFACTURER: 'Roborock',
        CATEGORYTEXT: 'Heureka.sk | Elektronika | Vysávače',
        IMGURL: 'https://alfa.example/i/a1.jpg',
        DELIVERY_DATE: '0',
      }),
    );

    expect(await parse(xml)).toEqual([
      {
        externalId: 'a1',
        name: 'Roborock S8 White',
        url: 'https://alfa.example/p/a1',
        price: '489',
        ean: '6970995786842',
        deliveryDays: 0,
        brand: 'Roborock',
        category: 'Heureka.sk | Elektronika | Vysávače',
        imageUrl: 'https://alfa.example/i/a1.jpg',
      },
    ]);
  });

  it('nepovinné polia sú null, keď chýbajú', async () => {
    const [it] = await parse(feed(item({})));

    expect(it).toMatchObject({ ean: null, deliveryDays: null, brand: null, category: null, imageUrl: null });
  });

  it('cenu s desatinnou čiarkou prevedie na bodku', async () => {
    const [it] = await parse(feed(item({ PRICE_VAT: '25000,50' })));

    expect(it?.price).toBe('25000.50');
  });

  it('DELIVERY_DATE ako dátum prepočíta na dni odo dneška', async () => {
    const [it] = await parse(feed(item({ DELIVERY_DATE: '2026-11-20' })));

    expect(it?.deliveryDays).toBe(3);
  });

  it('DELIVERY_DATE v minulosti znamená skladom', async () => {
    const [it] = await parse(feed(item({ DELIVERY_DATE: '2026-11-01' })));

    expect(it?.deliveryDays).toBe(0);
  });

  it('nezmyselný DELIVERY_DATE je null', async () => {
    const [it] = await parse(feed(item({ DELIVERY_DATE: 'na dotaz' })));

    expect(it?.deliveryDays).toBeNull();
  });

  it('EAN s chybnou kontrolnou číslicou zahodí, položku ponechá', async () => {
    const [it] = await parse(feed(item({ EAN: '6970995786843' })));

    expect(it).toMatchObject({ externalId: 'a1', ean: null });
  });

  it('rozbalí CDATA a entity', async () => {
    const xml = feed(item({ PRODUCTNAME: '<![CDATA[TV 55" & držiak]]>', MANUFACTURER: 'Black &amp; Decker' }));

    expect((await parse(xml))[0]).toMatchObject({ name: 'TV 55" & držiak', brand: 'Black & Decker' });
  });

  it('ak chýba PRODUCTNAME, použije PRODUCT', async () => {
    const xml = feed('<SHOPITEM><ITEM_ID>a1</ITEM_ID><PRODUCT>Záložný názov</PRODUCT><URL>https://alfa.example/p</URL><PRICE_VAT>10</PRICE_VAT></SHOPITEM>');

    expect((await parse(xml))[0]?.name).toBe('Záložný názov');
  });

  it('neplatné položky preskočí a spočíta dôvody', async () => {
    const xml = feed(
      [
        item({ ITEM_ID: 'ok' }),
        item({ ITEM_ID: '' }),
        item({ ITEM_ID: 'p0', PRICE_VAT: '0' }),
        item({ ITEM_ID: 'px', PRICE_VAT: 'zadarmo' }),
        item({ ITEM_ID: 'u', URL: 'javascript:alert(1)' }),
        item({ ITEM_ID: 'n', PRODUCTNAME: '' }),
      ].join('\n'),
    );
    const stats = newStats();

    const items = await parse(xml, stats);

    expect(items.map((i) => i.externalId)).toEqual(['ok']);
    expect(stats).toEqual({
      total: 6,
      skipped: 5,
      reasons: { missing_item_id: 1, invalid_price: 2, invalid_url: 1, missing_name: 1 },
    });
  });

  it('vnorené elementy (PARAM, DELIVERY) nepomýli s poľami položky', async () => {
    const xml = feed(
      `<SHOPITEM><ITEM_ID>a1</ITEM_ID><PRODUCTNAME>Telefón</PRODUCTNAME>
        <PARAM><PARAM_NAME>URL</PARAM_NAME><VAL>999</VAL></PARAM>
        <DELIVERY><DELIVERY_ID>GLS</DELIVERY_ID><DELIVERY_PRICE>3,90</DELIVERY_PRICE><URL>https://zle.example</URL></DELIVERY>
        <URL>https://alfa.example/p/a1</URL><PRICE_VAT>199</PRICE_VAT></SHOPITEM>`,
    );

    expect((await parse(xml))[0]).toMatchObject({ url: 'https://alfa.example/p/a1', price: '199' });
  });

  it('výsledok nezávisí od delenia na kusy, ani uprostred viacbajtového znaku', async () => {
    const xml = feed(item({ PRODUCTNAME: 'Čierny vysávač žltý kôň' }));
    const bytes = new TextEncoder().encode(xml);
    const tiny: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += 3) tiny.push(bytes.subarray(i, i + 3));

    const out: FeedItem[] = [];
    for await (const it of parseHeurekaFeed(chunks(...tiny), { today: TODAY })) out.push(it);

    expect(out).toEqual(await parse(xml));
    expect(out[0]?.name).toBe('Čierny vysávač žltý kôň');
  });

  it('rešpektuje kódovanie z XML hlavičky (windows-1250)', async () => {
    const head = '<?xml version="1.0" encoding="windows-1250"?><SHOP><SHOPITEM><ITEM_ID>a1</ITEM_ID><PRODUCTNAME>';
    const tail = '</PRODUCTNAME><URL>https://alfa.example/p</URL><PRICE_VAT>5</PRICE_VAT></SHOPITEM></SHOP>';
    // "Žltý čaj" vo windows-1250
    const name = Uint8Array.from([0x8e, 0x6c, 0x74, 0xfd, 0x20, 0xe8, 0x61, 0x6a]);
    const bytes = Buffer.concat([Buffer.from(head, 'latin1'), name, Buffer.from(tail, 'latin1')]);

    expect((await parse(bytes))[0]?.name).toBe('Žltý čaj');
  });

  it('pri poškodenom XML vyhodí chybu', async () => {
    const xml = `<?xml version="1.0"?><SHOP>${item({})}<SHOPITEM><ITEM_ID>b</SHOP>`;

    await expect(parse(xml)).rejects.toThrow(/XML/);
  });

  it('pri predčasne ukončenom súbore vyhodí chybu', async () => {
    const xml = `<?xml version="1.0"?><SHOP>${item({})}<SHOPITEM><ITEM_ID>b</ITEM_ID>`;

    await expect(parse(xml)).rejects.toThrow(/XML/);
  });

  it('položky vydáva priebežne, nečaká na koniec súboru', async () => {
    let pulled = 0;
    async function* source() {
      pulled++;
      yield `<?xml version="1.0"?><SHOP>${item({ ITEM_ID: 'prvy' })}`;
      pulled++;
      yield `${item({ ITEM_ID: 'druhy' })}</SHOP>`;
    }

    const it = parseHeurekaFeed(source(), { today: TODAY })[Symbol.asyncIterator]();
    const first = await it.next();

    expect(first.value?.externalId).toBe('prvy');
    expect(pulled).toBe(1);
  });
});
