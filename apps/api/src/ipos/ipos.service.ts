import { Injectable, Logger } from '@nestjs/common';
import type { IpoDto } from '@nse/shared';

@Injectable()
export class IposService {
  private readonly log = new Logger(IposService.name);

  async getUpcomingIpos(): Promise<IpoDto[]> {
    try {
      this.log.log('Fetching NSE cookies...');
      const initRes = await fetch('https://www.nseindia.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const cookieStr = initRes.headers.get('set-cookie');
      let cookieString = '';
      if (cookieStr) {
        cookieString = cookieStr.split(',').map(c => c.split(';')[0].trim()).join('; ');
      }

      this.log.log('Fetching IPO Current Issue API...');
      const apiRes = await fetch('https://www.nseindia.com/api/ipo-current-issue', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Cookie': cookieString,
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      if (!apiRes.ok) {
        throw new Error(`NSE API failed: ${apiRes.status}`);
      }

      const data = await apiRes.json();
      
      const ipos: IpoDto[] = data.map((item: any) => {
        const sub = parseFloat(item.noOfTime) || 0;
        const eliteReasons: string[] = [];
        let isElite = false;
        
        // Elite grade based on real-time overall subscription > 2.0x (as some IPOs don't reach 10x until the very last day)
        if (sub > 2) {
          isElite = true;
          eliteReasons.push(`High Demand: Oversubscribed by ${sub.toFixed(2)}x`);
        }

        return {
          symbol: item.symbol,
          companyName: item.companyName,
          openDate: item.issueStartDate,
          closeDate: item.issueEndDate,
          priceBand: item.issuePrice,
          lotSize: 0, // NSE API doesn't provide lot size in this endpoint
          qibSubscription: sub, // Using total sub for now
          nniSubscription: 0,
          retailSubscription: 0,
          gmpPercent: 0, // No real-time GMP available freely from NSE
          isElite,
          eliteReasons
        };
      });

      return ipos;
    } catch (e) {
      this.log.error('Failed to fetch real-time IPO data', e);
      return [];
    }
  }
}
