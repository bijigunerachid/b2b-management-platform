"""Backtest, train, and score the demand forecast, then save results for the app."""

import json
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd

from .. import metrics
from ..config import MODELS_DIR
from ..db import connect
from .data import load_products, load_sales, week_start, weekly_panel
from .features import HORIZON, baselines, build_frame
from .model import DemandModel

MODEL_NAME = "demand_forecast"
BACKTEST_FOLDS = 6


def last_complete_week(today: pd.Timestamp) -> pd.Timestamp:
    """Monday of the week before `today`'s week."""
    return week_start(pd.Series([today])).iloc[0] - pd.Timedelta(days=7)


def backtest(frame: pd.DataFrame, folds: int = BACKTEST_FOLDS, horizon: int = HORIZON) -> dict:
    """Rolling-origin evaluation on the most recent weeks.

    For each origin, the model trains only on rows whose 4-week target ended
    before the origin, then predicts the 4 weeks after it, as it would in real use.
    """
    known = frame[frame["target"].notna()]
    last_origin = known["week"].max()
    origins = [last_origin - pd.Timedelta(weeks=horizon * i) for i in range(folds)][::-1]

    rows = []
    for origin in origins:
        train = known[known["week"] <= origin - pd.Timedelta(weeks=horizon)]
        test = known[known["week"] == origin]
        if train.empty or test.empty:
            continue
        predicted = DemandModel().fit(train).predict(test)
        base = baselines(test)
        rows.append(pd.DataFrame({
            "origin": origin,
            "product_id": test["product_id"].values,
            "actual": test["target"].values,
            "model": predicted["units"].values,
            "lower": predicted["lower"].values,
            "upper": predicted["upper"].values,
            **{name: base[name].values for name in base.columns},
        }))

    results = pd.concat(rows, ignore_index=True)
    methods = ["model", "naive", "moving_average", "seasonal_naive", "seasonal_average"]
    summary = {
        method: {
            "wape": metrics.wape(results["actual"], results[method]),
            "mae": metrics.mae(results["actual"], results[method]),
            "rmse": metrics.rmse(results["actual"], results[method]),
            "bias": metrics.bias(results["actual"], results[method]),
        }
        for method in methods
    }
    summary["model"]["interval_coverage"] = metrics.coverage(results["actual"], results["lower"], results["upper"])
    # Safety stock is sized from the upper bound, so this is the number to watch:
    # it should sit near 10%. (Coverage runs above 80% because the lower bound is
    # 0 for most products, and sales can't fall below 0.)
    summary["model"]["above_upper"] = float(np.mean(results["actual"] > results["upper"]))

    # The model predicts expected units, so rank baselines by squared error (RMSE),
    # the score expected-value forecasts are judged by. WAPE and bias are reported too.
    best_baseline = min((name for name in methods if name != "model"), key=lambda name: summary[name]["rmse"])
    per_origin = (
        # Totals across products. Bounds aren't summed: adding per-product 10%/90%
        # bounds doesn't give an 80% interval for the total.
        results.groupby("origin")[["actual", "model", best_baseline]].sum().reset_index()
        .rename(columns={best_baseline: "baseline"})
    )
    return {
        "folds": len(per_origin),
        "rows": len(results),
        "methods": summary,
        "best_baseline": best_baseline,
        "improvement_vs_baseline": 1 - summary["model"]["rmse"] / summary[best_baseline]["rmse"],
        "per_origin": [
            {"origin": row.origin.date().isoformat(), "actual": round(row.actual, 1), "forecast": round(row.model, 1),
             "baseline": round(row.baseline, 1)}
            for row in per_origin.itertuples()
        ],
    }


def published_method(evaluation: dict) -> str:
    """"model" if it beat the best simple method on the backtest, else that method's name."""
    methods, best = evaluation["methods"], evaluation["best_baseline"]
    return "model" if methods["model"]["rmse"] < methods[best]["rmse"] else best


def run(today: pd.Timestamp | None = None, write: bool = True) -> dict:
    """Full job: load, backtest, train on everything, score the next 4 weeks, save."""
    today = pd.Timestamp(today or datetime.now(timezone.utc).replace(tzinfo=None))
    origin = last_complete_week(today)

    with connect() as connection:
        sales = load_sales(connection)
        products = load_products(connection)
        panel = weekly_panel(sales, products, origin)
        frame = build_frame(panel)

        evaluation = backtest(frame)
        training = frame[frame["target"].notna()]
        model = DemandModel().fit(training)

        current = frame[(frame["week"] == origin) & frame["is_active"]]
        forecast = model.predict(current).assign(product_id=current["product_id"].values)

        # Champion check: only publish the model's numbers if it beat the best
        # simple method on the recent weeks it was tested on. Otherwise publish
        # that method's forecast (keeping the model's range around it), so
        # reorder suggestions never rest on a forecast that lost its own test.
        published = published_method(evaluation)
        if published != "model":
            simple = baselines(current)[published].to_numpy()
            forecast["units"] = simple
            forecast["lower"] = np.minimum(forecast["lower"].to_numpy(), simple)
            forecast["upper"] = np.maximum(forecast["upper"].to_numpy(), simple)

        trained_at = datetime.now(timezone.utc).replace(microsecond=0)
        version = trained_at.strftime("%Y%m%d-%H%M%S")
        details = {
            "horizon_weeks": HORIZON,
            "origin_week": origin.date().isoformat(),
            "data_from": frame["week"].min().date().isoformat(),
            "training_rows": int(len(training)),
            "products_scored": int(len(forecast)),
            "features": list(model.point.feature_names_in_),
            "algorithm": "HistGradientBoostingRegressor (Poisson loss on sales relative to each product's usual level) + 10%/90% quantile models",
            "published_method": published,
            "backtest": evaluation,
        }
        result = {"name": MODEL_NAME, "version": version, "trained_at": trained_at.isoformat(), "details": details}

        MODELS_DIR.mkdir(exist_ok=True)
        joblib.dump(model, MODELS_DIR / f"{MODEL_NAME}-{version}.joblib")

        if write:
            save(connection, result, forecast, origin)
    return result


def save(connection, result: dict, forecast: pd.DataFrame, origin: pd.Timestamp) -> None:
    """Registers the model and replaces the published forecasts, all or nothing."""
    summary = result["details"]["backtest"]["methods"]["model"]
    backtest = result["details"]["backtest"]
    baseline = backtest["methods"][backtest["best_baseline"]]
    headline = {
        "wape": summary["wape"],
        "rmse": summary["rmse"],
        "bias": summary["bias"],
        "baseline": backtest["best_baseline"],
        "baseline_wape": baseline["wape"],
        "baseline_rmse": baseline["rmse"],
        "baseline_bias": baseline["bias"],
        "improvement_vs_baseline": backtest["improvement_vs_baseline"],
        "interval_coverage": summary["interval_coverage"],
        "published_method": result["details"]["published_method"],
        "above_upper": summary["above_upper"],
    }
    try:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE ml_models SET is_active = 0 WHERE name = %s", (MODEL_NAME,))
            cursor.execute(
                """INSERT INTO ml_models (name, version, trained_at, metrics, details, is_active)
                   VALUES (%s, %s, %s, %s, %s, 1)""",
                (MODEL_NAME, result["version"], result["trained_at"].replace("T", " ")[:19],
                 json.dumps(headline), json.dumps(result["details"], default=_json_default)),
            )
            model_id = cursor.lastrowid
            cursor.execute(
                """DELETE f FROM demand_forecasts f
                   INNER JOIN ml_models m ON m.id = f.model_id
                   WHERE m.name = %s AND m.id <> %s""",
                (MODEL_NAME, model_id),
            )
            cursor.executemany(
                """INSERT INTO demand_forecasts (model_id, product_id, origin_week, horizon_weeks, units, lower_units, upper_units)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                [
                    (model_id, int(row.product_id), origin.date(), HORIZON,
                     round(float(row.units), 2), round(float(row.lower), 2), round(float(row.upper), 2))
                    for row in forecast.itertuples()
                ],
            )
        connection.commit()
    except Exception:
        connection.rollback()
        raise


def _json_default(value):
    if isinstance(value, (np.floating, np.integer)):
        return value.item()
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    raise TypeError(f"Not JSON serializable: {type(value)}")
