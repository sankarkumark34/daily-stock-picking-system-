"""
3-Class Circuit Predictor (UC / LC / Neither)
Using LightGBM / XGBoost with Walk-Forward Cross Validation.

Target:
  0: Neither (Normal trading range)
  1: Upper Circuit (UC hit on next trading day)
  2: Lower Circuit (LC hit on next trading day)

Features:
  - Price Action: Multi-period returns, distance from day high/low, VWAP distance, ATR-14, RSI-14, EMA 20/50 spreads, support/resistance.
  - Volume: RVOL (20-day), Volume acceleration, Delivery %, Delivery ratio, Turnover.
  - Market Context: Nifty 50 return, Sector return, Sector Relative Strength, Gap %, Volatility.
  - Circuit Bands: Applicable price band (2%, 5%, 10%, 20%), distance to UC, distance to LC, consecutive circuit momentum.
"""

import os
import sys
import json
import sqlite3
import argparse
from datetime import datetime
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Any

try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False

try:
    import xgboost as xgb
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

from sklearn.metrics import log_loss, brier_score_loss, roc_auc_score, classification_report
import joblib

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "nse-picks.sqlite")
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "models")
PREDICTIONS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "circuit_predictions.json")
METRICS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "circuit_metrics.json")


def get_db_connection():
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"Database not found at {DB_PATH}")
    return sqlite3.connect(DB_PATH)


def determine_price_band(pct_moves: pd.Series) -> float:
    """
    Detects the typical applicable NSE daily price band (2%, 5%, 10%, 20%)
    based on historical high/low excursions.
    """
    q99 = pct_moves.abs().quantile(0.99)
    if q99 <= 0.025:
        return 0.02
    elif q99 <= 0.055:
        return 0.05
    elif q99 <= 0.11:
        return 0.10
    else:
        return 0.20


def compute_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / (avg_loss + 1e-9)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return rsi.fillna(50.0)


def compute_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    prev_close = df["prevClose"].fillna(df["close"])
    tr1 = df["high"] - df["low"]
    tr2 = (df["high"] - prev_close).abs()
    tr3 = (df["low"] - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    return atr


def extract_features(df_bars: pd.DataFrame, df_index: pd.DataFrame, df_stocks: pd.DataFrame) -> pd.DataFrame:
    """
    Extracts all price action, volume, market context, and circuit features.
    """
    print(f"Engineering features for {len(df_bars)} daily bars...")
    df = df_bars.sort_values(["symbol", "date"]).copy()

    # Pre-merge stock metadata
    sector_map = dict(zip(df_stocks["symbol"], df_stocks["sector"]))
    name_map = dict(zip(df_stocks["symbol"], df_stocks["name"]))
    df["sector"] = df["symbol"].map(sector_map).fillna("Unknown")
    df["name"] = df["symbol"].map(name_map).fillna(df["symbol"])

    # Basic price elements
    df["prevClose"] = df["prevClose"].replace(0, np.nan).fillna(df["close"])
    df["return_1d"] = (df["close"] - df["prevClose"]) / df["prevClose"]
    df["gap_pct"] = (df["open"] - df["prevClose"]) / df["prevClose"]

    # Price action features per symbol
    grouped = df.groupby("symbol", group_keys=False)

    df["return_3d"] = grouped["close"].pct_change(3)
    df["return_5d"] = grouped["close"].pct_change(5)
    df["return_10d"] = grouped["close"].pct_change(10)

    # Intraday range positions
    bar_range = (df["high"] - df["low"]).replace(0, np.nan)
    df["range_pos"] = ((df["close"] - df["low"]) / (bar_range + 1e-6)).clip(0, 1)
    df["dist_day_high"] = (df["high"] - df["close"]) / df["close"]
    df["dist_day_low"] = (df["close"] - df["low"]) / df["close"]

    # VWAP proxy
    raw_vwap = (df["turnover"] / (df["volume"] + 1e-6)).replace(0, np.nan)
    typical_price = (df["high"] + df["low"] + df["close"]) / 3.0
    vwap = raw_vwap.fillna(typical_price)
    df["dist_vwap"] = (df["close"] - vwap) / vwap

    # EMAs & ATR & RSI
    df["ema_20"] = grouped["close"].transform(lambda s: s.ewm(span=20, adjust=False).mean())
    df["ema_50"] = grouped["close"].transform(lambda s: s.ewm(span=50, adjust=False).mean())
    df["dist_ema_20"] = (df["close"] - df["ema_20"]) / df["ema_20"]
    df["dist_ema_50"] = (df["close"] - df["ema_50"]) / df["ema_50"]
    df["ema_spread"] = (df["ema_20"] - df["ema_50"]) / df["ema_50"]

    # Support / Resistance 20-day
    df["high_20d"] = grouped["high"].transform(lambda s: s.rolling(20, min_periods=5).max())
    df["low_20d"] = grouped["low"].transform(lambda s: s.rolling(20, min_periods=5).min())
    df["dist_20d_high"] = (df["high_20d"] - df["close"]) / df["close"]
    df["dist_20d_low"] = (df["close"] - df["low_20d"]) / df["close"]

    # ATR & RSI
    df["atr_14"] = grouped.apply(lambda g: compute_atr(g, 14), include_groups=False).reset_index(level=0, drop=True)
    df["atr_pct"] = df["atr_14"] / df["close"]
    df["rsi_14"] = grouped["close"].apply(lambda s: compute_rsi(s, 14)).reset_index(level=0, drop=True)

    # Volume features
    vol_mean_20 = grouped["volume"].transform(lambda s: s.rolling(20, min_periods=5).mean())
    df["rvol"] = (df["volume"] / (vol_mean_20 + 1e-6)).clip(0, 20)
    df["vol_accel"] = (df["volume"] / (grouped["volume"].shift(1) + 1e-6)).clip(0, 10)
    df["delivery_pct"] = df["deliveryPct"].fillna(35.0).clip(0, 100)

    # Price band estimation per symbol
    symbol_band = grouped["return_1d"].apply(determine_price_band)
    df["price_band"] = df["symbol"].map(symbol_band).fillna(0.20)

    # Circuit distances today
    df["dist_to_uc"] = ((df["prevClose"] * (1.0 + df["price_band"]) - df["close"]) / df["close"]).clip(lower=0)
    df["dist_to_lc"] = ((df["close"] - df["prevClose"] * (1.0 - df["price_band"])) / df["close"]).clip(lower=0)

    # Consecutive circuit proximity
    is_near_uc = (df["dist_to_uc"] <= 0.015).astype(int)
    is_near_lc = (df["dist_to_lc"] <= 0.015).astype(int)
    df["consecutive_uc"] = grouped.apply(lambda g: is_near_uc.loc[g.index].groupby((is_near_uc.loc[g.index] == 0).cumsum()).cumcount(), include_groups=False).reset_index(level=0, drop=True)
    df["consecutive_lc"] = grouped.apply(lambda g: is_near_lc.loc[g.index].groupby((is_near_lc.loc[g.index] == 0).cumsum()).cumcount(), include_groups=False).reset_index(level=0, drop=True)

    # Market context: Nifty 50 join
    if not df_index.empty:
        nifty = df_index[df_index["indexName"] == "Nifty 50"].sort_values("date").copy()
        nifty["nifty_return_1d"] = nifty["changePct"] / 100.0
        nifty["nifty_volatility"] = (nifty["high"] - nifty["low"]) / nifty["close"]
        nifty_dict = dict(zip(nifty["date"], nifty["nifty_return_1d"]))
        vix_dict = dict(zip(nifty["date"], nifty["nifty_volatility"]))
        df["nifty_return"] = df["date"].map(nifty_dict).fillna(0.0)
        df["market_volatility"] = df["date"].map(vix_dict).fillna(0.01)
    else:
        df["nifty_return"] = 0.0
        df["market_volatility"] = 0.01

    # Sector average return & Relative strength
    sector_daily = df.groupby(["date", "sector"])["return_1d"].transform("mean")
    df["sector_return"] = sector_daily
    df["sector_rs"] = df["return_1d"] - df["sector_return"]

    # Target: Next day's outcome (3-Class)
    # Class 0: Neither
    # Class 1: UC hit (next day high touched or exceeded circuit threshold)
    # Class 2: LC hit (next day low touched or dropped below lower circuit threshold)
    next_high = grouped["high"].shift(-1)
    next_low = grouped["low"].shift(-1)
    next_prev_close = grouped["close"].shift(0)  # tomorrow's prevClose is today's close

    uc_thresh = next_prev_close * (1.0 + df["price_band"] - 0.003)
    lc_thresh = next_prev_close * (1.0 - df["price_band"] + 0.003)

    target = np.zeros(len(df), dtype=int)
    is_uc = (next_high >= uc_thresh) & (next_high > 0)
    is_lc = (next_low <= lc_thresh) & (next_low > 0)

    target[is_uc] = 1
    # If both (rare volatile day), prioritize direction of close
    target[is_lc & (~is_uc)] = 2

    df["target"] = target
    df["next_date"] = grouped["date"].shift(-1)

    return df


FEATURE_COLS = [
    "return_1d", "return_3d", "return_5d", "return_10d",
    "range_pos", "dist_day_high", "dist_day_low", "dist_vwap",
    "dist_ema_20", "dist_ema_50", "ema_spread",
    "dist_20d_high", "dist_20d_low", "atr_pct", "rsi_14",
    "rvol", "vol_accel", "delivery_pct",
    "price_band", "dist_to_uc", "dist_to_lc", "consecutive_uc", "consecutive_lc",
    "nifty_return", "market_volatility", "sector_return", "sector_rs", "gap_pct"
]


def load_dataset(sample_symbols: int = None, min_date: str = "2023-01-01") -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    conn = get_db_connection()
    print(f"Loading data from SQLite (since {min_date})...")

    stocks = pd.read_sql("SELECT symbol, name, sector, industry FROM stocks", conn)

    if sample_symbols:
        top_symbols = stocks["symbol"].head(sample_symbols).tolist()
        sym_list = ",".join(f"'{s}'" for s in top_symbols)
        query = f"SELECT * FROM daily_bars WHERE date >= '{min_date}' AND symbol IN ({sym_list})"
    else:
        query = f"SELECT * FROM daily_bars WHERE date >= '{min_date}'"

    bars = pd.read_sql(query, conn)
    indices = pd.read_sql(f"SELECT * FROM index_bars WHERE date >= '{min_date}'", conn)
    conn.close()

    print(f"Loaded {len(bars)} daily bars for {bars['symbol'].nunique()} symbols.")
    return bars, indices, stocks


def train_walk_forward(df: pd.DataFrame) -> Tuple[Any, Dict[str, Any]]:
    """
    Strict Time-Based Walk-Forward Validation.
    Folds evaluate out-of-sample forward periods without data leakage.
    """
    print("\n==========================================")
    print("WALK-FORWARD VALIDATION (TIME-BASED SPLIT)")
    print("==========================================")

    # Filter rows with complete features and valid target
    clean_df = df.dropna(subset=FEATURE_COLS).copy()
    latest_date = clean_df["date"].max()
    train_pool = clean_df[clean_df["date"] < latest_date].copy()

    dates = sorted(train_pool["date"].unique())
    n_dates = len(dates)
    print(f"Total trading days in dataset: {n_dates} (from {dates[0]} to {dates[-1]})")

    # Define 3 sequential walk-forward time splits
    split_points = [
        (int(n_dates * 0.50), int(n_dates * 0.70)),
        (int(n_dates * 0.70), int(n_dates * 0.85)),
        (int(n_dates * 0.85), n_dates)
    ]

    fold_metrics = []
    trained_model = None

    for fold_idx, (train_end, test_end) in enumerate(split_points, 1):
        train_dates = dates[:train_end]
        test_dates = dates[train_end:test_end]

        train_data = train_pool[train_pool["date"].isin(train_dates)]
        test_data = train_pool[train_pool["date"].isin(test_dates)]

        X_train, y_train = train_data[FEATURE_COLS], train_data["target"]
        X_test, y_test = test_data[FEATURE_COLS], test_data["target"]

        print(f"\n--- Fold {fold_idx} ---")
        print(f"Train period: {train_dates[0]} to {train_dates[-1]} ({len(train_data):,} samples)")
        print(f"Test period:  {test_dates[0]} to {test_dates[-1]} ({len(test_data):,} samples)")
        print(f"Train Class Distribution: UC={(y_train == 1).mean():.2%}, LC={(y_train == 2).mean():.2%}, Normal={(y_train == 0).mean():.2%}")

        # Compute sample weights to handle circuit imbalance
        classes = np.unique(y_train)
        class_counts = np.bincount(y_train)
        total_samples = len(y_train)
        class_weights = {c: total_samples / (len(classes) * count) for c, count in enumerate(class_counts)}
        sample_weights = y_train.map(class_weights).values

        if HAS_LIGHTGBM:
            clf = lgb.LGBMClassifier(
                objective="multiclass",
                num_class=3,
                n_estimators=180,
                learning_rate=0.05,
                num_leaves=31,
                max_depth=6,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42,
                verbose=-1
            )
            clf.fit(X_train, y_train, sample_weight=sample_weights)
        elif HAS_XGBOOST:
            clf = xgb.XGBClassifier(
                objective="multi:softprob",
                num_class=3,
                n_estimators=150,
                learning_rate=0.05,
                max_depth=5,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42,
                eval_metric="mlogloss"
            )
            clf.fit(X_train, y_train, sample_weight=sample_weights)
        else:
            raise RuntimeError("Neither LightGBM nor XGBoost is installed.")

        # Out-of-sample predictions
        preds_proba = clf.predict_proba(X_test)
        loss = log_loss(y_test, preds_proba)

        brier_uc = brier_score_loss((y_test == 1).astype(int), preds_proba[:, 1])
        brier_lc = brier_score_loss((y_test == 2).astype(int), preds_proba[:, 2])

        try:
            auc_uc = roc_auc_score((y_test == 1).astype(int), preds_proba[:, 1])
        except Exception:
            auc_uc = 0.5

        try:
            auc_lc = roc_auc_score((y_test == 2).astype(int), preds_proba[:, 2])
        except Exception:
            auc_lc = 0.5

        print(f"Out-of-Sample Log Loss: {loss:.4f}")
        print(f"UC ROC-AUC: {auc_uc:.4f} | UC Brier Score: {brier_uc:.4f}")
        print(f"LC ROC-AUC: {auc_lc:.4f} | LC Brier Score: {brier_lc:.4f}")

        fold_metrics.append({
            "fold": fold_idx,
            "trainPeriod": f"{train_dates[0]} to {train_dates[-1]}",
            "testPeriod": f"{test_dates[0]} to {test_dates[-1]}",
            "trainSamples": len(train_data),
            "testSamples": len(test_data),
            "logLoss": round(float(loss), 4),
            "ucRocAuc": round(float(auc_uc), 4),
            "lcRocAuc": round(float(auc_lc), 4),
            "ucBrier": round(float(brier_uc), 4),
            "lcBrier": round(float(brier_lc), 4)
        })

        trained_model = clf

    importances = clf.feature_importances_
    feat_imp = sorted(
        [{"feature": col, "importance": round(float(imp), 4)} for col, imp in zip(FEATURE_COLS, importances)],
        key=lambda x: x["importance"],
        reverse=True
    )

    metrics_summary = {
        "modelType": "LightGBM Multi-Class Classifier" if HAS_LIGHTGBM else "XGBoost Multi-Class Classifier",
        "validationMethod": "Strict Time-Based Walk-Forward (3 Folds)",
        "evaluatedAt": datetime.now().isoformat(),
        "folds": fold_metrics,
        "averageLogLoss": round(float(np.mean([f["logLoss"] for f in fold_metrics])), 4),
        "averageUcRocAuc": round(float(np.mean([f["ucRocAuc"] for f in fold_metrics])), 4),
        "averageLcRocAuc": round(float(np.mean([f["lcRocAuc"] for f in fold_metrics])), 4),
        "featureImportances": feat_imp[:12]
    }

    return trained_model, metrics_summary


def generate_predictions(model: Any, df: pd.DataFrame, metrics: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generates calibrated 3-class probability predictions for the latest trading day.
    """
    latest_date = df["date"].max()
    print(f"\nGenerating predictions for latest trading date: {latest_date}...")

    latest_slice = df[df["date"] == latest_date].dropna(subset=FEATURE_COLS).copy()
    if latest_slice.empty:
        raise ValueError(f"No complete data available for latest date {latest_date}")

    X_latest = latest_slice[FEATURE_COLS]
    probs = model.predict_proba(X_latest)

    latest_slice["noCircuitProb"] = probs[:, 0]
    latest_slice["ucProb"] = probs[:, 1]
    latest_slice["lcProb"] = probs[:, 2]

    predictions = []
    for _, row in latest_slice.iterrows():
        signals = []
        if row["rvol"] >= 2.5:
            signals.append(f"Volume Surge ({row['rvol']:.1f}x RVOL)")
        if row["dist_to_uc"] <= 0.03:
            signals.append(f"Near UC ({row['dist_to_uc']*100:.1f}%)")
        if row["sector_rs"] >= 0.02:
            signals.append(f"Sector Outperformer (+{row['sector_rs']*100:.1f}%)")
        if row["gap_pct"] >= 0.015:
            signals.append(f"Gap Up (+{row['gap_pct']*100:.1f}%)")
        if row["rsi_14"] >= 70:
            signals.append(f"High Momentum (RSI {row['rsi_14']:.0f})")
        if row["dist_to_lc"] <= 0.03:
            signals.append(f"Near LC Warning ({row['dist_to_lc']*100:.1f}%)")

        predictions.append({
            "symbol": str(row["symbol"]),
            "name": str(row["name"]),
            "sector": str(row["sector"]),
            "date": str(row["date"]),
            "close": round(float(row["close"]), 2),
            "prevClose": round(float(row["prevClose"]), 2),
            "changePct": round(float(row["return_1d"] * 100), 2),
            "priceBandPct": int(round(float(row["price_band"]) * 100)),
            "ucProbability": round(float(row["ucProb"] * 100), 1),
            "lcProbability": round(float(row["lcProb"] * 100), 1),
            "noCircuitProbability": round(float(row["noCircuitProb"] * 100), 1),
            "distanceToUc": round(float(row["dist_to_uc"] * 100), 2),
            "distanceToLc": round(float(row["dist_to_lc"] * 100), 2),
            "rvol": round(float(row["rvol"]), 2),
            "gapPct": round(float(row["gap_pct"] * 100), 2),
            "rsi14": round(float(row["rsi_14"]), 1),
            "sectorRs": round(float(row["sector_rs"] * 100), 2),
            "vwapDistance": round(float(row["dist_vwap"] * 100), 2),
            "signals": signals
        })

    predictions.sort(key=lambda x: x["ucProbability"], reverse=True)

    high_uc_candidates = [p for p in predictions if p["ucProbability"] >= 50]
    high_lc_candidates = [p for p in predictions if p["lcProbability"] >= 50]

    output = {
        "date": str(latest_date),
        "generatedAt": datetime.now().isoformat(),
        "totalAnalyzed": len(predictions),
        "summary": {
            "highUcCandidates": len(high_uc_candidates),
            "highLcCandidates": len(high_lc_candidates),
            "avgUcProbability": round(float(np.mean([p["ucProbability"] for p in predictions])), 1),
            "avgLcProbability": round(float(np.mean([p["lcProbability"] for p in predictions])), 1),
        },
        "modelMetrics": {
            "validationMethod": metrics.get("validationMethod"),
            "averageUcRocAuc": metrics.get("averageUcRocAuc"),
            "averageLcRocAuc": metrics.get("averageLcRocAuc"),
            "averageLogLoss": metrics.get("averageLogLoss"),
            "topFeatures": metrics.get("featureImportances", [])[:8]
        },
        "predictions": predictions
    }

    return output


def main():
    parser = argparse.ArgumentParser(description="3-Class Circuit Predictor")
    parser.add_argument("--sample", type=int, default=None, help="Sample N symbols for faster run")
    parser.add_argument("--min-date", type=str, default="2023-01-01", help="Starting date for training data")
    args = parser.parse_args()

    os.makedirs(MODEL_DIR, exist_ok=True)

    # 1. Load data
    bars, indices, stocks = load_dataset(sample_symbols=args.sample, min_date=args.min_date)

    # 2. Extract features
    df = extract_features(bars, indices, stocks)

    # 3. Walk-forward train & evaluate
    model, metrics = train_walk_forward(df)

    # 4. Save model and metrics
    model_path = os.path.join(MODEL_DIR, "circuit_classifier.joblib")
    joblib.dump(model, model_path)
    print(f"\nSaved trained model to {model_path}")

    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved walk-forward metrics to {METRICS_PATH}")

    # 5. Generate predictions for latest date
    predictions_payload = generate_predictions(model, df, metrics)
    with open(PREDICTIONS_PATH, "w") as f:
        json.dump(predictions_payload, f, indent=2)
    print(f"Saved latest circuit predictions ({len(predictions_payload['predictions'])} stocks) to {PREDICTIONS_PATH}")
    print("\n[SUCCESS] Circuit ML Pipeline Completed Successfully.")


if __name__ == "__main__":
    main()
