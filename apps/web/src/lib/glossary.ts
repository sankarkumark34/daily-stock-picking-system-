/**
 * Explanations for every technical term shown in the UI, written for an end user
 * who is not a trader. Each entry has three layers:
 *   simple    – one sentence anyone can understand (analogy allowed)
 *   technical – the exact definition, for readers who want precision
 *   read      – how to interpret the number on screen, with a concrete example
 */
export interface GlossaryEntry {
  title: string
  simple: string
  technical: string
  read?: string
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  /* ---------- scores & picks ---------- */
  score: {
    title: 'Composite score',
    simple: 'A report-card mark out of 100 for the stock today. Ten subjects (momentum, trend, volume…) each give marks; the marks are added up.',
    technical: 'Weighted sum of ten factor scores (each 0–100) using the model weights: Momentum 15, Trend 15, Relative Strength 15, Volume 10, Price Structure 10, Sector 10, Market Regime 10, Volatility 5, Fundamentals 5, Risk/Reward 5.',
    read: 'Higher is better. Below 72 the stock is not listed at all. 72–77 = just made the cut, 78–84 = strong, 85+ = everything lining up. Example: 79.1 means a good all-round setup, not a rare one.',
  },
  confidence: {
    title: 'Confidence',
    simple: 'How sure the system is about this idea — like a weather forecast’s “70 % chance of rain”.',
    technical: '0.45 × score + 0.30 × historical win-rate of this setup type + 0.25 × share of factors scoring ≥ 60, scaled by the market-regime long bias.',
    read: 'Above 60 % = history and today’s numbers agree. 40–60 % = mixed. Below 40 % = the setup type has usually failed before — treat the idea with suspicion. Example: 46 % means roughly a coin flip.',
  },
  rank: {
    title: 'Rank',
    simple: 'Position in today’s list — #1 is the best-scoring idea.',
    technical: 'Ordered by composite score, ties broken by risk/reward. At most 10 per day and at most 2 per sector.',
  },
  setup: {
    title: 'Setup',
    simple: 'The chart “pattern” that made the system notice the stock today — the reason it is on the list.',
    technical:
      'Breakout: close above the prior 20-day high on ≥ 1.5× volume. Pullback: uptrend (EMA21 > EMA50 > SMA200) that dipped to the 21-EMA and closed up. Trend continuation: EMAs stacked 9 > 21 > 50 > 200, ADX ≥ 25, within 5 % of the 20-day high. Reversal: RSI was ≤ 32, price held the 20-day low and closed up on volume.',
    read: 'Breakouts and trend continuations bet the move keeps going; pullbacks buy a dip inside a rising trend; reversals bet a beaten-down stock bounces.',
  },
  entry: {
    title: 'Entry',
    simple: 'The price the plan starts from — roughly what you would pay if you bought at the next morning’s open.',
    technical: 'Closing price on the signal day. Entry range = close × 0.997 to close × 1.005. Fills more than 2 % above the entry are treated as “no fill”.',
    read: 'Example: entry ₹857 with range ₹854–₹861 — buying at ₹880 is not the plan any more.',
  },
  target: {
    title: 'Target',
    simple: 'The price where the plan says “take the profit and get out”.',
    technical: 'Entry + ~2 × ATR(14) (2.0× breakout, 2.2× trend continuation, 1.8× pullback/reversal) — about one normal week’s move for that stock, rounded to the ₹0.05 tick.',
    read: 'If price touches the target before the stop, the pick is counted a SUCCESS. Example: entry ₹857, target ₹926 = +8 %.',
  },
  stopLoss: {
    title: 'Stop loss',
    simple: 'The price where the plan says “this is not working, exit and keep the loss small”.',
    technical: 'Entry − ~1.25 × ATR(14), or just below the recent swing low / 21-EMA, whichever is tighter. Risk is forced between 1.5 % and 8 % of entry.',
    read: 'If price touches the stop first, the pick is a FAILURE. Example: entry ₹857, stop ₹814 = −5 %. Never move it lower once set.',
  },
  riskReward: {
    title: 'Risk / reward (R:R)',
    simple: 'How much you could win compared with how much you could lose. 2:1 means “win ₹2 for every ₹1 risked”.',
    technical: '(Target − Entry) ÷ (Entry − Stop). Break-even win rate = 1 ÷ (1 + R:R).',
    read: 'At 1.6 : 1 you need to be right more than 38 % of the time to make money. Below 1.2 the system drops the idea. Higher is better, but very high R:R usually means a far-away target that is rarely reached.',
  },
  holdDays: {
    title: 'Holding period',
    simple: 'How many trading days the idea is given to work before it is closed no matter what.',
    technical: '5 sessions for breakout / pullback / reversal, 7 for trend continuation, counted from the fill day. If neither target nor stop is touched, the trade is closed at that day’s close and marked EXPIRED.',
    read: 'Example: “5d” on a Monday pick = decision by the following Monday.',
  },
  outcome: {
    title: 'Outcome',
    simple: 'What actually happened to the idea afterwards — the system checks itself every day.',
    technical:
      'Target hit = target touched before stop (SUCCESS). Stop hit = stop touched first (FAILURE; if both on the same day, counted as failure). Expired = holding period over, closed at that day’s close. No fill = next open gapped > 2 % above entry, trade skipped. Open = still within the holding period.',
    read: 'Only SUCCESS / FAILURE / EXPIRED count toward hit rates.',
  },
  netReturn: {
    title: 'Net return',
    simple: 'What the trade actually made or lost after all charges — the number that matters for your wallet.',
    technical: 'Exit ÷ fill − 1, after brokerage 0.03 %, STT 0.1 % each side, exchange + SEBI fees, stamp duty, GST on charges and 0.05 % slippage each side (≈ 0.39 % round trip).',
    read: 'Example: +3.0 % gross becomes about +2.6 % net.',
  },
  direction: {
    title: 'Direction',
    simple: 'Whether the idea is to buy (go long) or sell short. This system only ever says “buy”.',
    technical: 'All signals are LONG. No short-selling logic is implemented.',
  },

  /* ---------- factors ---------- */
  momentum: {
    title: 'Momentum',
    simple: 'Is the stock already running? Like a cricket batter in form — recent performance tends to continue for a while.',
    technical: 'Percentile rank of 5-, 20- and 60-day returns across the whole universe (weights 0.25 / 0.45 / 0.30), +6 if RSI is 55–72, −10 if RSI > 80, +4 if MACD histogram > 0, −5 if Stoch-RSI > 80 with a > 6 % five-day jump.',
    read: '“20d return 13.7 % (90th pct)” = it beat 90 % of all stocks over the last 20 days. Above 70 = strong momentum; below 40 = lagging.',
  },
  trend: {
    title: 'Trend',
    simple: 'Is the stock in a clear uptrend, like a staircase going up, rather than zig-zagging sideways?',
    technical: 'Points for price > EMA9, EMA9 > EMA21, EMA21 > EMA50, EMA50 > SMA200, price > SMA200, Supertrend bullish, plus up to 25 points for ADX between 15 and 40.',
    read: '“3/3 EMA alignments bullish” = all moving averages stacked in the right order. 100 = textbook uptrend; below 40 = downtrend or messy.',
  },
  relativeStrength: {
    title: 'Relative strength',
    simple: 'Is this stock doing better than the market and its own sector? A strong swimmer in a strong current goes fastest.',
    technical: 'Percentile of (stock 20d return − NIFTY 20d return) × 0.6 + percentile of the 60-day equivalent × 0.4, ± up to 10 for return vs the sector median.',
    read: '“Outperforming NIFTY by 15.9 % over 20d” = if NIFTY was flat the stock rose ~16 %. Above 70 = leader; below 40 = laggard.',
  },
  volume: {
    title: 'Volume',
    simple: 'Is real money behind the move? A price rise on heavy trading is believable; on thin trading it is easy to fake.',
    technical: '30 + relative volume bonus (up to +30 at 2.2×), OBV 10-day slope (±15), up-day vs down-day volume ratio (±15), delivery % vs its 20-day average (±10).',
    read: '“Volume 1.0× avg” = an ordinary day. 2× or more with a rising price = conviction. Below 40 means the move is not confirmed by participation.',
  },
  priceStructure: {
    title: 'Price structure',
    simple: 'Does the chart look healthy — near its highs with dips that keep getting shallower — or is it a broken chart far below old peaks?',
    technical: 'Distance to the 20-day high (25 pts), to the 52-week high (20), higher swing lows (10 each), Bollinger %B between 0.5 and 1.05 (10), close in the top 30 % of the day’s range (5).',
    read: '“1.6 % below 52-week high, 2 higher swing lows” = near the top with rising floors: ideal. Below 40 = lots of overhead sellers waiting to break even.',
  },
  sectorStrength: {
    title: 'Sector strength',
    simple: 'Is the whole industry group (IT, banks, pharma…) in favour right now? Stocks rarely rise alone; the sector tide matters.',
    technical: 'Sector score 0–100 from the median 20-day and 5-day return vs NIFTY, % of members above their 21-EMA, % with a rising 21-EMA, and median relative volume. Ranked across ~20 sectors.',
    read: '“Information Technology ranked #3 (score 58)” = third-strongest sector today. Rank 1–5 is supportive; rank 15+ is a headwind.',
  },
  marketRegime: {
    title: 'Market regime',
    simple: 'The overall weather of the market — sunny (bullish), cloudy (sideways) or stormy (bearish). Even good stocks struggle in a storm.',
    technical: 'Score 0–100: NIFTY trend vs EMA21/SMA50/SMA200 (50 pts) + momentum (25) + breadth (25) − VIX penalty. ≥ 75 Strong Bullish, ≥ 58 Bullish, ≥ 40 Sideways, ≥ 22 Bearish, else Strong Bearish.',
    read: '“Bearish regime (score 24)” = the market itself is weak, so long ideas get a lower factor score and need a higher composite score to be listed. Buy less, or wait.',
  },
  volatility: {
    title: 'Volatility',
    simple: 'How wildly the stock swings each day. Too calm and nothing happens in a week; too wild and the stop gets hit by noise.',
    technical: 'ATR(14) as % of price: 1.5–4 % scores 90, 1–1.5 % → 60, 4–6 % → 60, < 1 % → 35, > 6 % → 25; −15 if 20-day historical volatility > 60 %.',
    read: '“ATR 2.5 % of price” = a normal day moves about 2.5 %, which is the sweet spot for a 5-day trade.',
  },
  fundamentals: {
    title: 'Fundamentals',
    simple: 'How good the underlying business is — profits, debt, who owns it. Right now the system has no reliable free source for this.',
    technical: 'Would score ROE, profit growth, debt/equity and promoter holding. Without a point-in-time provider the factor is fixed at a neutral 50/100.',
    read: 'Always 50 for now — it neither helps nor hurts any stock. Check fundamentals yourself before buying.',
  },

  /* ---------- indicators ---------- */
  rsi: {
    title: 'RSI 14 (Relative Strength Index)',
    simple: 'A speedometer for price: how fast and how one-sided the last two weeks of moves have been, on a 0–100 dial.',
    technical: 'Average gain ÷ average loss over 14 days (Wilder smoothing), converted to 0–100: RSI = 100 − 100 ÷ (1 + avg gain / avg loss).',
    read: 'Above 70 = overbought (stretched; pullback risk). Below 30 = oversold (washed out; bounce possible). 45–70 = healthy, sustainable momentum. Example: RSI 73 = strong but a bit hot.',
  },
  stochRsi: {
    title: 'Stochastic RSI',
    simple: 'Where today’s RSI sits between its own recent low and high — is momentum at its hottest or coolest of the last two weeks?',
    technical: '(RSI − 14-day min RSI) ÷ (14-day max − min) × 100, smoothed over 3 days.',
    read: 'Above 80 = momentum as hot as it has been lately; below 20 = as cold. Used to spot short-term exhaustion.',
  },
  ema: {
    title: 'EMA (Exponential Moving Average)',
    simple: 'A smoothed price line that follows the stock, giving more weight to recent days — like a running average of your last N scores that cares more about this week.',
    technical: 'EMAₜ = price × k + EMAₜ₋₁ × (1 − k), with k = 2 ÷ (N + 1). Used for 9, 21 and 50 days.',
    read: 'Price above a rising EMA = uptrend on that horizon. EMA9 > EMA21 > EMA50 = short, medium and long views all agree.',
  },
  sma: {
    title: 'SMA (Simple Moving Average)',
    simple: 'The plain average price of the last N days — the smoothest, slowest trend line.',
    technical: 'Arithmetic mean of the last N closing prices (20, 50, 200 days).',
    read: 'Price above SMA = trend up on that horizon; below = down.',
  },
  sma200: {
    title: '200-day SMA',
    simple: 'The average price of the last ~10 months — the classic line between a stock that is “in a bull phase” and one that is “in a bear phase”.',
    technical: 'Arithmetic mean of the last 200 daily closes.',
    read: 'Price above it = long-term uptrend; below = downtrend. Many funds only buy above it, which is why it is a critical check here. Example: “−6.2 %” = price is 6 % under the line, so the long-term trend is down.',
  },
  adx: {
    title: 'ADX 14 (Average Directional Index)',
    simple: 'Measures how strong a trend is — not which way it points. A high ADX with rising prices = a powerful uptrend.',
    technical: 'Smoothed |+DI − −DI| ÷ (+DI + −DI) × 100 over 14 days, where DI are directional movement indicators.',
    read: 'Below 15 = choppy, no trend. 20–25 = a trend is forming. Above 25 = strong, established trend. Example: ADX 42 = very strong trend.',
  },
  macd: {
    title: 'MACD histogram',
    simple: 'Is short-term momentum speeding up or slowing down? Positive and growing = accelerating.',
    technical: 'MACD line = EMA12 − EMA26; signal = EMA9 of the MACD line; histogram = MACD − signal.',
    read: 'Above 0 = momentum ahead of its own average (bullish). Below 0 = fading. A cross from negative to positive is often an early buy signal.',
  },
  atr: {
    title: 'ATR 14 (Average True Range)',
    simple: 'How much the stock typically moves in a day, in rupees — its “normal step size”. Targets and stops are set in multiples of it.',
    technical: 'Wilder average over 14 days of true range = max(high − low, |high − previous close|, |low − previous close|). ATR % = ATR ÷ price.',
    read: 'Example: ATR 2.5 % = a normal day moves ~2.5 %. A 2 × ATR target is about a week’s worth of movement.',
  },
  supertrend: {
    title: 'Supertrend',
    simple: 'A trailing line under (or over) the price that flips colour when the trend changes — like a ratchet that follows the stock.',
    technical: 'Bands at mid-price ± 3 × ATR(10); the line trails price and direction flips when price closes through it.',
    read: 'Bullish = price above the line. Bearish = below.',
  },
  obv: {
    title: 'OBV slope (On-Balance Volume)',
    simple: 'Are more shares changing hands on up-days than on down-days? If yes, buyers are quietly accumulating.',
    technical: 'OBV adds the day’s volume on up-closes and subtracts it on down-closes. Slope = (OBV − OBV 10 days ago) ÷ (average volume × 10).',
    read: 'Positive = accumulation (bullish). Negative = distribution (sellers dominate). Example: −0.26 means down-days carried more volume recently.',
  },
  bollinger: {
    title: 'Bollinger %B / width',
    simple: 'A “normal range” drawn around the 20-day average. %B says where price is inside that range; width says how wide the range is.',
    technical: 'Bands = SMA20 ± 2 standard deviations. %B = (price − lower) ÷ (upper − lower). Width = (upper − lower) ÷ SMA20.',
    read: '%B 0 = at the bottom of the range, 1 = at the top, > 1 = outside the top (stretched). Very narrow width often comes just before a big move.',
  },
  roc: {
    title: 'ROC (Rate of Change)',
    simple: 'Plain percentage change over N days — “how much is it up compared with N trading days ago?”',
    technical: '(price today ÷ price N days ago − 1) × 100.',
    read: 'ROC 20 = +12 % means 12 % higher than 20 sessions ago.',
  },
  cci: {
    title: 'CCI 20 (Commodity Channel Index)',
    simple: 'How far price has strayed from its usual level over 20 days, in “typical deviation” units.',
    technical: '(typical price − 20-day SMA of typical price) ÷ (0.015 × mean deviation), typical price = (high + low + close) ÷ 3.',
    read: 'Above +100 = unusually strong up-move; below −100 = unusually strong down-move. Between = normal.',
  },
  hv: {
    title: 'Historical volatility (20d)',
    simple: 'How jumpy the stock has been over the last month, expressed as a yearly percentage.',
    technical: 'Standard deviation of daily log returns over 20 days × √252 × 100.',
    read: '20–30 % = calm large cap. 40–60 % = lively mid/small cap. Above 60 % = very jumpy; stops get hit by noise.',
  },
  relVol: {
    title: 'Relative volume',
    simple: 'Today’s trading activity compared with a normal day for this stock.',
    technical: 'Today’s volume ÷ average volume of the previous 20 sessions.',
    read: '1.0× = normal. 2.0× = twice the usual — the move is being noticed. Below 0.8× = quiet, low conviction.',
  },
  delivery: {
    title: 'Delivery %',
    simple: 'Of all shares traded today, how many were actually kept overnight (taken into demat) instead of flipped within the day. Kept shares = real investors.',
    technical: 'Deliverable quantity ÷ traded quantity × 100, from NSE’s daily MTO file.',
    read: 'Higher than its own average = investors buying, not just traders. Example: 59 % vs a 59 % average = nothing unusual.',
  },
  turnover: {
    title: 'Traded value (turnover)',
    simple: 'How many rupees changed hands in the stock — price × shares traded. Enough turnover means you can buy and sell without pushing the price yourself.',
    technical: 'Daily traded value from the bhavcopy. The model requires ≥ ₹1 L today, ≥ ₹10 L over the last 5 sessions and ≥ ₹1 Cr over the last 21 sessions.',
    read: 'Example: ₹1,640 Cr / day for Reliance = extremely liquid. ₹20 L / day = tiny; expect slippage.',
  },
  higherLows: {
    title: 'Higher swing lows',
    simple: 'Each dip stops higher than the previous one — buyers are stepping in earlier every time. A staircase pattern.',
    technical: 'Counts (0–2) whether the lowest low of the last 5 bars is above the previous 5-bar low, and that one above the 5-bar low before it.',
    read: '2/2 = clean rising floors. 0/2 = no support structure yet.',
  },
  dist52w: {
    title: 'Distance from 52-week high',
    simple: 'How far below its best price of the past year the stock sits. Near the high = nobody is stuck waiting to sell at break-even.',
    technical: '(price ÷ highest high of the last 252 sessions − 1) × 100.',
    read: 'Within −5 % = strength. −5 % to −15 % = OK. Deeper = heavy overhead resistance. Example: −18.8 % = a lot of trapped sellers above.',
  },
  ext21: {
    title: 'Extension from EMA 21',
    simple: 'How far the price has sprinted ahead of its own 3-week average. Sprint too far and it usually catches its breath (pulls back).',
    technical: '(price ÷ EMA21 − 1) × 100.',
    read: 'Under 10 % = fine. 10–15 % = stretched. Above 15 % = chasing; wait for a dip.',
  },

  /* ---------- market ---------- */
  nifty: {
    title: 'NIFTY 50',
    simple: 'India’s main stock market index — 50 of the biggest companies. “The market” usually means this number.',
    technical: 'Free-float market-cap weighted index of 50 large NSE stocks. Used here as the benchmark for relative strength and for the market regime.',
    read: 'A stock “outperforming NIFTY by 5 %” rose 5 % more than the market did.',
  },
  vix: {
    title: 'India VIX',
    simple: 'The market’s “fear meter”. When traders expect big swings (war news, elections, crashes) it jumps.',
    technical: 'Expected 30-day annualised volatility of NIFTY implied by option prices.',
    read: 'Below 13 = calm. 13–18 = normal. Above 20 (or 25 % above its 60-day average) = fear; the model penalises long ideas. Example: 11.5 = very calm.',
  },
  breadth: {
    title: 'Market breadth',
    simple: 'How many stocks are actually joining the party. If the index rises but most stocks fall, the rally is fragile.',
    technical: 'Advances vs declines today, % of the universe above the 50- and 200-day SMA and the 21-EMA, count of new 20-day highs and lows.',
    read: '“405 / 693” = 405 stocks up, 693 down today — broad selling even if the index looks fine.',
  },
  adRatio: {
    title: 'Advance / decline ratio',
    simple: 'Stocks that rose today divided by stocks that fell.',
    technical: 'Advances ÷ declines across the liquid universe.',
    read: 'Above 1.5 = broad buying. Around 1 = balanced. Below 0.67 = broad selling.',
  },
  regimeScore: {
    title: 'Regime score',
    simple: 'The 0–100 number behind the market weather label.',
    technical: 'NIFTY trend vs moving averages (50 pts) + 5/20-day momentum (25) + breadth (25) − VIX penalty (12 when elevated).',
    read: '75+ Strong Bullish, 58+ Bullish, 40+ Sideways, 22+ Bearish, below 22 Strong Bearish.',
  },
  longBias: {
    title: 'Long bias',
    simple: 'How much the system “leans in” to buying in the current market weather.',
    technical: 'Multiplier applied to confidence: 1.0 strong bullish, 0.9 bullish, 0.7 sideways, 0.45 bearish, 0.25 strong bearish.',
    read: '×0.45 = confidence is cut by more than half because the market is bearish.',
  },
  sectorRank: {
    title: 'Sector rank',
    simple: 'Where the stock’s industry group stands today among all sectors — #1 is the hottest.',
    technical: 'Rank by sector strength score across the ~20 Nifty 500 industries with ≥ 3 members.',
    read: '#1–5 supportive, #6–10 neutral, #11+ a headwind.',
  },

  /* ---------- performance / backtest ---------- */
  hitRate: {
    title: 'Hit rate (target-hit rate)',
    simple: 'Out of all finished picks, how many reached their target before hitting the stop. The “how often was it right” number.',
    technical: 'SUCCESS ÷ (SUCCESS + FAILURE + EXPIRED) × 100, over closed picks only.',
    read: 'With a 1.6 : 1 reward/risk you break even at ~38 %. The project goal of “6–7 of 10” = 60–70 %. Example: 25 % = right one time in four — losing after costs.',
  },
  directionalAccuracy: {
    title: 'Positive %',
    simple: 'How many finished picks ended up with any profit at all, even a tiny one.',
    technical: 'Share of closed picks with net return > 0 (includes expired trades that drifted up).',
    read: 'Always higher than the hit rate. A big gap between the two means many trades went the right way but not far enough to reach the target.',
  },
  expectancy: {
    title: 'Expectancy',
    simple: 'The average profit or loss per pick after charges. If you took every pick, this is what one trade earned you on average. The single most important number.',
    technical: 'Mean net return % over closed picks.',
    read: 'Positive = the rules make money on average. Example: −0.41 % = every pick lost about ₹410 per ₹1 lakh on average.',
  },
  profitFactor: {
    title: 'Profit factor',
    simple: 'Total money won divided by total money lost. Above 1 you win more than you lose.',
    technical: 'Sum of positive net returns ÷ absolute sum of negative net returns.',
    read: 'Below 1.0 = losing system. 1.0–1.2 = thin. 1.5+ = healthy. 2+ = excellent. Example: 0.85 = for every ₹100 lost only ₹85 was won.',
  },
  avgWin: {
    title: 'Average win / loss',
    simple: 'Typical size of a winning trade and of a losing trade.',
    technical: 'Mean net return of picks with return > 0, and of picks with return ≤ 0.',
    read: 'A system can have a low hit rate and still profit if the average win is much bigger than the average loss.',
  },
  maxDrawdown: {
    title: 'Maximum drawdown',
    simple: 'The deepest hole the account fell into from its previous peak — the worst “ouch” moment you would have lived through.',
    technical: 'Minimum of (equity ÷ running peak equity − 1) over the period.',
    read: '−20 % means at the worst point you were down a fifth from the high. Anything beyond −30 % is hard to sit through emotionally.',
  },
  sharpe: {
    title: 'Sharpe ratio',
    simple: 'Return per unit of bumpiness. Two systems with the same return — the one with a smoother ride has the higher Sharpe.',
    technical: 'Mean daily portfolio return ÷ standard deviation of daily returns × √252.',
    read: 'Above 1 good, above 2 excellent, negative = losing money.',
  },
  sortino: {
    title: 'Sortino ratio',
    simple: 'Like Sharpe, but only counts the downward bumps as “bad”.',
    technical: 'Mean daily return ÷ downside deviation × √252.',
    read: 'Higher is better; compare with Sharpe — a much higher Sortino means most volatility was on the upside.',
  },
  cagr: {
    title: 'CAGR',
    simple: 'The steady yearly growth rate that would have produced the same end result — “what % per year did this compound at?”',
    technical: '(final equity ÷ 100)^(1 ÷ years) − 1, with every pick sized at 1/10 of current capital, net of costs.',
    read: 'Compare with a fixed deposit (~7 %) or NIFTY itself (~12–14 % long-run). Negative = capital shrank.',
  },
  equity: {
    title: 'Equity curve',
    simple: 'What ₹100 invested in the system would have become over time, drawn as a line. You want it climbing steadily, not jagged.',
    technical: 'Start 100; each pick sized at 1/N of current capital; daily return = Σ net returns of trades closed that day ÷ N; compounding.',
    read: 'The gap between the line and its previous peak is the drawdown.',
  },
  walkForward: {
    title: 'Walk-forward test',
    simple: 'The honest exam: learn from the past, then test on a year the system has never seen — so the result is not just a story fitted to old data.',
    technical: 'Anchored yearly splits: train on all years before the validation year, validate on the next year, test on the year after. Weight changes are accepted only if validation improves; only test-year metrics are out-of-sample.',
    read: 'Trust the Test column. Train numbers are always flattering.',
  },
  daysWith6of10: {
    title: 'Days with 6+ of 10',
    simple: 'The original goal: how many days did at least 6 of the day’s (8–10) picks hit their target?',
    technical: 'Count of selection days with ≥ 8 picks where ≥ 6 were SUCCESS.',
    read: 'Divide by total selection days to see how often the goal was met. Example: 42 of 1,442 = about 3 % of days.',
  },
  noFill: {
    title: 'No fill',
    simple: 'The stock opened too far above the planned entry the next morning, so the system assumes you did not chase it.',
    technical: 'Next-day open > entry × 1.02 → trade skipped, not counted in hit rates.',
  },
  expired: {
    title: 'Expired',
    simple: 'Time ran out: the stock touched neither the target nor the stop within the holding period, so it was closed at the last day’s price.',
    technical: 'Closed at the close of the final holding day; return can be positive or negative.',
    read: 'Many small positive expiries with few target hits usually means the targets are set too far.',
  },
  candidates: {
    title: 'Candidates',
    simple: 'Stocks that passed the liquidity check and showed one of the four patterns that day — the shortlist before scoring.',
    technical: 'Universe members with a detected setup and valid trade levels, before ranking and the 10-per-day cap.',
    read: '“133 / day” = the model had 133 possible ideas and kept the 10 best-scoring.',
  },
  universe: {
    title: 'Universe',
    simple: 'All the stocks the system even looked at that day.',
    technical: 'NSE EQ symbols with ≥ 220 bars of history, price ≥ ₹30 and the traded-value floors met (today ≥ ₹1 L, 5 sessions ≥ ₹10 L, 21 sessions ≥ ₹1 Cr).',
  },

  /* ---------- analyst ---------- */
  verdict: {
    title: 'Verdict',
    simple: 'A one-word summary of the checklist: Buy, Watch or Avoid. It sums up the evidence — it does not predict the future.',
    technical: 'Checklist score ≥ 70 → Buy, 50–69 → Watch, < 50 → Avoid. Capped at Watch if a critical check (200-day trend, liquidity) fails or the market is Strong Bearish.',
    read: 'Buy = most boxes ticked. Watch = mixed; wait for a trigger. Avoid = the odds are against a long trade now.',
  },
  checklistScore: {
    title: 'Checklist score',
    simple: 'Percentage of the 20 checks the stock passes, with half credit for “warn”.',
    technical: '(passes + 0.5 × warns) ÷ applicable checks × 100.',
    read: '53/100 = roughly half the boxes ticked — a mixed picture.',
  },
  beta: {
    title: 'Beta vs NIFTY',
    simple: 'How much the stock moves when the market moves. Beta 1.3 = it swings 30 % more than NIFTY, both up and down.',
    technical: 'Slope of daily stock returns regressed on daily NIFTY returns over the last year.',
    read: 'Above 1.2 = aggressive; 0.8–1.2 = market-like; below 0.8 = defensive. Example: 0.9 = slightly calmer than the market.',
  },
  correlation: {
    title: 'Correlation',
    simple: 'How closely the stock’s daily ups and downs follow the market’s, from −1 to +1.',
    technical: 'Pearson correlation of daily returns with NIFTY over the last year.',
    read: 'Near 1 = moves with the market. Near 0 = its own story (results, sector news). Negative is rare.',
  },
  annualVol: {
    title: 'Annualised volatility',
    simple: 'How bumpy the ride has been over the past year, as a yearly %.',
    technical: 'Standard deviation of daily returns × √252 × 100.',
    read: '~20 % = calm large cap; 40 %+ = volatile; 60 %+ = very risky.',
  },
  stress: {
    title: 'Behaviour under stress',
    simple: 'What this stock actually did on the market’s scariest and happiest days over the last ~3 years — its real-world reaction to shocks like war news or crashes.',
    technical: 'Average stock return on days NIFTY fell ≥ 1.5 %, rose ≥ 1.5 %, India VIX jumped ≥ 10 %, and during NIFTY < / > its 200-day SMA; plus the average next-day return.',
    read: 'Falls less than NIFTY on shock days = defensive. Falls more = fragile / high-beta. “Stock up %” = how often it still closed green on those days.',
  },
  conditional: {
    title: 'What history says',
    simple: 'Every time in the past this stock was in the same situation as today, what happened next? Like checking a batter’s record on similar pitches.',
    technical: 'For each past day matching the condition (same setup, RSI within ±5, 20-day breakout, RSI < 30, above 200-SMA), the forward 5 / 10 / 20-session return; reported as median and % positive, signals clustered within 3 days de-duplicated.',
    read: '“+1.2 % · 58 %↑” = the middle outcome was +1.2 % and 58 % of cases were positive. Fewer than ~30 cases is thin evidence.',
  },
  winRateFwd: {
    title: 'Win rate',
    simple: 'How often the outcome was positive in those past cases.',
    technical: 'Share of forward returns > 0.',
  },
  sentiment: {
    title: 'News sentiment',
    simple: 'The AI’s read of whether recent headlines are good, bad or neutral for the stock, on a −100 to +100 scale.',
    technical: 'Model-assessed from the fetched company and sector headlines; not a market-price measure.',
    read: 'Above +30 clearly positive; below −30 clearly negative; in between = mixed / quiet news flow.',
  },
  aiStance: {
    title: 'AI stance',
    simple: 'The AI analyst’s own Buy / Watch / Avoid after reading both the numbers and the news. It may disagree with the checklist and says why.',
    technical: 'Generated by Claude from the quantitative fact sheet plus headlines; not a back-tested signal.',
  },
  macroExposure: {
    title: 'Geopolitical & macro exposure',
    simple: 'Which big-world forces move this stock — oil prices and Middle-East conflict, US interest rates and the dollar, tariffs, sanctions, new technology, elections and budgets.',
    technical: 'AI narrative tying each force to the direction of impact and to evidence in the headlines or the stress statistics.',
    read: 'Use it to ask “what could go wrong that has nothing to do with the chart?”',
  },
}

export const g = (k: string): GlossaryEntry | undefined => GLOSSARY[k]
