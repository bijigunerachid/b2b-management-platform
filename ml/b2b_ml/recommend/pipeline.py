"""Backtest, train and publish product recommendations."""

import json
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from .. import metrics
from ..db import connect
from .data import load_products, load_purchases
from .models import EASE, Blend, CategoryPopularity, Interactions, ItemKNN, Popularity, top_k

MODEL_NAME = "recommendations"
K = 10
FOLDS = 4
WINDOW_DAYS = 60  # "next purchases" = the 60 days after the cutoff
RECENT_DAYS = 180  # popularity is measured over this many days
# EASE plus some category popularity; chosen on the backtest (see ml/README.md).
MODEL = dict(method="blend", l2=200.0, weight=0.5)


def make_method(name: str, **options):
    if name == "ease":
        return EASE(l2=options.get("l2", 50.0))
    if name == "blend":
        return Blend(l2=options.get("l2", 200.0), weight=options.get("weight", 0.3))
    return {"popularity": Popularity, "category_popularity": CategoryPopularity, "item_knn": ItemKNN}[name]()


def _split(purchases: pd.DataFrame, cutoff: pd.Timestamp, window_days: int):
    history = purchases[purchases["created_at"] < cutoff]
    future = purchases[(purchases["created_at"] >= cutoff) & (purchases["created_at"] < cutoff + pd.Timedelta(days=window_days))]
    return history, future


def _fit_and_rank(history, products, cutoff, method, weighting="binary", k=K, active_only=False, **options):
    customers = np.sort(history["customer_id"].unique())
    product_ids = products["product_id"].to_numpy()
    data = Interactions(history, customers, product_ids, weighting)
    recent = Interactions(history[history["created_at"] >= cutoff - pd.Timedelta(days=RECENT_DAYS)], customers, product_ids)
    model = make_method(method, **options).fit(data, recent=recent, categories=products["category_id"].to_numpy())
    scores = model.score(data)
    sold_before = data.bought.any(axis=0)  # products nobody had bought yet can't be learned
    allowed = sold_before & products["is_active"].to_numpy() if active_only else sold_before
    return data, model, scores, top_k(scores, data.bought, k, allowed=allowed)


def evaluate(purchases, products, cutoff, window_days=WINDOW_DAYS, k=K, method="ease", weighting="binary", **options) -> pd.DataFrame:
    """Per customer: how many of the products they bought for the first time after
    `cutoff` were in their top k, using only purchases before it."""
    history, future = _split(purchases, cutoff, window_days)
    data, _, scores, ranked = _fit_and_rank(history, products, cutoff, method, weighting, k, **options)

    rows = []
    for customer, group in future.groupby("customer_id"):
        i = data.customer_index.get(customer)
        if i is None:
            continue  # first order after the cutoff: nothing to go on
        new = {data.product_index[p] for p in group["product_id"] if p in data.product_index} - set(np.flatnonzero(data.bought[i]))
        if not new:
            continue
        recommended = [j for j in ranked[i] if np.isfinite(scores[i, j])]
        rows.append({"customer_id": customer, "relevant": len(new), **metrics.ranking_scores(recommended, new, k)})
    return pd.DataFrame(rows)


def cutoffs(as_of: pd.Timestamp, folds: int = FOLDS, window_days: int = WINDOW_DAYS) -> list[pd.Timestamp]:
    """Cutoffs whose whole window has happened, newest last."""
    last = as_of.normalize() - pd.Timedelta(days=window_days)
    return [last - pd.Timedelta(days=window_days * i) for i in range(folds)][::-1]


METHODS = {
    "model": MODEL,
    "ease": dict(method="ease", l2=200.0),
    "item_knn": dict(method="item_knn"),
    "category_popularity": dict(method="category_popularity"),
    "popularity": dict(method="popularity"),
}


def backtest(purchases, products, as_of, folds=FOLDS, methods=METHODS) -> dict:
    results = {name: [] for name in methods}
    per_fold = []
    for cutoff in cutoffs(as_of, folds):
        fold = {"cutoff": cutoff.date().isoformat()}
        for name, options in methods.items():
            scored = evaluate(purchases, products, cutoff, **options).assign(cutoff=cutoff)
            results[name].append(scored)
            fold[name] = float(scored["recall"].mean()) if len(scored) else float("nan")
        fold["customers"] = int(len(results["model"][-1]))
        per_fold.append(fold)

    summary = {}
    for name, frames in results.items():
        frame = pd.concat(frames, ignore_index=True)
        summary[name] = {metric: float(frame[metric].mean()) for metric in ("recall", "precision", "hit_rate", "ndcg")}
    # Compare with the best rule that doesn't learn from co-purchases.
    simple = ("category_popularity", "popularity")
    model, best = summary["model"], max(simple, key=lambda n: summary[n]["recall"])
    return {
        "k": K,
        "window_days": WINDOW_DAYS,
        "folds": len(per_fold),
        "rows": int(sum(len(frame) for frame in results["model"])),
        "methods": summary,
        "best_baseline": best,
        "improvement_vs_baseline": model["recall"] / summary[best]["recall"] - 1,
        "per_fold": per_fold,
    }


class Explainer:
    """Why a product is recommended, as a fact anyone can check: "bought by 40% of
    customers who buy X", for the customer's past purchase X that makes it most
    likely. Only shown when enough customers bought both (MIN_TOGETHER) and the
    pair is clearly more common than chance (MIN_LIFT); otherwise the reason is
    the product's popularity in the categories the customer buys from."""

    MIN_TOGETHER = 3
    MIN_LIFT = 2.0

    def __init__(self, data: Interactions):
        bought = data.bought.astype(float)
        self.together = bought.T @ bought  # customers who bought both j and i
        self.buyers = bought.sum(axis=0)
        self.customers = bought.shape[0]
        self.data = data

    def __call__(self, customer: int, product: int) -> dict:
        history = np.flatnonzero(self.data.bought[customer])
        if history.size:
            together = self.together[history, product]
            share = together / np.maximum(self.buyers[history], 1)
            lift = share / max(self.buyers[product] / self.customers, 1e-9)
            usable = (together >= self.MIN_TOGETHER) & (lift >= self.MIN_LIFT)
            if usable.any():
                best = int(np.argmax(np.where(usable, share, -1)))
                return {"type": "bought_with", "product_id": int(self.data.product_ids[history[best]]), "share": round(float(share[best]), 3)}
        return {"type": "popular_in_category"}


def run(today: pd.Timestamp | None = None, write: bool = True) -> dict:
    as_of = pd.Timestamp(today or datetime.now(timezone.utc).replace(tzinfo=None))

    with connect() as connection:
        purchases, products = load_purchases(connection), load_products(connection)
        evaluation = backtest(purchases, products, as_of)

        history = purchases[purchases["created_at"] < as_of]
        data, model, scores, ranked = _fit_and_rank(history, products, as_of, active_only=True, **MODEL)
        explain = Explainer(data)
        rows = []
        for i, customer in enumerate(data.customer_ids):
            rank = 0
            for j in ranked[i]:
                if not np.isfinite(scores[i, j]):
                    continue
                rank += 1
                rows.append((int(customer), int(data.product_ids[j]), rank, float(scores[i, j]), explain(i, j)))

        trained_at = datetime.now(timezone.utc).replace(microsecond=0)
        version = trained_at.strftime("%Y%m%d-%H%M%S")
        details = {
            "as_of": as_of.date().isoformat(),
            "customers": int(len(data.customer_ids)),
            "products": int(len(data.product_ids)),
            "purchases": int(len(history)),
            "recommendations": len(rows),
            "settings": MODEL,
            "algorithm": "EASE (closed-form item-to-item linear model) blended with category popularity",
            "backtest": evaluation,
        }
        result = {"name": MODEL_NAME, "version": version, "trained_at": trained_at.isoformat(), "details": details}
        if write:
            save(connection, result, rows)
    return result


def save(connection, result: dict, rows: list) -> None:
    """Registers the model and replaces the published recommendations, all or nothing."""
    backtest = result["details"]["backtest"]
    model, baseline = backtest["methods"]["model"], backtest["methods"][backtest["best_baseline"]]
    headline = {
        "recall": model["recall"],
        "ndcg": model["ndcg"],
        "hit_rate": model["hit_rate"],
        "baseline": backtest["best_baseline"],
        "baseline_recall": baseline["recall"],
        "baseline_hit_rate": baseline["hit_rate"],
        "improvement_vs_baseline": backtest["improvement_vs_baseline"],
    }
    try:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE ml_models SET is_active = 0 WHERE name = %s", (MODEL_NAME,))
            cursor.execute(
                """INSERT INTO ml_models (name, version, trained_at, metrics, details, is_active)
                   VALUES (%s, %s, %s, %s, %s, 1)""",
                (MODEL_NAME, result["version"], result["trained_at"].replace("T", " ")[:19], json.dumps(headline), json.dumps(result["details"])),
            )
            model_id = cursor.lastrowid
            cursor.execute(
                """DELETE r FROM product_recommendations r
                   INNER JOIN ml_models m ON m.id = r.model_id
                   WHERE m.name = %s AND m.id <> %s""",
                (MODEL_NAME, model_id),
            )
            cursor.executemany(
                """INSERT INTO product_recommendations (model_id, customer_id, product_id, rank_position, score, reason)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                [(model_id, customer, product, rank, round(score, 6), json.dumps(reason)) for customer, product, rank, score, reason in rows],
            )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
