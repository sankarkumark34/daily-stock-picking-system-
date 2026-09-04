import { Injectable, Logger } from '@nestjs/common';
import type { NewsItem } from '@nse/shared';
import { loadConfig } from '../config/app.config.js';

const TTL_MS = 30 * 60_000;

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();

const tag = (xml: string, name: string): string | null => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : null;
};

/**
 * Recent headlines from Google News RSS (no API key). Used as context for the
 * AI analyst and shown to the user with source + timestamp. Cached 30 minutes.
 */
@Injectable()
export class NewsService {
  private readonly log = new Logger(NewsService.name);
  private readonly cfg = loadConfig();
  private cache = new Map<string, { at: number; items: NewsItem[] }>();

  async search(query: string, limit = 12): Promise<NewsItem[]> {
    const key = query.toLowerCase();
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.items.slice(0, limit);
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
    const res = await fetch(url, {
      headers: { 'User-Agent': this.cfg.data.userAgent, Accept: 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`news feed HTTP ${res.status}`);
    const xml = await res.text();
    const items: NewsItem[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const block = m[1];
      const title = tag(block, 'title');
      const link = tag(block, 'link');
      if (!title || !link) continue;
      const pub = tag(block, 'pubDate');
      const source = tag(block, 'source');
      items.push({
        title: title.replace(/\s+-\s+[^-]+$/, ''), // strip trailing " - Publisher"
        source,
        url: link,
        publishedAt: pub ? new Date(pub).toISOString() : null,
      });
    }
    items.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
    this.cache.set(key, { at: Date.now(), items });
    this.log.debug(`news "${query}": ${items.length} items`);
    return items.slice(0, limit);
  }
}
