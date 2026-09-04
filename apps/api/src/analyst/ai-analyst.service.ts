import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Injectable, Logger } from '@nestjs/common';
import type { AiAnalystNote, AnalystAnswerDto, NewsItem } from '@nse/shared';
import { z } from 'zod';
import { loadConfig } from '../config/app.config.js';

export interface AnalystFacts {
  symbol: string;
  name: string | null;
  sector: string;
  asOf: string;
  /** Compact, JSON-serialisable quantitative summary built by AnalystService. */
  quant: Record<string, unknown>;
  news: NewsItem[];
  sectorNews: NewsItem[];
}

const NoteSchema = z.object({
  summary: z.string(),
  newsImpact: z.string(),
  macroExposure: z.string(),
  positives: z.array(z.string()),
  negatives: z.array(z.string()),
  risks: z.array(z.string()),
  catalysts: z.array(z.string()),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']),
  sentimentScore: z.number(),
  stance: z.enum(['BUY', 'WATCH', 'AVOID']),
  stanceReason: z.string(),
});

const SYSTEM = `You are a sell-side equity research analyst covering Indian stocks listed on the NSE.
You are given (1) a quantitative fact sheet computed from daily price/volume data, (2) recent news headlines about the company and (3) headlines about its sector / macro environment.

Write for an informed retail investor. Be specific and concrete; cite the facts and headlines you are using. Never invent numbers, events or headlines that are not in the material. If the news does not mention something, say the effect is unknown rather than guessing.

Required analysis angles:
- newsImpact: how the recent company headlines are likely to affect the stock over the next few weeks.
- macroExposure: how global and domestic macro / geopolitical forces plausibly affect THIS stock and sector — e.g. crude oil and Middle-East conflict for oil & gas, US rates and the dollar for IT exporters, tariffs and trade policy, wars, sanctions, commodity cycles, new technology shifts, regulation, elections/budget. Tie each force to the direction of impact and to any evidence in the headlines or the price behaviour under stress in the fact sheet.
- Keep the quantitative verdict from the fact sheet in mind but form your own stance; explain any disagreement.

sentimentScore is -100 (very negative) to +100 (very positive). Keep each list to the 3-6 most important points. This is research, not personalised financial advice.`;

const TTL_MS = 6 * 60 * 60_000;

@Injectable()
export class AiAnalystService {
  private readonly log = new Logger(AiAnalystService.name);
  private readonly cfg = loadConfig();
  private client: Anthropic | null = null;
  private noteCache = new Map<string, { at: number; note: AiAnalystNote }>();
  private disabledUntil = 0;
  private disabledMessage: string | null = null;

  private getClient(): Anthropic {
    if (!this.client) this.client = new Anthropic();
    return this.client;
  }

  private factsToText(f: AnalystFacts): string {
    const news = (items: NewsItem[]) =>
      items.length ? items.map((n) => `- [${n.publishedAt?.slice(0, 10) ?? 'n/a'}] ${n.title}${n.source ? ` (${n.source})` : ''}`).join('\n') : '- (none found)';
    return [
      `STOCK: ${f.symbol}${f.name ? ` — ${f.name}` : ''} | Sector: ${f.sector} | Data as of ${f.asOf}`,
      '',
      'QUANTITATIVE FACT SHEET (JSON):',
      JSON.stringify(f.quant, null, 1),
      '',
      'RECENT COMPANY HEADLINES:',
      news(f.news),
      '',
      'RECENT SECTOR / MACRO HEADLINES:',
      news(f.sectorNews),
    ].join('\n');
  }

  private disable(err: unknown): { status: 'DISABLED' | 'ERROR'; message: string } {
    const noCreds = err instanceof Error && /authentication method|apiKey|ANTHROPIC_API_KEY/i.test(err.message) && !(err instanceof Anthropic.APIError);
    if (noCreds || err instanceof Anthropic.AuthenticationError || (err instanceof Anthropic.APIError && err.status === 401)) {
      this.disabledUntil = Date.now() + 10 * 60_000;
      this.disabledMessage = 'AI analyst is off: no Claude API credentials. Set ANTHROPIC_API_KEY (or run `ant auth login`) and restart the API.';
      return { status: 'DISABLED', message: this.disabledMessage };
    }
    if (err instanceof Anthropic.RateLimitError) return { status: 'ERROR', message: 'Claude API rate limit hit — try again in a minute.' };
    if (err instanceof Anthropic.APIError) return { status: 'ERROR', message: `Claude API error ${err.status}: ${err.message}` };
    return { status: 'ERROR', message: (err as Error).message };
  }

  async note(f: AnalystFacts): Promise<{ status: 'OK' | 'DISABLED' | 'ERROR'; note: AiAnalystNote | null; message: string | null }> {
    if (!this.cfg.analyst.enabled) return { status: 'DISABLED', note: null, message: 'AI analyst disabled via ANALYST_AI_ENABLED=false.' };
    if (Date.now() < this.disabledUntil) return { status: 'DISABLED', note: null, message: this.disabledMessage };
    const key = `${f.symbol}|${f.asOf}|${f.news[0]?.url ?? ''}`;
    const hit = this.noteCache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return { status: 'OK', note: hit.note, message: null };
    try {
      const res = await this.getClient().messages.parse({
        model: this.cfg.analyst.model,
        max_tokens: 6000,
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        output_config: { effort: 'medium', format: zodOutputFormat(NoteSchema) },
        messages: [{ role: 'user', content: this.factsToText(f) }],
      });
      if (res.stop_reason === 'refusal' || !res.parsed_output) {
        return { status: 'ERROR', note: null, message: 'The model did not return an analysis for this stock.' };
      }
      const p = res.parsed_output;
      const note: AiAnalystNote = {
        model: res.model,
        generatedAt: new Date().toISOString(),
        ...p,
        sentimentScore: Math.max(-100, Math.min(100, Math.round(p.sentimentScore))),
      };
      this.noteCache.set(key, { at: Date.now(), note });
      return { status: 'OK', note, message: null };
    } catch (err) {
      const d = this.disable(err);
      this.log.warn(`AI note failed for ${f.symbol}: ${d.message}`);
      return { status: d.status, note: null, message: d.message };
    }
  }

  async ask(f: AnalystFacts, question: string): Promise<AnalystAnswerDto> {
    let client: Anthropic;
    try {
      client = this.getClient();
    } catch (err) {
      throw new Error(this.disable(err).message);
    }
    const res = await client.messages.create({
      model: this.cfg.analyst.model,
      max_tokens: 4000,
      system: [
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        {
          type: 'text',
          text: 'Answer the user question directly in 1-4 short paragraphs or a compact list. Ground every claim in the fact sheet or headlines; state clearly when the material does not cover something.',
        },
      ],
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: `${this.factsToText(f)}\n\nQUESTION: ${question.trim()}` }],
    });
    const answer = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (res.stop_reason === 'refusal' || !answer) throw new Error('The model did not answer this question.');
    return { question, answer, model: res.model, generatedAt: new Date().toISOString() };
  }
}
