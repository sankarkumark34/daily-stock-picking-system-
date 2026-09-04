# NSE Picks — Daily Quantitative Stock-Selection System

A programmatic, backtested NSE stock-picking system. Every trading day after the close it ingests NSE end-of-day data, classifies the market regime, ranks sectors, detects setups, scores every liquid stock on ten factors and outputs **at most 10** long ideas with entry, target, stop-loss, risk/reward, holding period, confidence and the reasons. Every prediction is stored permanently and resolved against the bars that follow, so the model's real hit rate is always visible — and a walk-forward backtester answers the underlying question honestly: *is there a repeatable edge, and does "6–7 of 10" actually happen?*

Monorepo: **NestJS API** (`apps/api`) + **React dashboard** (`apps/web`) + shared contracts (`packages/shared`).

## Quick start

```bash
npm install
npm run build:shared
npm run cli -- universe                    # map Nifty 500 symbols → sectors
npm run cli -- backfill 2019-01-01 2026-09-01   # ~45 min for 7 years (cached on disk)
npm run cli -- run                         # today's regime, sectors and picks
npm run cli -- backtest 2020-01-01 2026-08-31 --label "Baseline"
npm run dev                                # API on :4000 (docs at /docs), UI on :5180
```

The database defaults to SQLite at `data/nse-picks.sqlite` (zero setup). For PostgreSQL:

```bash
docker compose up -d postgres
DB_TYPE=postgres DATABASE_URL=postgres://nse:nse@localhost:5432/nse npm run dev:api
```

## How the pipeline works

```
NSE archives ─▶ validate ─▶ DB ─▶ indicators ─▶ regime ─▶ sector strength ─▶ setups ─▶ scoring ─▶ top-10 ─▶ store
                                                                      next sessions ─▶ target/stop check ─▶ outcome ─▶ performance
```

| Stage | Where | Notes |
| --- | --- | --- |
| Data provider | `apps/api/src/data/providers` | `MarketDataProvider` interface; `NseArchivesProvider` pulls bhavcopy (UDiFF + legacy), `ind_close_all` index closes (NIFTY, VIX, sector indices) and MTO delivery data. Files are cached under `data/cache`. Swap in a licensed vendor by implementing the interface. |
| Indicators | `apps/api/src/quant/indicators.ts` | EMA/SMA, RSI, MACD, Stoch-RSI, ROC, CCI, ATR, Bollinger, HV, ADX, Supertrend, OBV, rolling highs/lows. Value at index *i* uses bars `0..i` only. |
| Regime | `quant/regime.ts` | NIFTY trend vs EMA21/SMA50/SMA200 + momentum + breadth + India VIX → score 0–100 → Strong Bullish … Strong Bearish, with a long-bias multiplier. |
| Sector strength | `quant/sector.ts` | Bottom-up from constituents (median 5d/20d return vs NIFTY, breadth above EMA21, rising EMA21, relative volume). Works identically in live and backtest. |
| Setups | `quant/setups.ts` | Breakout, Pullback, Trend Continuation, Reversal (long only). |
| Levels | `quant/levels.ts` | Entry = close; stop = tighter of ATR stop and structural low; target = k·ATR; risk 1.5–8 %. |
| Scoring | `quant/scoring.ts` | Ten factors × weights (defaults in `packages/shared`). Raw factor scores are weight-independent so backtests can re-weight cheaply. |
| Selection | `engine/analysis.service.ts` | Min score 72 (calibrated to the observed 70–90 score range so weak days yield fewer picks), max 3 per sector, stricter in Strong Bearish; **never forces 10**. |
| Outcome | `quant/outcome.ts` | Fill at next open (skip if gap > 2 %). Target first → SUCCESS, stop first → FAILURE, same bar → FAILURE (conservative), else EXPIRED at last close. |
| Costs | `quant/costs.ts` | Brokerage, STT both legs, exchange, SEBI, stamp duty, GST, slippage — ~0.4 % round trip by default. |
| Backtest | `backtest/backtest.service.ts` | Point-in-time replay, metrics (win rate, PF, expectancy, DD, Sharpe, Sortino, CAGR, daily hit-rate distribution), by regime / setup / year, anchored yearly walk-forward with optional train-only weight optimisation and a plain-English verdict. |
| Scheduler | `scheduler/scheduler.service.ts` | Cron 18:45 IST weekdays (`DAILY_RUN_CRON`). |

## Stock Analyst (single-stock deep dive)

Menu **Stock Analyst** → search any NSE symbol. For that stock the API (`GET /api/analyst/:symbol`) returns:

- **Checklist** — the 20 rules behind the daily model (trend, momentum, volume/delivery, volatility, structure, sector rank, market regime, liquidity, setup, risk/reward, drawdown) each marked pass / warn / fail with the value and the reason, rolled into a score and a **Buy / Watch / Avoid** verdict (critical failures such as illiquidity cap the verdict).
- **Positives / negatives** — the passed and failed checks as plain sentences.
- **Performance vs NIFTY** over 1w → 3y, **risk profile** (beta, correlation, annualised vol, 1-year max drawdown, distance from 52-week high, turnover).
- **Behaviour under stress** — how the stock moved on NIFTY −1.5 % days, +1.5 % days, India VIX spikes, and during bear vs bull phases (a data-driven proxy for macro / geopolitical sensitivity).
- **What its own history says** — median forward 5/10/20-day returns and win rate after the same setup, a similar RSI, 20-day breakouts, oversold readings, etc.
- **News** — recent company headlines and sector/macro headlines (Google News RSS, no key).
- **AI analyst** (`GET /api/analyst/:symbol/ai`, `POST /api/analyst/:symbol/ask`) — Claude (`claude-opus-5` by default) reads the fact sheet plus headlines and writes: news impact, geopolitical & macro exposure (crude / Middle-East conflict for oil & gas, US rates and the dollar for IT, tariffs, sanctions, tech shifts…), positives, negatives, risks, catalysts, sentiment score and its own stance. A free-text question box ("how would an Iran–US escalation affect this stock?") uses the same context. Requires `ANTHROPIC_API_KEY` (or `ant auth login`); without credentials everything else on the page still works and the AI card says so.

Prices are back-adjusted for splits/bonuses using the adjusted previous close NSE publishes on the ex-date (ordinary dividends are ignored).

## API

Base URL `http://localhost:4000/api` — Swagger at `/docs`.

- `GET /market/overview?date=` · `GET /market/dates`
- `GET /picks?date=&runId=` · `GET /picks/dates` · `GET /picks/recent` · `GET /picks/:id`
- `GET /performance/summary?runId=`
- `GET /stocks/search?q=` · `GET /stocks/:symbol?bars=`
- `GET /analyst/:symbol` · `GET /analyst/:symbol/ai` · `POST /analyst/:symbol/ask {question}`
- `GET /data/status` · `POST /data/ingest` · `POST /data/backfill` · `POST /data/universe/sync`
- `POST /run/daily` · `POST /run/evaluate` · `GET /run/job`
- `GET /backtest/runs` · `POST /backtest/runs` · `GET /backtest/runs/:id` · `DELETE /backtest/runs/:id` · `GET /backtest/defaults`

## Configuration (`.env`)

See `.env.example`. Key knobs: `PORT`, `DB_TYPE`, `DATABASE_URL`, `SQLITE_PATH`, `DAILY_RUN_CRON`, `SCHEDULER_ENABLED`, `MODEL_MIN_SCORE`, `MODEL_MAX_PICKS`, `MODEL_MAX_PER_SECTOR`, `MODEL_MIN_TURNOVER_CR`, `MODEL_MIN_PRICE`.

## Results so far

Full report: [docs/BACKTEST-2026-09-02.md](docs/BACKTEST-2026-09-02.md).

Baseline rule-based model, 2020-01 → 2026-09, ~750 liquid NSE stocks/day, net of costs:

| Picks | Target hit | Stop hit | Expectancy / pick | Profit factor | Avg daily hit rate | Days with 6+ of 10 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 13,952 | 25.3 % | 41.1 % | −0.41 % | 0.85 | 25 % | 42 / 1,442 |

Every year 2020–2026 and every market regime is negative; out-of-sample walk-forward expectancy is −0.43 %. **Verdict: no repeatable edge; the 6–7-of-10 target is not met (the model averages 2–3 of 10).** The system is doing its job — it measures rather than promises. See the report for the diagnosis and the research directions that follow from it.

## Honesty notes (read before trusting a number)

- **Universe is point-in-time** (every EQ symbol in that day's bhavcopy, filtered by liquidity), so stock selection has no survivorship bias. **Sector mapping** uses the current Nifty 500 list, so sector strength is mildly biased for delisted names — flagged in the UI.
- **Fundamentals** score neutral: free NSE archives have no point-in-time fundamentals. Plug a licensed source into `FundamentalsProvider`.
- **F&O / options data** are not yet wired in (interface is ready for it).
- The first ML phase is intentionally absent: the rule-based model must show an out-of-sample edge first.
- Weight optimisation only ever touches the train window and is accepted only if the validation year improves; the test-year column is the only out-of-sample figure.
- If the backtest says the edge is thin or negative, the verdict says so. Do not tune parameters until the verdict is green — that is the failure mode this project exists to avoid.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | API (watch) + web (Vite) |
| `npm run build` | Build shared, API, web |
| `npm test` | Vitest unit tests for the quant layer |
| `npm run cli -- <cmd>` | Builds the API then runs the operator CLI: `universe`, `ingest DATE`, `backfill FROM TO`, `run [DATE]`, `evaluate`, `backtest FROM TO [--no-wf] [--opt] [--label name]` |
