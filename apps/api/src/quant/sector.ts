import type { SectorStrengthDto } from '@nse/shared';
import type { StockSnapshot } from './types.js';

const median = (arr: number[]) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Sector strength is built bottom-up from constituents (equal-weighted), so it
 * works identically in live and backtest mode without sector-index history.
 */
export function computeSectorStrength(
  date: string,
  snaps: StockSnapshot[],
  niftyRet5: number,
  niftyRet20: number,
): SectorStrengthDto[] {
  const groups = new Map<string, StockSnapshot[]>();
  for (const s of snaps) {
    if (s.sector === 'Unclassified') continue;
    const g = groups.get(s.sector);
    if (g) g.push(s);
    else groups.set(s.sector, [s]);
  }
  const out: SectorStrengthDto[] = [];
  for (const [sector, list] of groups) {
    if (list.length < 3) continue;
    const r5 = median(list.map((s) => s.ret5).filter(Number.isFinite));
    const r20 = median(list.map((s) => s.ret20).filter(Number.isFinite));
    const rs20 = r20 - (Number.isFinite(niftyRet20) ? niftyRet20 : 0);
    const rs5 = r5 - (Number.isFinite(niftyRet5) ? niftyRet5 : 0);
    const above21 = (list.filter((s) => s.close > s.ema21).length / list.length) * 100;
    const rising21 = (list.filter((s) => s.ema21Slope5 > 0).length / list.length) * 100;
    const rv = median(list.map((s) => s.relVol).filter(Number.isFinite));

    // 0-100 composite
    let score = 50;
    score += clamp(rs20 * 3, -15, 15); // relative strength vs NIFTY (20d)
    score += clamp(rs5 * 3, -8, 8); // short-term relative strength
    score += (above21 - 50) * 0.25; // breadth above EMA21: ±12.5
    score += (rising21 - 50) * 0.2; // trend breadth: ±10
    score += clamp((rv - 1) * 8, -4, 6); // participation
    score = clamp(score, 0, 100);

    out.push({
      date,
      sector,
      rank: 0,
      score,
      momentum5: r5,
      momentum20: r20,
      relativeStrength20: rs20,
      breadthAboveEma21: above21,
      breadthRisingEma21: rising21,
      relativeVolume: Number.isFinite(rv) ? rv : 1,
      constituents: list.length,
    });
  }
  out.sort((a, b) => b.score - a.score);
  out.forEach((s, i) => (s.rank = i + 1));
  return out;
}
