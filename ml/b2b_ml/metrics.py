"""Accuracy measures for the forecasts (regression) and risk scores (classification)."""

import numpy as np
import pandas as pd


def wape(actual, predicted) -> float:
    """Weighted absolute percentage error: total absolute error / total actual.

    Unlike MAPE it stays meaningful when many products sell zero in a week.
    """
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)
    total = actual.sum()
    if total == 0:
        return float("nan")
    return float(np.abs(actual - predicted).sum() / total)


def mae(actual, predicted) -> float:
    return float(np.mean(np.abs(np.asarray(actual, dtype=float) - np.asarray(predicted, dtype=float))))


def rmse(actual, predicted) -> float:
    """Root mean squared error. The score a mean forecast is built to minimise:
    WAPE alone rewards forecasting the median, which for lumpy B2B demand is
    well below the mean and would leave the warehouse short."""
    return float(np.sqrt(np.mean((np.asarray(actual, dtype=float) - np.asarray(predicted, dtype=float)) ** 2)))


def bias(actual, predicted) -> float:
    """Positive when the forecast is too high on average (as a share of actual demand)."""
    actual = np.asarray(actual, dtype=float)
    total = actual.sum()
    if total == 0:
        return float("nan")
    return float((np.asarray(predicted, dtype=float) - actual).sum() / total)


def coverage(actual, lower, upper) -> float:
    """Share of actual values inside the [lower, upper] interval."""
    actual = np.asarray(actual, dtype=float)
    inside = (actual >= np.asarray(lower, dtype=float)) & (actual <= np.asarray(upper, dtype=float))
    return float(inside.mean()) if len(actual) else float("nan")


# Classification: probability that something happens (e.g. an invoice is paid late).

def roc_auc(actual, probability) -> float:
    """Chance that a random positive is ranked above a random negative (0.5 = no skill)."""
    from sklearn.metrics import roc_auc_score

    actual = np.asarray(actual, dtype=float)
    if len(np.unique(actual)) < 2:
        return float("nan")
    return float(roc_auc_score(actual, probability))


def average_precision(actual, probability) -> float:
    """Area under the precision-recall curve; equals the positive rate for a random ranking."""
    from sklearn.metrics import average_precision_score

    actual = np.asarray(actual, dtype=float)
    if actual.sum() == 0:
        return float("nan")
    return float(average_precision_score(actual, probability))


def brier(actual, probability) -> float:
    """Mean squared error of the probabilities. Lower is better; rewards honest probabilities."""
    return float(np.mean((np.asarray(probability, dtype=float) - np.asarray(actual, dtype=float)) ** 2))


def log_loss(actual, probability) -> float:
    actual = np.asarray(actual, dtype=float)
    probability = np.clip(np.asarray(probability, dtype=float), 1e-6, 1 - 1e-6)
    return float(-np.mean(actual * np.log(probability) + (1 - actual) * np.log(1 - probability)))


def capture_rate(actual, probability, share: float = 0.2) -> float:
    """Share of all positives found in the `share` of cases ranked riskiest."""
    actual = np.asarray(actual, dtype=float)
    if actual.sum() == 0:
        return float("nan")
    top = max(1, int(round(len(actual) * share)))
    order = np.argsort(-np.asarray(probability, dtype=float), kind="stable")
    return float(actual[order[:top]].sum() / actual.sum())


def calibration(actual, probability, bins: int = 5) -> list[dict]:
    """Cases split into equal-size groups by predicted probability: predicted vs observed rate."""
    frame = pd.DataFrame({"actual": np.asarray(actual, dtype=float), "probability": np.asarray(probability, dtype=float)})
    frame["bin"] = pd.qcut(frame["probability"].rank(method="first"), bins, labels=False)
    grouped = frame.groupby("bin").agg(predicted=("probability", "mean"), observed=("actual", "mean"), count=("actual", "size"))
    return [
        {"predicted": round(float(row.predicted), 4), "observed": round(float(row.observed), 4), "count": int(row.count)}
        for row in grouped.itertuples()
    ]


# Ranking: a top-k list of recommendations against what the customer actually bought.

def ranking_scores(recommended: list, relevant: set, k: int = 10) -> dict:
    """recall@k, precision@k, hit rate@k and NDCG@k for one customer."""
    top = list(recommended)[:k]
    hits = [1.0 if item in relevant else 0.0 for item in top]
    found = sum(hits)
    dcg = sum(hit / np.log2(rank + 2) for rank, hit in enumerate(hits))
    ideal = sum(1 / np.log2(rank + 2) for rank in range(min(len(relevant), k)))
    return {
        "recall": found / len(relevant) if relevant else float("nan"),
        "precision": found / k,
        "hit_rate": 1.0 if found else 0.0,
        "ndcg": dcg / ideal if ideal else float("nan"),
    }
