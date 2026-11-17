import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { compareProduct } from '../compare/compare.ts';
import { CompareResponseSchema, CountrySchema, type Country } from '../compare/schema.ts';
import type { AppDeps } from '../deps.ts';

const UnavailableSchema = z
  .object({ status: z.literal('unavailable'), _ai_instruction: z.string() })
  .openapi('Unavailable');

const route = createRoute({
  method: 'get',
  path: '/api/v1/product-compare',
  operationId: 'compareProduct',
  summary: 'Porovnanie cien produktu',
  description:
    'Porovná aktuálne ceny jedného konkrétneho produktu (elektronika) v partnerských e-shopoch na Slovensku ' +
    'alebo v Česku. Vráti ponuky, priemernú cenu za 30 a 90 dní, verdikt, či sa oplatí kúpiť teraz, ' +
    'a upozornenie na zdanlivé zľavy. Nejasný dopyt nekončí chybou: odpoveď má status needs_clarification ' +
    'alebo not_found a v poli _ai_instruction pokyn, čo urobiť ďalej.',
  request: {
    query: z.object({
      query: z.string().openapi({
        description: 'Názov produktu, ako ho napísal používateľ (aj s preklepom), alebo EAN kód.',
        example: 'Roborock S8 Pro Ultra',
      }),
      country: CountrySchema.default('SK').openapi({ description: 'Krajina e-shopov. Ceny sú v EUR (SK) alebo CZK (CZ).' }),
      source: z.string().optional().openapi({
        description: 'Označenie AI platformy, ktorá API volá: chatgpt, claude alebo gemini.',
        example: 'chatgpt',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Porovnanie, zoznam kandidátov na spresnenie, alebo informácia, že produkt nepoznáme.',
      content: { 'application/json': { schema: CompareResponseSchema } },
    },
    503: {
      description: 'Služba je dočasne nedostupná.',
      content: { 'application/json': { schema: UnavailableSchema } },
    },
  },
});

/** Krajinu čítame zhovievavo: neplatná hodnota nie je dôvod na chybu. */
export function parseCountry(raw: string | undefined): Country {
  const parsed = CountrySchema.safeParse(raw?.trim().toUpperCase());
  return parsed.success ? parsed.data : 'SK';
}

export function registerCompareRoute(app: OpenAPIHono, deps: AppDeps): void {
  // Vstup sa číta priamo z adresy, nie z validovaných dát: schéma vyššie
  // slúži ako dokumentácia a nesprávny vstup nesmie skončiť chybou 4xx.
  const respond = async (c: Context) => {
    const result = await compareProduct(deps, {
      query: c.req.query('query') ?? '',
      country: parseCountry(c.req.query('country')),
      source: c.req.query('source'),
    });
    return c.json(result, 200);
  };

  app.openapi(route, respond, (result, c) => (result.success ? undefined : respond(c)));
}
