import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { compareProduct } from '../compare/compare.ts';
import { UNAVAILABLE_INSTRUCTION, type AppDeps } from '../deps.ts';
import { normalizeSource, type Source } from '../source.ts';

const TOOL_DESCRIPTION =
  'Porovná aktuálne ceny jedného konkrétneho produktu (elektronika) v partnerských e-shopoch na Slovensku ' +
  'alebo v Česku. Vráti ponuky s cenou a dostupnosťou, priemernú cenu za 30 a 90 dní, verdikt, či sa oplatí ' +
  'kúpiť teraz, a upozornenie na zdanlivé zľavy. Použi, keď sa používateľ pýta na cenu, najlacnejšiu ponuku ' +
  'alebo na to, či je zľava konkrétneho produktu skutočná. Výsledok má v poli _ai_instruction pokyn, ako ho ' +
  'používateľovi podať; pri statuse needs_clarification sa používateľa najprv opýtaj, ktorý produkt myslí.';

/**
 * Ktorá AI platforma volá. Spoľahlivé je len `?source=` v adrese konektora;
 * odhad z hlavičky User-Agent je záloha a treba ho overiť na reálnej prevádzke.
 */
export function mcpSource(request: Request): Source {
  const explicit = new URL(request.url).searchParams.get('source');
  if (explicit) return normalizeSource(explicit);
  const agent = request.headers.get('user-agent') ?? '';
  if (/openai|chatgpt/i.test(agent)) return 'chatgpt';
  if (/claude|anthropic/i.test(agent)) return 'claude';
  if (/gemini|google/i.test(agent)) return 'gemini';
  return 'mcp';
}

export function createMcpServer(deps: AppDeps, source: Source): McpServer {
  const server = new McpServer({ name: 'cenoradar', version: '0.1.0' });

  server.registerTool(
    'compare_prices',
    {
      title: 'Porovnanie cien elektroniky (SK/CZ)',
      description: TOOL_DESCRIPTION,
      inputSchema: {
        query: z.string().describe('Názov produktu, ako ho napísal používateľ (aj s preklepom), alebo EAN kód.'),
        country: z.enum(['SK', 'CZ']).default('SK').describe('Krajina e-shopov. Ceny sú v EUR (SK) alebo CZK (CZ).'),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ query, country }) => {
      try {
        const result = await compareProduct(deps, { query, country, source });
        return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
      } catch (error) {
        console.error('compare_prices zlyhal:', error);
        return { isError: true, content: [{ type: 'text', text: UNAVAILABLE_INSTRUCTION }] };
      }
    },
  );

  return server;
}

/**
 * Obslúži jednu MCP požiadavku. Server je bezstavový: každá požiadavka má
 * vlastný transport, takže aplikácia nedrží relácie ani otvorené spojenia.
 */
export async function handleMcpRequest(deps: AppDeps, request: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  const server = createMcpServer(deps, mcpSource(request));
  await server.connect(transport);
  return transport.handleRequest(request);
}
