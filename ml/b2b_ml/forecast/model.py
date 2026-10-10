"""Gradient-boosted demand model with an 80% prediction interval."""

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from .features import CATEGORICAL, FEATURES

SEED = 2026


def _regressor(**options) -> HistGradientBoostingRegressor:
    return HistGradientBoostingRegressor(
        # Chosen on the rolling backtest. Weekly sales per product are noisy
        # (over half of 4-week windows sell nothing), so small, heavily
        # regularised trees generalise better than deep ones.
        max_iter=300,
        learning_rate=0.02,
        max_leaf_nodes=15,
        min_samples_leaf=200,
        l2_regularization=1.0,
        categorical_features=CATEGORICAL,
        random_state=SEED,
        **options,
    )


def _scale(frame: pd.DataFrame) -> pd.Series:
    """Each product's usual 4-week sales (26-week average), plus one so new products aren't zero."""
    return frame["mean_26"] + 1


class DemandModel:
    """Expected units plus 10% and 90% quantiles.

    The expected units are learned as a ratio to the product's usual level
    (Poisson loss, weighted by that level): "this product will sell 1.3x its
    normal amount". One model then works for best sellers and slow movers
    alike; predicting raw units let the few best sellers dominate, and the
    result swung from clearly better to clearly worse than a 13-week average
    depending on the data.
    """

    def __init__(self):
        self.point = _regressor(loss="poisson")
        self.lower = _regressor(loss="quantile", quantile=0.1)
        self.upper = _regressor(loss="quantile", quantile=0.9)

    def fit(self, frame: pd.DataFrame) -> "DemandModel":
        X, y = frame[FEATURES], frame["target"]
        scale = _scale(frame)
        self.point.fit(X, y / scale, sample_weight=scale)
        self.lower.fit(X, y)
        self.upper.fit(X, y)
        return self

    def predict(self, frame: pd.DataFrame) -> pd.DataFrame:
        X = frame[FEATURES]
        point = np.clip(self.point.predict(X) * _scale(frame).to_numpy(), 0, None)
        lower = np.clip(self.lower.predict(X), 0, None)
        upper = np.clip(self.upper.predict(X), 0, None)
        # Quantile models are fitted separately, so keep the interval around the point.
        lower = np.minimum(lower, point)
        upper = np.maximum(upper, point)
        return pd.DataFrame({"units": point, "lower": lower, "upper": upper}, index=frame.index)
