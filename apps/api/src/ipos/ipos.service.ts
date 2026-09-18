import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IpoDto, IpoSubscriptionDay } from '@nse/shared';
import { differenceInCalendarDays } from 'date-fns';
import { StockEntity } from '../database/entities/stock.entity.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/** Parse date from either ISO ("2026-09-18") or NSE format ("18-Sep-2026") */
function parseNseDate(str: string): Date | null {
  if (!str) return null;
  const d1 = new Date(str);
  if (!isNaN(d1.getTime())) return d1;
  const parts = str.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (parts) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const m = months[parts[2].toLowerCase()];
    if (m !== undefined) return new Date(parseInt(parts[3], 10), m, parseInt(parts[1], 10));
  }
  return null;
}

/** Extract upper cutoff/issue price from price band string (e.g. "Rs. 88 to Rs. 93" -> 93) */
function parseCutoffPrice(str: string): number {
  if (!str) return 0;
  const matches = str.match(/\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return 0;
  return Math.max(...matches.map(Number));
}

/** Extract lot size from string (e.g. "161 Equity Shares" -> 161) */
function parseLotSize(str: string): number {
  if (!str) return 0;
  const matches = str.match(/\d+/);
  return matches ? parseInt(matches[0], 10) : 0;
}

/** Add business days (skipping weekends) for SEBI T+3 IPO listing mandate */
function addBusinessDays(date: Date, days: number): Date {
  const cur = new Date(date);
  let added = 0;
  while (added < days) {
    cur.setDate(cur.getDate() + 1);
    const day = cur.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return cur;
}

function formatDisplayDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const mon = months[d.getMonth()];
  const yr = d.getFullYear();
  return `${day}-${mon}-${yr}`;
}

/** Calculate expected listing gain % and price based on oversubscription & institutional demand */
function calcExpectedListing(overallSub: number, qibSub: number, cutoffPrice: number): {
  expectedGainPct: number;
  expectedListingPrice: number;
} {
  let expectedGainPct = 0;
  if (overallSub >= 50) {
    expectedGainPct = Math.min(115, Math.round(50 + (overallSub - 50) * 0.35));
  } else if (overallSub >= 30) {
    expectedGainPct = Math.round(35 + (overallSub - 30) * 0.75);
  } else if (overallSub >= 10) {
    expectedGainPct = Math.round(15 + (overallSub - 10) * 1.0);
  } else if (overallSub >= 3) {
    expectedGainPct = Math.round(5 + (overallSub - 3) * 1.4);
  } else if (overallSub >= 1) {
    expectedGainPct = Math.round((overallSub - 1) * 2.5);
  } else {
    expectedGainPct = 0;
  }

  // Institutional kicker if QIB subscribed heavily
  if (qibSub >= 30 && expectedGainPct < 40) {
    expectedGainPct = 40;
  }

  const expectedListingPrice = cutoffPrice > 0
    ? Math.round(cutoffPrice * (1 + expectedGainPct / 100) * 10) / 10
    : 0;

  return { expectedGainPct, expectedListingPrice };
}

interface CachedIpos {
  timestamp: number;
  data: IpoDto[];
}

@Injectable()
export class IposService {
  private readonly log = new Logger(IposService.name);
  private cache: CachedIpos | null = null;
  private readonly CACHE_TTL_MS = 60_000; // 1 minute cache

  constructor(
    @InjectRepository(StockEntity)
    private readonly stockRepo: Repository<StockEntity>,
  ) { }

  /** Fetch NSE cookies needed for subsequent API calls */
  private async getNseCookies(): Promise<string> {
    const res = await fetch('https://www.nseindia.com', {
      headers: { 'User-Agent': UA },
    });
    const raw = res.headers.get('set-cookie') ?? '';
    return raw
      .split(',')
      .map((c) => c.split(';')[0].trim())
      .join('; ');
  }

  /** Generic NSE API fetch with cookie */
  private async nseGet<T>(path: string, cookies: string): Promise<T | null> {
    try {
      const res = await fetch(`https://www.nseindia.com${path}`, {
        headers: {
          'User-Agent': UA,
          Cookie: cookies,
          Accept: '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://www.nseindia.com/',
        },
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  async getUpcomingIpos(): Promise<IpoDto[]> {
    // Return cached data if fresh
    if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL_MS) {
      return this.cache.data;
    }

    try {
      this.log.log('Fetching NSE cookies...');
      const cookies = await this.getNseCookies();

      // 1. Fetch current/open IPOs
      this.log.log('Fetching IPO current issues from NSE...');
      const current = await this.nseGet<any[]>('/api/ipo-current-issue', cookies);

      // 2. Fetch upcoming IPOs (proper NSE endpoint)
      this.log.log('Fetching IPO upcoming issues from NSE...');
      const upcoming = await this.nseGet<any[]>('/api/all-upcoming-issues?category=ipo', cookies);

      // 3. Query all listed symbols in secondary market to prevent already-listed stocks from appearing
      const listedStocks = await this.stockRepo.find({ select: { symbol: true } });
      const listedSymbols = new Set(listedStocks.map((s) => s.symbol.toUpperCase()));
      this.log.log(`Loaded ${listedSymbols.size} listed stock symbols for filtering.`);

      const allRaw: { item: any; source: 'CURRENT' | 'UPCOMING' }[] = [
        ...(current ?? []).map((item) => ({ item, source: 'CURRENT' as const })),
        ...(upcoming ?? []).map((item) => ({ item, source: 'UPCOMING' as const })),
      ];

      if (!allRaw.length) {
        this.log.warn('No IPOs found from NSE API');
        return [];
      }

      const today = new Date();
      const ipos: IpoDto[] = [];
      const seenSymbols = new Set<string>();

      for (const { item, source } of allRaw) {
        const symbol: string = (item.symbol ?? item.companyName ?? '').trim();
        if (!symbol || seenSymbols.has(symbol.toUpperCase())) continue;
        seenSymbols.add(symbol.toUpperCase());

        // CRITICAL FILTER: If this symbol is already listed in the secondary market, exclude it!
        if (listedSymbols.has(symbol.toUpperCase())) {
          this.log.debug(`Skipping already-listed stock: ${symbol}`);
          continue;
        }

        // Fetch detailed breakdown from /api/ipo-detail?symbol=...
        let detailData: any = null;
        try {
          detailData = await this.nseGet<any>(`/api/ipo-detail?symbol=${encodeURIComponent(symbol)}`, cookies);
        } catch {
          /* ignore detail fetch errors */
        }

        // ── Subscription figures ──────────────────────────────────────────
        let overallSub = parseFloat(item.noOfTime) || 0;
        let qibSub = parseFloat(item.qibSubscription ?? item.qib ?? '0') || 0;
        let nniSub = parseFloat(item.nniSubscription ?? item.nni ?? item.hni ?? '0') || 0;
        let retailSub = parseFloat(item.retailSubscription ?? item.retail ?? item.rII ?? '0') || 0;

        // Parse from detailData if available
        if (detailData && Array.isArray(detailData.bidDetails)) {
          for (const b of detailData.bidDetails) {
            const cat = (b.category || '').toLowerCase();
            const val = parseFloat(b.noOfTime) || 0;
            if (cat === 'total' && val > 0) {
              overallSub = val;
            } else if (cat.includes('qualified institutional buyers') && val > 0) {
              qibSub = val;
            } else if ((cat === 'non institutional investors' || cat.includes('non institutional')) && val > 0 && nniSub === 0) {
              nniSub = val;
            } else if (cat.includes('retail individual investors') && val > 0) {
              retailSub = val;
            }
          }
        }

        if (qibSub === 0 && nniSub === 0 && retailSub === 0 && overallSub > 0) {
          qibSub = overallSub;
        }

        // ── Lot size & price from issueInfo if available ──────────────────
        let lotSize = parseInt(item.lotSize ?? '0', 10) || 0;
        let priceBand = item.issuePrice ?? item.priceBand ?? '—';
        let issueSize = item.issueSize ?? item.totalIssueSize ?? '—';

        if (detailData?.issueInfo?.dataList && Array.isArray(detailData.issueInfo.dataList)) {
          for (const row of detailData.issueInfo.dataList) {
            const title = (row.title || '').toLowerCase();
            if (title.includes('bid lot') && lotSize === 0) {
              lotSize = parseLotSize(row.value);
            } else if (title.includes('price range') && priceBand === '—') {
              priceBand = row.value;
            } else if (title.includes('issue size') && issueSize === '—') {
              issueSize = row.value;
            }
          }
        }

        // ── Dates & status resolution ─────────────────────────────────────
        const openDate: string = item.issueStartDate ?? item.openDate ?? '';
        const closeDate: string = item.issueEndDate ?? item.closeDate ?? '';
        const parsedOpenDate = parseNseDate(openDate);
        const parsedCloseDate = parseNseDate(closeDate);

        let daysToClose: number | null = null;
        let daysToListing: number | null = null;
        let listingDate: string | undefined;
        let status: 'OPEN' | 'UPCOMING' | 'CLOSED' = source === 'UPCOMING' ? 'UPCOMING' : 'OPEN';

        if (parsedCloseDate) {
          try {
            daysToClose = differenceInCalendarDays(parsedCloseDate, today);
            const expectedListingD = addBusinessDays(parsedCloseDate, 3);
            listingDate = formatDisplayDate(expectedListingD);
            daysToListing = differenceInCalendarDays(expectedListingD, today);

            // If bidding has closed:
            if (daysToClose < 0 || (item.status && String(item.status).toLowerCase().includes('close'))) {
              // If listing date has already passed, this issue has already debuted and is no longer an IPO awaiting listing!
              if (daysToListing < 0 || daysToClose < -4) {
                this.log.debug(`Skipping past-listed IPO: ${symbol} (Listing was ${listingDate})`);
                continue;
              }
              // Still inside SEBI T+3 listing window
              status = 'CLOSED';
              daysToClose = null;
            }
          } catch {
            /* ignore date diff errors */
          }
        }

        if (status !== 'CLOSED' && parsedOpenDate) {
          const daysToOpen = differenceInCalendarDays(parsedOpenDate, today);
          if (daysToOpen > 0) {
            status = 'UPCOMING';
          } else {
            status = 'OPEN';
          }
        }

        // ── Expected listing calculation ──────────────────────────────────
        const cutoffPrice = parseCutoffPrice(priceBand);
        const { expectedGainPct, expectedListingPrice } = calcExpectedListing(overallSub, qibSub, cutoffPrice);

        // ── Day-wise subscription trend ───────────────────────────────────
        const subscriptionTrend: IpoSubscriptionDay[] = [];
        const day1Overall = parseFloat(item.day1 ?? item.day_1 ?? '0') || 0;
        const day2Overall = parseFloat(item.day2 ?? item.day_2 ?? '0') || 0;
        const day3Overall = parseFloat(item.day3 ?? item.day_3 ?? '0') || 0;

        if (day1Overall > 0) {
          subscriptionTrend.push({ day: 'Day 1', overall: day1Overall, qib: 0, nni: 0, retail: day1Overall });
        }
        if (day2Overall > 0) {
          subscriptionTrend.push({ day: 'Day 2', overall: day2Overall, qib: 0, nni: 0, retail: day2Overall });
        }
        if (day3Overall > 0) {
          subscriptionTrend.push({ day: 'Day 3', overall: day3Overall, qib: 0, nni: 0, retail: day3Overall });
        }
        if (subscriptionTrend.length === 0 && overallSub > 0 && status !== 'UPCOMING') {
          subscriptionTrend.push({ day: 'Final', overall: overallSub, qib: qibSub, nni: nniSub, retail: retailSub });
        }

        // ── Elite classification (Subscription ≥ 30x threshold) ──────────
        const eliteReasons: string[] = [];
        let isElite = false;

        if (overallSub >= 30) {
          isElite = true;
          eliteReasons.push(`Blockbuster demand: ${overallSub.toFixed(2)}× overall subscription (≥ 30× Elite Grade threshold)`);
        } else if (qibSub >= 30) {
          isElite = true;
          eliteReasons.push(`Massive institutional demand: ${qibSub.toFixed(2)}× QIB subscription (≥ 30× Elite Grade threshold)`);
        }

        if (isElite) {
          if (qibSub >= 10 && overallSub >= 30) {
            eliteReasons.push(`Strong institutional backing: ${qibSub.toFixed(2)}× QIB`);
          }
          if (nniSub >= 10) {
            eliteReasons.push(`High HNI/NNI participation: ${nniSub.toFixed(2)}×`);
          }
        }

        ipos.push({
          symbol,
          companyName: item.companyName ?? symbol,
          openDate,
          closeDate,
          priceBand,
          issueSize,
          lotSize,
          overallSubscription: overallSub,
          qibSubscription: qibSub,
          nniSubscription: nniSub,
          retailSubscription: retailSub,
          subscriptionTrend,
          gmpPercent: 0,
          status,
          daysToClose,
          sector: item.industry ?? item.sector ?? 'General',
          isElite,
          eliteReasons,
          cutoffPrice: cutoffPrice > 0 ? cutoffPrice : undefined,
          listingDate,
          daysToListing: daysToListing !== null && daysToListing >= 0 ? daysToListing : undefined,
          isListingDateConfirmed: false,
          listingDateNote: 'Tentative date computed per SEBI T+3 mandate (3 business days post issue close). Official listing date notified by NSE circular post-allotment.',
          expectedListingPrice: expectedListingPrice > 0 ? expectedListingPrice : undefined,
          expectedListingGainPercent: expectedGainPct > 0 ? expectedGainPct : undefined,
        });
      }

      this.log.log(`Returning ${ipos.length} real live IPOs`);
      this.cache = { timestamp: Date.now(), data: ipos };
      return ipos;
    } catch (e) {
      this.log.error('Failed to fetch IPO data', e);
      return this.cache ? this.cache.data : [];
    }
  }
}

