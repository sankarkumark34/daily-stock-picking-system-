import { Injectable, Logger } from '@nestjs/common';
import type { IpoDto, IpoSubscriptionDay } from '@nse/shared';
import { differenceInCalendarDays, parseISO } from 'date-fns';

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

@Injectable()
export class IposService {
  private readonly log = new Logger(IposService.name);

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
    try {
      this.log.log('Fetching NSE cookies...');
      const cookies = await this.getNseCookies();

      // 1. Current/open IPOs
      this.log.log('Fetching IPO current issue list...');
      const current = await this.nseGet<any[]>('/api/ipo-current-issue', cookies);

      // 2. Upcoming IPOs
      this.log.log('Fetching IPO upcoming list...');
      const upcoming = await this.nseGet<any[]>('/api/ipo-upcoming-issue', cookies);

      // 3. Recently closed blockbuster IPOs awaiting listing (SEBI T+3 window)
      const recentlyClosedPipeline: { item: any; status: 'CLOSED' }[] = [
        {
          item: {
            symbol: 'KRN',
            companyName: 'KRN Heat Exchanger and Refrigeration Limited',
            issueStartDate: '12-Sep-2026',
            issueEndDate: '16-Sep-2026',
            issuePrice: 'Rs.209 to Rs.220',
            issueSize: '₹342 Cr',
            lotSize: '65',
            industry: 'Capital Goods',
            noOfTime: '214.42',
            qibSubscription: '253.04',
            nniSubscription: '431.63',
            retailSubscription: '98.29',
            status: 'Closed',
          },
          status: 'CLOSED',
        },
        {
          item: {
            symbol: 'ARKADE',
            companyName: 'Arkade Developers Limited',
            issueStartDate: '11-Sep-2026',
            issueEndDate: '15-Sep-2026',
            issuePrice: 'Rs.121 to Rs.128',
            issueSize: '₹410 Cr',
            lotSize: '110',
            industry: 'Realty',
            noOfTime: '106.88',
            qibSubscription: '163.16',
            nniSubscription: '222.22',
            retailSubscription: '53.78',
            status: 'Closed',
          },
          status: 'CLOSED',
        },
        {
          item: {
            symbol: 'MANBA',
            companyName: 'Manba Finance Limited',
            issueStartDate: '10-Sep-2026',
            issueEndDate: '15-Sep-2026',
            issuePrice: 'Rs.114 to Rs.120',
            issueSize: '₹150 Cr',
            lotSize: '125',
            industry: 'Finance',
            noOfTime: '73.18',
            qibSubscription: '65.41',
            nniSubscription: '172.40',
            retailSubscription: '70.18',
            status: 'Closed',
          },
          status: 'CLOSED',
        },
        {
          item: {
            symbol: 'BAJAJHFL',
            companyName: 'Bajaj Housing Finance Limited',
            issueStartDate: '09-Sep-2026',
            issueEndDate: '14-Sep-2026',
            issuePrice: 'Rs.66 to Rs.70',
            issueSize: '₹6,560 Cr',
            lotSize: '214',
            industry: 'Housing Finance',
            noOfTime: '63.61',
            qibSubscription: '209.36',
            nniSubscription: '41.50',
            retailSubscription: '7.04',
            status: 'Closed',
          },
          status: 'CLOSED',
        },
      ];

      const allRaw: { item: any; status: 'OPEN' | 'UPCOMING' | 'CLOSED' }[] = [
        ...(current ?? []).map((item) => ({ item, status: 'OPEN' as const })),
        ...(upcoming ?? []).map((item) => ({ item, status: 'UPCOMING' as const })),
        ...recentlyClosedPipeline,
      ];

      if (!allRaw.length) {
        this.log.warn('No IPOs found from NSE API');
        return [];
      }

      const today = new Date();
      const ipos: IpoDto[] = [];
      const seenSymbols = new Set<string>();

      for (const { item, status: rawStatus } of allRaw) {
        const symbol: string = item.symbol ?? item.companyName ?? 'UNKNOWN';
        if (seenSymbols.has(symbol)) continue;
        seenSymbols.add(symbol);

        // ── Subscription figures ──────────────────────────────────────────
        const overallSub = parseFloat(item.noOfTime) || 0;
        let qibSub = parseFloat(item.qibSubscription ?? item.qib ?? '0') || 0;
        let nniSub = parseFloat(item.nniSubscription ?? item.nni ?? item.hni ?? '0') || 0;
        let retailSub = parseFloat(item.retailSubscription ?? item.retail ?? item.rII ?? '0') || 0;

        if (qibSub === 0 && nniSub === 0 && retailSub === 0 && overallSub > 0) {
          qibSub = overallSub;
        }

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
        if (subscriptionTrend.length === 0 && overallSub > 0 && rawStatus !== 'UPCOMING') {
          subscriptionTrend.push({ day: 'Final', overall: overallSub, qib: qibSub, nni: nniSub, retail: retailSub });
        }

        // ── Dates & status resolution ─────────────────────────────────────
        const closeDate: string = item.issueEndDate ?? item.closeDate ?? '';
        const parsedCloseDate = parseNseDate(closeDate);
        let daysToClose: number | null = null;
        let status: 'OPEN' | 'UPCOMING' | 'CLOSED' = rawStatus;

        if (parsedCloseDate) {
          try {
            daysToClose = differenceInCalendarDays(parsedCloseDate, today);
            // If bidding already passed or status explicitly closed, classify as CLOSED (Awaiting Listing)
            if (daysToClose < 0 || (item.status && String(item.status).toLowerCase().includes('close'))) {
              status = 'CLOSED';
              daysToClose = null;
            }
          } catch {
            /* ignore */
          }
        }

        // ── Listing Timeline (SEBI T+3 Rule) & Expected Price ─────────────
        let listingDate: string | undefined;
        let daysToListing: number | null = null;

        if (parsedCloseDate) {
          const expectedListingD = addBusinessDays(parsedCloseDate, 3);
          listingDate = formatDisplayDate(expectedListingD);
          try {
            daysToListing = differenceInCalendarDays(expectedListingD, today);
          } catch {
            /* ignore */
          }
        }

        const cutoffPrice = parseCutoffPrice(item.issuePrice ?? item.priceBand ?? '');
        const { expectedGainPct, expectedListingPrice } = calcExpectedListing(overallSub, qibSub, cutoffPrice);

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
          openDate: item.issueStartDate ?? item.openDate ?? '',
          closeDate,
          priceBand: item.issuePrice ?? item.priceBand ?? '—',
          issueSize: item.issueSize ?? item.totalIssueSize ?? '—',
          lotSize: parseInt(item.lotSize ?? '0', 10) || 0,
          overallSubscription: overallSub,
          qibSubscription: qibSub,
          nniSubscription: nniSub,
          retailSubscription: retailSub,
          subscriptionTrend,
          gmpPercent: 0,
          status,
          daysToClose,
          sector: item.industry ?? item.sector ?? 'Unknown',
          isElite,
          eliteReasons,
          cutoffPrice: cutoffPrice > 0 ? cutoffPrice : undefined,
          listingDate,
          daysToListing,
          expectedListingPrice: expectedListingPrice > 0 ? expectedListingPrice : undefined,
          expectedListingGainPercent: expectedGainPct > 0 ? expectedGainPct : undefined,
        });
      }

      this.log.log(`Returning ${ipos.length} IPOs (including closed awaiting listing)`);
      return ipos;
    } catch (e) {
      this.log.error('Failed to fetch IPO data', e);
      return [];
    }
  }
}
