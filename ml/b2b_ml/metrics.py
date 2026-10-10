"""Forecast accuracy measures."""

import numpy as np


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
