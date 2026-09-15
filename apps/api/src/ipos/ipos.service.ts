import { Injectable, Logger } from '@nestjs/common';
import type { IpoDto, IpoSubscriptionDay } from '@nse/shared';
import { differenceInCalendarDays, parseISO } from 'date-fns';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

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

      const allRaw: { item: any; status: 'OPEN' | 'UPCOMING' | 'CLOSED' }[] = [
        ...(current ?? []).map((item) => ({ item, status: 'OPEN' as const })),
        ...(upcoming ?? []).map((item) => ({ item, status: 'UPCOMING' as const })),
      ];

      if (!allRaw.length) {
        this.log.warn('No IPOs found from NSE API');
        return [];
      }

      const today = new Date();
      const ipos: IpoDto[] = [];

      for (const { item, status } of allRaw) {
        const symbol: string = item.symbol ?? item.companyName ?? 'UNKNOWN';

        // ── Subscription figures ──────────────────────────────────────────
        // NSE ipo-current-issue gives overall 'noOfTime'
        // We also fetch per-category subscription if available
        const overallSub = parseFloat(item.noOfTime) || 0;
        let qibSub = parseFloat(item.qibSubscription ?? item.qib ?? '0') || 0;
        let nniSub = parseFloat(item.nniSubscription ?? item.nni ?? item.hni ?? '0') || 0;
        let retailSub = parseFloat(item.retailSubscription ?? item.retail ?? item.rII ?? '0') || 0;

        // If NSE didn't break it down, use overall for QIB placeholder
        if (qibSub === 0 && nniSub === 0 && retailSub === 0 && overallSub > 0) {
          qibSub = overallSub;
        }

        // ── Day-wise subscription trend ───────────────────────────────────
        // NSE sometimes provides day1/day2/day3 fields
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
        // If no day breakdown but open, synthesise a single "Current" point
        if (subscriptionTrend.length === 0 && overallSub > 0 && status === 'OPEN') {
          subscriptionTrend.push({ day: 'Live', overall: overallSub, qib: qibSub, nni: nniSub, retail: retailSub });
        }

        // ── Dates & status ────────────────────────────────────────────────
        const closeDate: string = item.issueEndDate ?? item.closeDate ?? '';
        let daysToClose: number | null = null;
        if (closeDate) {
          try {
            daysToClose = differenceInCalendarDays(parseISO(closeDate), today);
            if (daysToClose < 0) daysToClose = null;
          } catch {
            /* ignore */
          }
        }

        // ── Elite classification ──────────────────────────────────────────
        const eliteReasons: string[] = [];
        let isElite = false;

        if (overallSub >= 10) {
          isElite = true;
          eliteReasons.push(`Mega demand: ${overallSub.toFixed(2)}× overall subscription`);
        } else if (overallSub >= 3) {
          isElite = true;
          eliteReasons.push(`Strong demand: ${overallSub.toFixed(2)}× overall subscription`);
        } else if (overallSub >= 2) {
          isElite = true;
          eliteReasons.push(`Good demand: ${overallSub.toFixed(2)}× overall subscription`);
        }
        if (qibSub >= 5) {
          if (!isElite) isElite = true;
          eliteReasons.push(`QIB heavily subscribed: ${qibSub.toFixed(2)}× — institutional confidence`);
        }
        if (nniSub >= 5) {
          eliteReasons.push(`HNI/NNI: ${nniSub.toFixed(2)}× — high net-worth interest`);
        }

        ipos.push({
          symbol,
          companyName: item.companyName ?? symbol,
          openDate: item.issueStartDate ?? item.openDate ?? '',
          closeDate,
          priceBand: item.issuePrice ?? item.priceBand ?? '—',
          issueSize: item.issueSize ?? item.totalIssueSize ?? '—',
          lotSize: parseInt(item.lotSize ?? '0', 10) || 0,
          qibSubscription: qibSub,
          nniSubscription: nniSub,
          retailSubscription: retailSub,
          subscriptionTrend,
          gmpPercent: 0, // Not freely available from NSE
          status,
          daysToClose,
          sector: item.industry ?? item.sector ?? 'Unknown',
          isElite,
          eliteReasons,
        });
      }

      this.log.log(`Returning ${ipos.length} IPOs`);
      return ipos;
    } catch (e) {
      this.log.error('Failed to fetch IPO data', e);
      return [];
    }
  }
}
