import { z } from '@hono/zod-openapi';

export const CountrySchema = z.enum(['SK', 'CZ']);
export type Country = z.infer<typeof CountrySchema>;

const VerdictSchema = z.enum(['BUY_NOW', 'FAIR_PRICE', 'WAIT', 'INSUFFICIENT_DATA']);

const aiInstruction = z.string().describe('Pokyn pre AI asistenta, ako výsledok podať používateľovi.');

const PriceAnalysisSchema = z.object({
  current_lowest_price: z
    .number()
    .describe('Najnižšia cena ponuky skladom; ak nie je skladom nikde, najnižšia cena vôbec.'),
  average_30d_price: z.number().nullable().describe('Priemer najnižšej ceny za posledných 30 dní.'),
  average_90d_price: z.number().nullable().describe('Priemer najnižšej ceny za posledných 90 dní.'),
  lowest_90d_price: z.number().nullable().describe('Najnižšia cena za posledných 90 dní.'),
  history_days: z
    .number()
    .int()
    .describe('Koľko dní z posledných 90 cenu sledujeme. Priemery sú len z týchto dní.'),
  verdict: VerdictSchema,
  verdict_reason: z.string(),
});

const OfferSchema = z.object({
  shop_name: z.string(),
  price: z.number(),
  in_stock: z.boolean(),
  delivery_days: z.number().int().nullable().describe('Dni do doručenia; 0 = skladom, null = neznáme.'),
  fake_discount_warning: z
    .boolean()
    .describe('E-shop cenu pred „zľavou“ krátko zvýšil; zľava je len zdanlivá.'),
  warning_detail: z.string().optional(),
  buy_url: z.string().describe('Partnerský (affiliate) odkaz do e-shopu.'),
});

const OkSchema = z
  .object({
    status: z.literal('ok'),
    product_name: z.string(),
    ean: z.string(),
    country: CountrySchema,
    currency: z.enum(['EUR', 'CZK']),
    price_analysis: PriceAnalysisSchema,
    offers: z.array(OfferSchema).describe('Ponuky zoradené od najlacnejšej.'),
    shops_compared: z.number().int().describe('Počet partnerských obchodov, ktoré produkt ponúkajú.'),
    price_alert_url: z.string().describe('Stránka, kde si používateľ nastaví stráženie ceny e-mailom.'),
    _ai_instruction: aiInstruction,
  })
  .openapi('CompareOk');

const CandidateSchema = z.object({
  product_name: z.string(),
  ean: z.string().describe('Pošli ako `query`, keď si používateľ vyberie tento produkt.'),
  lowest_price: z.number(),
  currency: z.enum(['EUR', 'CZK']),
});

const ClarifySchema = z
  .object({
    status: z.literal('needs_clarification'),
    country: CountrySchema,
    exact_match: z
      .boolean()
      .describe('false = hľadaný produkt sme nenašli, kandidáti sú len podobné produkty.'),
    candidates: z.array(CandidateSchema),
    _ai_instruction: aiInstruction,
  })
  .openapi('CompareNeedsClarification');

const NotFoundSchema = z
  .object({
    status: z.literal('not_found'),
    country: CountrySchema,
    _ai_instruction: aiInstruction,
  })
  .openapi('CompareNotFound');

export const CompareResponseSchema = z.discriminatedUnion('status', [OkSchema, ClarifySchema, NotFoundSchema]);
export type CompareResponse = z.infer<typeof CompareResponseSchema>;
