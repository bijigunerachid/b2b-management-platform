"""Backtest, train and score the late-payment model, then save results for the app."""

import json
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd

from .. import metrics
from ..config import MODELS_DIR
from ..db import connect
from .data import GRACE_DAYS, PAYMENT_TERMS_DAYS, label, load_invoices, load_payments, settle
from .features import FEATURES, build_frame, customer_history_baseline
from .model import INPUTS, RiskModel, TreeModel

MODEL_NAME = "payment_risk"
BACKTEST_MONTHS = 6
# Facts saved with each score, so the app can explain it in plain words.
FACTS = ["known_invoices", "late_share", "recent_delay", "overdue_invoices", "overdue_amount", "invoice_total", "month"]


def _score(actual, probability) -> dict:
    return {
        "auc": metrics.roc_auc(actual, probability),
        "average_precision": metrics.average_precision(actual, probability),
        "brier": metrics.brier(actual, probability),
        "log_loss": metrics.log_loss(actual, probability),
        "capture_20": metrics.capture_rate(actual, probability, 0.2),
    }


def backtest_months(frame: pd.DataFrame, as_of: pd.Timestamp, count: int = BACKTEST_MONTHS) -> list[pd.Timestamp]:
    """The last `count` calendar months whose invoices all have a known outcome by `as_of`."""
    wait = pd.Timedelta(days=PAYMENT_TERMS_DAYS + GRACE_DAYS)
    last_full = (as_of - wait).to_period("M") - 1
    months = [(last_full - i).to_timestamp() for i in range(count)][::-1]
    first_invoice = frame["created_at"].min()
    return [month for month in months if month > first_invoice]


def backtest(frame: pd.DataFrame, as_of: pd.Timestamp, count: int = BACKTEST_MONTHS) -> dict:
    """For each test month, train only on invoices whose outcome was known at the
    start of that month, then score the invoices issued during it."""
    rows = []
    for month in backtest_months(frame, as_of, count):
        month_end = month + pd.offsets.MonthBegin(1)
        train = frame.assign(late=label(frame, month)).dropna(subset=["late"])
        test = frame[(frame["created_at"] >= month) & (frame["created_at"] < month_end)]
        test = test.assign(late=label(test, as_of)).dropna(subset=["late"])
        if train["late"].nunique() < 2 or test.empty:
            continue
        base_rate = float(train["late"].mean())
        rows.append(pd.DataFrame({
            "month": month,
            "order_id": test["order_id"].values,
            "actual": test["late"].values,
            "model": RiskModel().fit(train).predict(test),
            "trees": TreeModel().fit(train).predict(test),
            "customer_history": customer_history_baseline(test, base_rate).values,
            "base_rate": base_rate,
        }))

    results = pd.concat(rows, ignore_index=True)
    methods = ["model", "trees", "customer_history", "base_rate"]
    summary = {method: _score(results["actual"], results[method]) for method in methods}
    per_month = [
        {
            "month": month.date().isoformat(),
            "invoices": int(len(group)),
            "late_rate": float(group["actual"].mean()),
            "model_auc": metrics.roc_auc(group["actual"], group["model"]),
            "baseline_auc": metrics.roc_auc(group["actual"], group["customer_history"]),
        }
        for month, group in results.groupby("month")
    ]
    return {
        "folds": len(per_month),
        "rows": int(len(results)),
        "late_rate": float(results["actual"].mean()),
        "methods": summary,
        "best_baseline": "customer_history",
        # Brier score: the main measure, it rewards probabilities that are both sharp and honest.
        "improvement_vs_baseline": 1 - summary["model"]["brier"] / summary["customer_history"]["brier"],
        "calibration": metrics.calibration(results["actual"], results["model"], bins=5),
        "per_month": per_month,
    }


def open_invoices(frame: pd.DataFrame, as_of: pd.Timestamp) -> pd.DataFrame:
    """Unpaid invoices that aren't late yet: the ones where a warning still helps."""
    return frame[frame["settled_at"].isna() & (frame["cutoff"] > as_of)]


def run(today: pd.Timestamp | None = None, write: bool = True) -> dict:
    as_of = pd.Timestamp(today or datetime.now(timezone.utc).replace(tzinfo=None))

    with connect() as connection:
        invoices = settle(load_invoices(connection), load_payments(connection))
        frame = build_frame(invoices)

        evaluation = backtest(frame, as_of)
        training = frame.assign(late=label(frame, as_of)).dropna(subset=["late"])
        model = RiskModel().fit(training)

        current = open_invoices(frame, as_of)
        scores = current[["order_id", *FACTS]].assign(
            probability=model.predict(current) if len(current) else [],
            reasons=model.reasons(current) if len(current) else [],
        )

        trained_at = datetime.now(timezone.utc).replace(microsecond=0)
        version = trained_at.strftime("%Y%m%d-%H%M%S")
        details = {
            "as_of": as_of.date().isoformat(),
            "late_definition_days": GRACE_DAYS,
            "payment_terms_days": PAYMENT_TERMS_DAYS,
            "data_from": frame["created_at"].min().date().isoformat(),
            "training_rows": int(len(training)),
            "training_late_rate": float(training["late"].mean()),
            "invoices_scored": int(len(scores)),
            "features": list(INPUTS),
            "coefficients": model.coefficients(),
            "algorithm": "Logistic regression on standardised inputs (L2, C=0.1)",
            "alternative": "HistGradientBoostingClassifier on " + ", ".join(FEATURES),
            "backtest": evaluation,
        }
        result = {"name": MODEL_NAME, "version": version, "trained_at": trained_at.isoformat(), "details": details}

        MODELS_DIR.mkdir(exist_ok=True)
        joblib.dump(model, MODELS_DIR / f"{MODEL_NAME}-{version}.joblib")

        if write:
            save(connection, result, scores)
    return result


def _facts(row) -> str:
    values = {}
    for fact in FACTS:
        value = getattr(row, fact)
        values[fact] = None if pd.isna(value) else round(float(value), 3)
    values["late_invoices"] = int(round((values["late_share"] or 0) * values["known_invoices"]))
    values["reasons"] = list(row.reasons)
    return json.dumps(values)


def save(connection, result: dict, scores: pd.DataFrame) -> None:
    """Registers the model and replaces the published scores, all or nothing."""
    backtest = result["details"]["backtest"]
    model, baseline = backtest["methods"]["model"], backtest["methods"][backtest["best_baseline"]]
    headline = {
        "auc": model["auc"],
        "brier": model["brier"],
        "average_precision": model["average_precision"],
        "capture_20": model["capture_20"],
        "baseline": backtest["best_baseline"],
        "baseline_auc": baseline["auc"],
        "baseline_brier": baseline["brier"],
        "baseline_capture_20": baseline["capture_20"],
        "late_rate": backtest["late_rate"],
        "improvement_vs_baseline": backtest["improvement_vs_baseline"],
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
                """DELETE s FROM payment_risk_scores s
                   INNER JOIN ml_models m ON m.id = s.model_id
                   WHERE m.name = %s AND m.id <> %s""",
                (MODEL_NAME, model_id),
            )
            cursor.executemany(
                "INSERT INTO payment_risk_scores (model_id, order_id, probability, facts) VALUES (%s, %s, %s, %s)",
                [(model_id, int(row.order_id), round(float(row.probability), 4), _facts(row)) for row in scores.itertuples()],
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
