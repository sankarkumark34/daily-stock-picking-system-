/**
 * Plain-language explanations for every technical term shown in the UI.
 * Keys are stable ids used by <InfoTip term="…" /> and <Term k="…" />.
 */
export interface GlossaryEntry {
  title: string
  text: string
  /** How to read the number when it appears next to the term */
  read?: string
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  /* ---------- scores & picks ---------- */
  score: {
    title: 'Composite score',
    text: 'The stock’s total out of 100 after adding up the ten weighted factors (momentum, trend, relative strength, volume, price structure, sector, market regime, volatility, fundamentals, risk/reward).',
    read: 'Higher is better. The daily model only lists stocks above 72.',
  },
  confidence: {
    title: 'Confidence',
    text: 'How much the system trusts this pick: blends the score, how many factors agree, and how often this setup type has actually worked in the past.',
    read: '0–100 %. Below 50 % means history says the setup is coin-flip or worse.',
  },
  rank: { title: 'Rank', text: 'Position in today’s list, sorted by composite score (ties broken by risk/reward).' },
  setup: {
    title: 'Setup',
    text: 'The price pattern that triggered the idea. Breakout = closed above the last 20 days’ high on big volume. Pullback = uptrend that dipped to the 21-day average and turned up. Trend continuation = all moving averages stacked upward and price near highs. Reversal = oversold stock bouncing off support.',
  },
  entry: { title: 'Entry', text: 'The price the idea is based on — the closing price on the signal day. The system assumes you buy near the next day’s open.', read: 'The entry range is ±0.3–0.5 % around it.' },
  target: { title: 'Target', text: 'Where the trade is meant to be closed with a profit: entry + about 2 × ATR (a typical multi-day move for this stock).', read: 'If price touches this before the stop → SUCCESS.' },
  stopLoss: { title: 'Stop loss', text: 'Where the trade is cut to limit damage: about 1.25 × ATR below entry, or just under the recent low, whichever is tighter.', read: 'If price touches this first → FAILURE.' },
  riskReward: { title: 'Risk / reward (R:R)', text: 'Potential gain to the target divided by potential loss to the stop.', read: '2.0 means you stand to make ₹2 for every ₹1 you risk. Break-even win rate = 1 ÷ (1 + R:R).' },
  holdDays: { title: 'Holding period', text: 'How many trading sessions the idea is given to reach the target. If neither target nor stop is hit by then it is closed at that day’s close (EXPIRED).' },
  outcome: {
    title: 'Outcome',
    text: 'What actually happened after the pick. Target hit = success. Stop hit = failure. Expired = holding period ended without touching either. No fill = the next open gapped more than 2 % above entry so no trade was taken. Open = still running.',
  },
  netReturn: { title: 'Net return', text: 'Profit or loss of the trade after brokerage, STT, exchange charges, GST, stamp duty and 0.05 % slippage each way (≈ 0.39 % round trip).' },
  direction: { title: 'Direction', text: 'The system only generates LONG (buy) ideas. It never shorts.' },

  /* ---------- factors ---------- */
  momentum: {
    title: 'Momentum',
    text: 'Is the stock already moving up? Compares its 5-, 20- and 60-day returns with every other stock (percentile rank), plus RSI zone and MACD histogram.',
    read: '90th percentile = it beat 90 % of stocks over that window.',
  },
  trend: { title: 'Trend', text: 'Are the moving averages lined up bullishly (9 EMA > 21 EMA > 50 EMA > 200 SMA), is price above the 200-day average, is ADX strong, is Supertrend up?' },
  relativeStrength: { title: 'Relative strength', text: 'Is the stock beating NIFTY and its own sector over the last 20 and 60 days? Strong stocks in strong sectors score highest.' },
  volume: { title: 'Volume', text: 'Is real money participating? Today’s volume vs the 20-day average, OBV slope, whether up-days carry more volume than down-days, and delivery % vs its average.' },
  priceStructure: { title: 'Price structure', text: 'Is the chart healthy? Distance from the 20-day and 52-week highs, whether recent lows are higher than earlier lows, where price sits inside the Bollinger Bands, and where it closed within today’s range.' },
  sectorStrength: { title: 'Sector strength', text: 'How the stock’s whole sector is doing versus NIFTY (median 5- and 20-day return, % of members above their 21-EMA, rising 21-EMAs, relative volume). Rank #1 = strongest sector today.' },
  marketRegime: {
    title: 'Market regime',
    text: 'The overall market mood, scored 0–100 from NIFTY’s trend, momentum, market breadth and India VIX. Strong Bullish (≥ 75) → Bullish → Sideways → Bearish → Strong Bearish (< 22).',
    read: 'In bearish regimes long ideas are penalised and the quality bar is raised.',
  },
  volatility: { title: 'Volatility', text: 'Is the stock’s daily movement tradeable? ATR of 1.5–4 % of price scores best; very quiet or very wild stocks score lower. 20-day historical volatility above 60 % is penalised.' },
  fundamentals: { title: 'Fundamentals', text: 'Business quality (ROE, profit growth, debt, promoter holding). No free point-in-time source exists, so this factor is neutral (50/100) until a data provider is connected.' },

  /* ---------- indicators ---------- */
  rsi: { title: 'RSI 14 (Relative Strength Index)', text: 'Speed of recent price changes on a 0–100 scale over 14 days.', read: 'Above 70 = overbought (stretched), below 30 = oversold (washed out), 45–70 = healthy momentum.' },
  stochRsi: { title: 'Stochastic RSI', text: 'Where today’s RSI sits within its own 14-day high–low range, 0–100. Above 80 means momentum is as hot as it has been recently.' },
  ema: { title: 'EMA (Exponential Moving Average)', text: 'Average price over N days that reacts faster to recent prices. Price above a rising EMA = uptrend on that horizon.' },
  sma: { title: 'SMA (Simple Moving Average)', text: 'Plain average of the last N closes. The 200-day SMA is the classic line between long-term uptrend (price above) and downtrend (price below).' },
  sma200: { title: '200-day SMA', text: 'Average close of the last 200 sessions (~10 months). Price above it = long-term uptrend; below = downtrend. Many funds only buy above it.' },
  adx: { title: 'ADX 14 (Average Directional Index)', text: 'Measures how strong a trend is — not its direction.', read: 'Below 15 = choppy, 20–25 = a trend is forming, above 25 = strong trend.' },
  macd: { title: 'MACD histogram', text: 'Difference between the 12- and 26-day EMAs, minus its own 9-day average. Positive and rising = short-term momentum accelerating; negative = fading.' },
  atr: { title: 'ATR 14 (Average True Range)', text: 'The stock’s typical daily movement in rupees over the last 14 days (including overnight gaps). ATR % expresses it as a percentage of price.', read: '2 % ATR means a normal day moves about 2 %. Targets and stops are set in ATR multiples.' },
  supertrend: { title: 'Supertrend', text: 'A trailing line built from ATR. Price above the line = bullish, below = bearish. Flips when price crosses it.' },
  obv: { title: 'OBV slope (On-Balance Volume)', text: 'Adds volume on up-days, subtracts it on down-days. A rising OBV means buyers dominate (accumulation); falling means sellers dominate (distribution).' },
  bollinger: { title: 'Bollinger %B / width', text: '%B says where price is inside the 20-day bands: 0 = at the lower band, 1 = at the upper band, above 1 = above the band (stretched). Width is how wide the bands are as % of price — low width often precedes a big move.' },
  roc: { title: 'ROC (Rate of Change)', text: 'Percentage change in price over N days. ROC 20 = +12 % means the stock is 12 % higher than 20 sessions ago.' },
  cci: { title: 'CCI 20 (Commodity Channel Index)', text: 'How far price is from its 20-day average in units of typical deviation. Above +100 = strong up-move, below −100 = strong down-move.' },
  hv: { title: 'Historical volatility (20d)', text: 'Annualised standard deviation of daily returns over 20 days. 30 % is typical for a large cap; above 60 % is very jumpy.' },
  relVol: { title: 'Relative volume', text: 'Today’s volume divided by the average of the previous 20 sessions.', read: '2.0× = twice the usual volume — confirms a move is being noticed.' },
  delivery: { title: 'Delivery %', text: 'Share of traded quantity that was actually taken as delivery into demat accounts (not squared off intraday). Higher than usual = investors, not just traders, are buying.' },
  turnover: { title: 'Traded value (turnover)', text: 'Price × quantity traded, in rupees. The system requires ≥ ₹1 L today, ≥ ₹10 L over 5 sessions and ≥ ₹1 Cr over 21 sessions so you can enter and exit without moving the price.' },
  higherLows: { title: 'Higher swing lows', text: 'Counts whether each recent 5-day low is above the one before it (0–2). Rising lows = buyers stepping in earlier each dip.' },
  dist52w: { title: 'Distance from 52-week high', text: 'How far below the highest price of the last year the stock trades. Near the high = no trapped sellers overhead; deep below = heavy resistance.' },
  ext21: { title: 'Extension from EMA 21', text: 'How far above its 21-day EMA the price has run. More than 10 % usually snaps back — a poor place to enter.' },

  /* ---------- market ---------- */
  nifty: { title: 'NIFTY 50', text: 'India’s benchmark index of the 50 largest NSE stocks. Used as the yardstick for relative strength and market regime.' },
  vix: { title: 'India VIX', text: 'The market’s expected volatility for the next 30 days, derived from NIFTY option prices — the “fear gauge”.', read: 'Below 13 = calm, 13–18 = normal, above 20 (or 25 % over its 60-day average) = fear; long ideas are penalised.' },
  breadth: { title: 'Market breadth', text: 'How many stocks are participating: advances vs declines today, % of stocks above their 50- and 200-day averages, new 20-day highs vs lows. Narrow breadth = a fragile rally.' },
  adRatio: { title: 'Advance / decline ratio', text: 'Number of stocks up today divided by the number down. 1.5 = broad buying; 0.5 = broad selling.' },
  regimeScore: { title: 'Regime score', text: 'The 0–100 number behind the regime label: trend of NIFTY (50 pts) + momentum (25) + breadth (25), minus a VIX penalty.' },
  longBias: { title: 'Long bias', text: 'Multiplier applied to confidence in this regime: 1.0 in strong bull markets, 0.45 in bearish, 0.25 in strong bearish.' },
  sectorRank: { title: 'Sector rank', text: 'Where the sector stands today among all ~20 sectors by the sector strength score (#1 strongest).' },

  /* ---------- performance / backtest ---------- */
  hitRate: { title: 'Hit rate (target-hit rate)', text: 'Share of closed picks whose target was touched before the stop.', read: 'With R:R ≈ 1.6 the break-even hit rate is about 38 %; “6 of 10” means 60 %.' },
  directionalAccuracy: { title: 'Positive %', text: 'Share of closed picks that ended with any positive net return — including ones that expired slightly up without reaching the target.' },
  expectancy: { title: 'Expectancy', text: 'Average net profit or loss per pick, in %. The single most important number: positive = the rules make money on average after costs.' },
  profitFactor: { title: 'Profit factor', text: 'Total profit from winning picks ÷ total loss from losing picks.', read: 'Above 1.0 = profitable; 1.5+ = healthy; below 1.0 = losing.' },
  avgWin: { title: 'Average win / loss', text: 'Mean net return of winning picks and of losing picks.' },
  maxDrawdown: { title: 'Maximum drawdown', text: 'The worst peak-to-trough fall of the equity curve — how much you would have been down at the worst moment.' },
  sharpe: { title: 'Sharpe ratio', text: 'Return per unit of volatility (annualised). Above 1 is good, above 2 excellent, negative means losing.' },
  sortino: { title: 'Sortino ratio', text: 'Like Sharpe but only penalises downside volatility.' },
  cagr: { title: 'CAGR', text: 'Compound annual growth rate of the model portfolio if every pick were sized at 1/10 of capital.' },
  equity: { title: 'Equity curve', text: 'Value of ₹100 invested in the model over time, each pick sized at 1/N of current capital, net of costs.' },
  walkForward: { title: 'Walk-forward test', text: 'Train on early years, tune on the next year, then test on a year the model never saw. Only the test-year numbers are trustworthy; train numbers are always flattering.' },
  daysWith6of10: { title: 'Days with 6+ of 10', text: 'Selection days where at least 6 of a full 8–10 pick list hit their target — the original goal of the project.' },
  noFill: { title: 'No fill', text: 'The next day opened more than 2 % above the entry, so the system assumes you could not buy at a sensible price and skips the trade.' },
  expired: { title: 'Expired', text: 'Neither target nor stop was touched within the holding period; the trade is closed at that day’s close.' },
  candidates: { title: 'Candidates', text: 'Stocks that passed the liquidity filter and showed one of the four setups on that day, before scoring and ranking.' },
  universe: { title: 'Universe', text: 'All NSE stocks that had enough history and traded value to be considered on that day.' },

  /* ---------- analyst ---------- */
  verdict: { title: 'Verdict', text: 'Buy / Watch / Avoid from the checklist score: ≥ 70 Buy, 50–69 Watch, below 50 Avoid. A failed critical check (200-day trend, liquidity) or a strong-bearish market caps it at Watch. It summarises the evidence — it is not a forecast.' },
  checklistScore: { title: 'Checklist score', text: 'Pass = 1 point, Warn = ½ point, Fail = 0, divided by the number of applicable checks → 0–100.' },
  beta: { title: 'Beta vs NIFTY', text: 'How much the stock moves for a 1 % move in NIFTY, over the last year.', read: '1.3 = moves 30 % more than the index (both ways); 0.7 = defensive.' },
  correlation: { title: 'Correlation', text: 'How closely the stock’s daily moves follow NIFTY (−1 to +1). Near 1 = moves with the market; near 0 = its own story.' },
  annualVol: { title: 'Annualised volatility', text: 'Standard deviation of daily returns scaled to a year. 20 % = calm large cap; 50 %+ = very volatile.' },
  stress: { title: 'Behaviour under stress', text: 'How the stock actually moved on the market’s worst and best days over the last ~3 years. A stock that falls less than NIFTY on shock days is defensive; one that falls more is high-beta / fragile — a data proxy for geopolitical and macro sensitivity.' },
  conditional: { title: 'What history says', text: 'Every past day this stock was in the same situation as today (same setup, similar RSI, breakout…), what happened 5 / 10 / 20 sessions later — the median move and how often it was positive.' },
  winRateFwd: { title: 'Win rate', text: 'Share of those past cases where the forward return was positive.' },
  sentiment: { title: 'News sentiment', text: 'The AI analyst’s read of the recent headlines, −100 (very negative) to +100 (very positive).' },
  aiStance: { title: 'AI stance', text: 'The AI analyst’s own Buy / Watch / Avoid after reading the numbers and the news — it may disagree with the checklist and explains why.' },
  macroExposure: { title: 'Geopolitical & macro exposure', text: 'Which global forces move this stock: crude oil and Middle-East conflict, US interest rates and the dollar, tariffs and sanctions, commodity cycles, technology shifts, elections and budgets.' },
}

export const g = (k: string): GlossaryEntry | undefined => GLOSSARY[k]
