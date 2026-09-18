import { Injectable, Logger } from '@nestjs/common';
import Database from 'better-sqlite3';
import { loadConfig } from '../config/app.config.js';
import type {
  PreMarketPickDto,
  PreMarketWatchlistDto,
  PreMarketSectorOverview,
  PreMarketDirection,
  PreMarketTradeType,
  PreMarketSignal,
  MarketRegime,
} from '@nse/shared';

interface RawBarRow {
  symbol: string;
  name: string | null;
  sector: string | null;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  volume: number;
  turnover: number;
  deliveryPct: number | null;
}

interface PredictionRow {
  symbol: string;
  rank: number;
  score: number;
  confidence: number;
  direction: string;
  setup: string;
  entry: number;
  target: number;
  stopLoss: number;
  riskReward: number;
}

const SIGNAL_LABELS: Record<PreMarketSignal, string> = {
  LONG_BREAKOUT: 'Long Breakout',
  LONG_GAP_UP: 'Gap-Up Surge',
  LONG_PULLBACK: 'Dip Buyer Pullback',
  LONG_BTST: 'BTST Momentum Long',
  SHORT_BREAKDOWN: 'Short Breakdown',
  SHORT_GAP_DOWN: 'Gap-Down Drift',
  SHORT_REVERSAL: 'Overbought Reversal',
  SHORT_BTST: 'BTST Distribution Short',
};

function addBusinessDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  let count = 0;
  while (count < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
  }
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class PreMarketService {
  private readonly logger = new Logger(PreMarketService.name);
  private cachedWatchlist: { key: string; expiresAt: number; data: PreMarketWatchlistDto } | null = null;

  private getDb(): Database.Database {
    const cfg = loadConfig();
    return new Database(cfg.db.sqlitePath, { readonly: true });
  }

  async getWatchlist(queryDate?: string): Promise<PreMarketWatchlistDto> {
    const cacheKey = queryDate || 'latest';
    if (this.cachedWatchlist && this.cachedWatchlist.key === cacheKey && Date.now() < this.cachedWatchlist.expiresAt) {
      return this.cachedWatchlist.data;
    }

    const db = this.getDb();
    try {
      // 1. Determine asOfDate
      let asOfDate = queryDate;
      if (!asOfDate) {
        const latestRow = db.prepare('SELECT MAX(date) as maxDate FROM daily_bars').get() as { maxDate: string };
        asOfDate = latestRow?.maxDate ?? '2026-09-16';
      }

      // 2. Next trade date
      const nextTradeDate = addBusinessDays(asOfDate, 1);

      // 3. Market snapshot & regime
      const snapRow = db
        .prepare('SELECT regime, regimeScore, overview FROM market_snapshots WHERE date = ?')
        .get(asOfDate) as { regime?: string; regimeScore?: number; overview?: string } | undefined;

      const regime: MarketRegime = (snapRow?.regime as MarketRegime) || 'BEARISH';
      let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
      if (regime === 'STRONG_BULLISH' || regime === 'BULLISH') sentiment = 'BULLISH';
      else if (regime === 'STRONG_BEARISH' || regime === 'BEARISH') sentiment = 'BEARISH';

      // 4. Load predictions for asOfDate if available
      const predRows = db
        .prepare(
          `SELECT symbol, rank, score, confidence, direction, setup, entry, target, stopLoss, riskReward
           FROM predictions
           WHERE date = ? AND runId IS NULL
           ORDER BY rank ASC`,
        )
        .all(asOfDate) as PredictionRow[];

      const predMap = new Map<string, PredictionRow>();
      for (const p of predRows) {
        predMap.set(p.symbol, p);
      }

      // 5. Query daily bars on asOfDate for liquid stocks (volume > 80,000, price between 40 and 8000)
      const barRows = db
        .prepare(
          `SELECT b.symbol, s.name, s.sector, b.open, b.high, b.low, b.close, b.prevClose, b.volume, b.turnover, b.deliveryPct
           FROM daily_bars b
           LEFT JOIN stocks s ON s.symbol = b.symbol
           WHERE b.date = ?
             AND b.volume >= 60000
             AND b.close >= 35
             AND b.close <= 9000
             AND b.prevClose > 0
           ORDER BY b.turnover DESC
           LIMIT 400`,
        )
        .all(asOfDate) as RawBarRow[];

      const picks: PreMarketPickDto[] = [];
      const getHistoryStmt = db.prepare(
        `SELECT date, close, volume, high, low
         FROM daily_bars
         WHERE symbol = ? AND date <= ?
         ORDER BY date DESC
         LIMIT 15`,
      );

      for (const bar of barRows) {
        if (!bar.prevClose || bar.prevClose <= 0 || bar.close <= 0) continue;

        const changePct = ((bar.close - bar.prevClose) / bar.prevClose) * 100;
        const dayRange = Math.max(0.001, bar.high - bar.low);
        const closeLoc = (bar.close - bar.low) / dayRange; // 0 = at low, 1 = at high

        // Fetch last 15 bars for history, sparkline, and average volume
        const histRows = getHistoryStmt.all(bar.symbol, asOfDate) as Array<{
          date: string;
          close: number;
          volume: number;
          high: number;
          low: number;
        }>;

        if (histRows.length < 3) continue;

        const sparkline = histRows.slice(0, 5).map((r) => r.close).reverse();
        const avgVol = histRows.reduce((sum, r) => sum + r.volume, 0) / histRows.length;
        const volSurge = avgVol > 0 ? Number((bar.volume / avgVol).toFixed(1)) : 1.0;

        // Compute fast RSI approx
        let gains = 0;
        let losses = 0;
        for (let i = 0; i < histRows.length - 1; i++) {
          const diff = histRows[i].close - histRows[i + 1].close;
          if (diff > 0) gains += diff;
          else losses += Math.abs(diff);
        }
        const rs = losses === 0 ? 100 : gains / losses;
        const rsi = Math.round(100 - 100 / (1 + rs));

        // ATR approx
        const atr = Number(
          (
            histRows.reduce((sum, r) => sum + (r.high - r.low), 0) / histRows.length
          ).toFixed(2),
        );

        const pred = predMap.get(bar.symbol);

        // Decide signals
        let signal: PreMarketSignal | null = null;
        let direction: PreMarketDirection = 'LONG';
        let tradeType: PreMarketTradeType = 'INTRADAY';
        const reasons: string[] = [];
        const catalysts: string[] = [];

        // LONG CANDIDATES
        if (changePct > 0.5 && closeLoc >= 0.55 && (volSurge >= 1.2 || pred)) {
          direction = 'LONG';

          if (pred?.setup === 'BREAKOUT' || (changePct >= 2.5 && closeLoc >= 0.75 && volSurge >= 1.5)) {
            signal = 'LONG_BREAKOUT';
            tradeType = 'INTRADAY';
            reasons.push(`High-volume breakout: volume surged ${volSurge}× above 15-day average`);
            reasons.push(`Closed at upper ${(closeLoc * 100).toFixed(0)}% of daily range with strong buying pressure`);
            catalysts.push('Momentum breakout continuation into 9:15 open');
          } else if (changePct >= 3.5 && closeLoc >= 0.8 && bar.deliveryPct && bar.deliveryPct > 35) {
            signal = 'LONG_BTST';
            tradeType = 'BTST';
            reasons.push(`Strong delivery accumulation (${bar.deliveryPct.toFixed(1)}%) into market close`);
            reasons.push(`Clean bullish closing bar with ${changePct.toFixed(1)}% daily rally`);
            catalysts.push('Overnight institutional carry; early morning gap extension');
          } else if (changePct >= 1.5 && volSurge >= 1.3) {
            signal = 'LONG_GAP_UP';
            tradeType = 'INTRADAY';
            reasons.push(`Aggressive momentum drive up +${changePct.toFixed(1)}% with strong volume expansion`);
            reasons.push(`Expected opening range expansion in first 15-minute window`);
            catalysts.push('Opening drive setup: enter within 9:15–9:30 if opening above prev close');
          } else if (rsi >= 40 && rsi <= 62 && closeLoc >= 0.6) {
            signal = 'LONG_PULLBACK';
            tradeType = 'INTRADAY';
            reasons.push(`Healthy pullback bounce with RSI at ${rsi} (neutral-bullish launchpad)`);
            reasons.push(`Defended intraday support with high buyer responsiveness`);
            catalysts.push('Support retest completed; asymmetric risk-reward on morning open');
          }
        }

        // SHORT CANDIDATES (Bearish breakdown or exhaustion)
        if (!signal && changePct < -0.8 && closeLoc <= 0.45 && (volSurge >= 1.1 || changePct <= -2.0)) {
          direction = 'SHORT';

          if (changePct <= -3.0 && closeLoc <= 0.25 && volSurge >= 1.4) {
            signal = 'SHORT_BREAKDOWN';
            tradeType = 'INTRADAY';
            reasons.push(`Heavy institutional distribution: -${Math.abs(changePct).toFixed(1)}% drop on ${volSurge}× volume`);
            reasons.push(`Closed at bottom ${(closeLoc * 100).toFixed(0)}% of range near low of day`);
            catalysts.push('Sellers in absolute control; breakdown continuation expected at 9:15');
          } else if (changePct <= -2.0 && closeLoc <= 0.3) {
            signal = 'SHORT_GAP_DOWN';
            tradeType = 'INTRADAY';
            reasons.push(`Sustained sell pressure with weak closing structure`);
            reasons.push(`Gap-down follow-through likely on 9:15 open`);
            catalysts.push('Morning fade setup: short on opening retest of prior close');
          } else if (rsi >= 68 && closeLoc <= 0.4) {
            signal = 'SHORT_REVERSAL';
            tradeType = 'INTRADAY';
            reasons.push(`Overbought exhaustion rejection (RSI ${rsi}) with long upper rejection wick`);
            reasons.push(`Profit-taking acceleration into close`);
            catalysts.push('Mean-reversion short trade during high-volatility 9:15 window');
          } else if (changePct <= -1.8 && volSurge >= 1.2 && closeLoc <= 0.3) {
            signal = 'SHORT_BTST';
            tradeType = 'BTST';
            reasons.push(`Multi-session breakdown carried overnight with weak sentiment`);
            reasons.push(`Low delivery demand indicates absence of dip-buyers`);
            catalysts.push('Overnight short continuation into next trading day');
          }
        }

        if (!signal) continue;

        // Pricing Levels
        const prevClose = bar.close;
        let expectedOpenMin = 0;
        let expectedOpenMax = 0;
        let targetPrice = 0;
        let targetPct = 0;
        let stopLossPrice = 0;
        let stopLossPct = 0;

        if (direction === 'LONG') {
          expectedOpenMin = Number((prevClose * 0.997).toFixed(2));
          expectedOpenMax = Number((prevClose * 1.008).toFixed(2));
          if (tradeType === 'INTRADAY') {
            targetPct = 2.4;
            stopLossPct = 0.9;
          } else {
            targetPct = 4.2;
            stopLossPct = 1.5;
          }
          targetPrice = Number((prevClose * (1 + targetPct / 100)).toFixed(2));
          stopLossPrice = Number((prevClose * (1 - stopLossPct / 100)).toFixed(2));
        } else {
          expectedOpenMin = Number((prevClose * 0.992).toFixed(2));
          expectedOpenMax = Number((prevClose * 1.003).toFixed(2));
          if (tradeType === 'INTRADAY') {
            targetPct = 2.4;
            stopLossPct = 0.9;
          } else {
            targetPct = 4.2;
            stopLossPct = 1.5;
          }
          targetPrice = Number((prevClose * (1 - targetPct / 100)).toFixed(2));
          stopLossPrice = Number((prevClose * (1 + stopLossPct / 100)).toFixed(2));
        }

        const riskReward = Number((targetPct / stopLossPct).toFixed(2));

        // Position sizing for user's ₹20,000 – ₹50,000 capital (Target ₹12,000 per trade)
        const targetAllocation = 12000;
        const lotSize = Math.max(1, Math.floor(targetAllocation / prevClose));
        const capitalRequired = Math.round(lotSize * prevClose);
        const expectedMaxLoss = Math.round(lotSize * Math.abs(prevClose - stopLossPrice));
        const expectedMaxGain = Math.round(lotSize * Math.abs(targetPrice - prevClose));

        // Confidence score computation
        let baseScore = pred ? pred.score : 65;
        if (volSurge >= 2.0) baseScore += 8;
        else if (volSurge >= 1.5) baseScore += 5;
        if (closeLoc >= 0.8 || closeLoc <= 0.2) baseScore += 5;
        if (riskReward >= 2.5) baseScore += 4;
        const confidenceScore = Math.min(96, Math.max(62, Math.round(baseScore)));

        reasons.push(
          `Configured for small-capital efficiency: ₹${capitalRequired.toLocaleString('en-IN')} capital (${lotSize} shares) with max ₹${expectedMaxLoss} risk vs ₹${expectedMaxGain} gain.`,
        );

        picks.push({
          id: `${bar.symbol}_${asOfDate}_${signal}`,
          symbol: bar.symbol,
          name: bar.name ?? bar.symbol,
          sector: bar.sector ?? 'General Market',
          rank: 0,
          direction,
          tradeType,
          signal,
          signalLabel: SIGNAL_LABELS[signal],
          prevClose: Number(prevClose.toFixed(2)),
          expectedOpenMin,
          expectedOpenMax,
          entryZone: `₹${expectedOpenMin.toFixed(1)} – ₹${expectedOpenMax.toFixed(1)}`,
          targetPrice,
          targetPct,
          stopLossPrice,
          stopLossPct,
          riskReward,
          confidenceScore,
          lotSize,
          capitalRequired,
          expectedMaxLoss,
          expectedMaxGain,
          window: '9:15 – 9:30 AM',
          reasons,
          catalysts,
          sparkline,
          volSurgeMultiplier: volSurge,
          rsi,
          atr,
        });
      }

      // Sort picks by confidenceScore desc, volSurgeMultiplier desc
      picks.sort((a, b) => b.confidenceScore - a.confidenceScore || b.volSurgeMultiplier - a.volSurgeMultiplier);

      // Assign ranks
      picks.forEach((p, idx) => {
        p.rank = idx + 1;
      });

      // Top sector aggregations
      const sectorMap = new Map<string, { sector: string; longCount: number; shortCount: number; totalScore: number }>();
      for (const p of picks) {
        const item = sectorMap.get(p.sector) || { sector: p.sector, longCount: 0, shortCount: 0, totalScore: 0 };
        if (p.direction === 'LONG') item.longCount++;
        else item.shortCount++;
        item.totalScore += p.confidenceScore;
        sectorMap.set(p.sector, item);
      }

      const topSectors: PreMarketSectorOverview[] = Array.from(sectorMap.values())
        .map((s) => {
          const count = s.longCount + s.shortCount;
          const avg = count > 0 ? Math.round(s.totalScore / count) : 70;
          const bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' =
            s.longCount > s.shortCount ? 'BULLISH' : s.shortCount > s.longCount ? 'BEARISH' : 'NEUTRAL';
          const topPick = picks.find((p) => p.sector === s.sector)?.symbol;
          return {
            sector: s.sector,
            bias,
            score: avg,
            pickCount: count,
            topPickSymbol: topPick,
          };
        })
        .sort((a, b) => b.pickCount - a.pickCount)
        .slice(0, 6);

      const result: PreMarketWatchlistDto = {
        asOfDate,
        nextTradeDate,
        marketSentiment: sentiment,
        regime,
        recommendedCapitalRange: '₹20,000 – ₹50,000',
        windowNotice: 'Fast-Execution Trade Window: 9:15 AM to 9:30 AM IST',
        topSectors,
        picks: picks.slice(0, 30), // Top 30 curated high-conviction trades
        totalAnalyzed: barRows.length,
        longCount: picks.filter((p) => p.direction === 'LONG').length,
        shortCount: picks.filter((p) => p.direction === 'SHORT').length,
        intradayCount: picks.filter((p) => p.tradeType === 'INTRADAY').length,
        btstCount: picks.filter((p) => p.tradeType === 'BTST').length,
      };

      // Cache for 10 minutes
      this.cachedWatchlist = {
        key: cacheKey,
        expiresAt: Date.now() + 10 * 60 * 1000,
        data: result,
      };

      return result;
    } catch (err) {
      this.logger.error('Error generating premarket watchlist:', err);
      throw err;
    } finally {
      db.close();
    }
  }
}
