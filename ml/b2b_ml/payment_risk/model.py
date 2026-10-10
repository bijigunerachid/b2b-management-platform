"""Probability that an invoice is paid late, with the reasons behind it.

A regularised logistic regression on six inputs. Gradient-boosted trees were
tried on the full feature set and scored slightly worse on the backtest (they
stay in the comparison), and a linear model can say exactly why each score is
what it is: every input adds or removes a known amount of risk.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from .features import CATEGORICAL, FEATURES, customer_history_baseline

SEED = 2026

# Model inputs and the plain meaning of each one.
INPUTS = {
    "history": "how often the customer paid late before",
    "recent_delay": "how late their recent payments were",
    "overdue_invoices": "invoices already overdue when this one was issued",
    "log_amount": "invoice size",
    "busy_month": "issued in August or December",
    "new_customer": "no payment history yet",
}
REASON_THRESHOLD = 0.15  # log-odds above the average invoice before a factor counts as a reason


def model_inputs(frame: pd.DataFrame, base_rate: float) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "history": customer_history_baseline(frame, base_rate),
            "recent_delay": frame["recent_delay"].fillna(0).clip(-30, 90),
            "overdue_invoices": frame["overdue_invoices"].clip(upper=5),
            "log_amount": frame["log_amount"],
            "busy_month": frame["month"].isin([8, 12]).astype(int),
            "new_customer": (frame["known_invoices"] == 0).astype(int),
        },
        index=frame.index,
    )


class RiskModel:
    def __init__(self, C: float = 0.1):
        self.scaler = StandardScaler()
        self.classifier = LogisticRegression(C=C, max_iter=2000)
        self.base_rate = None

    def fit(self, frame: pd.DataFrame) -> "RiskModel":
        self.base_rate = float(frame["late"].mean())
        X = self.scaler.fit_transform(model_inputs(frame, self.base_rate))
        self.classifier.fit(X, frame["late"].astype(int))
        return self

    def _scaled(self, frame: pd.DataFrame) -> np.ndarray:
        return self.scaler.transform(model_inputs(frame, self.base_rate))

    def predict(self, frame: pd.DataFrame) -> np.ndarray:
        """Probability of being paid late, per row."""
        return self.classifier.predict_proba(self._scaled(frame))[:, 1]

    def coefficients(self) -> dict:
        return {name: round(float(value), 4) for name, value in zip(INPUTS, self.classifier.coef_[0])}

    def reasons(self, frame: pd.DataFrame, limit: int = 3) -> list[list[str]]:
        """Per row, the inputs that raise its risk most compared with an average invoice."""
        contributions = self._scaled(frame) * self.classifier.coef_[0]
        names = list(INPUTS)
        result = []
        for row in contributions:
            order = np.argsort(-row)
            result.append([names[i] for i in order[:limit] if row[i] > REASON_THRESHOLD])
        return result


class TreeModel:
    """Gradient-boosted trees on every feature: the more flexible alternative, kept for comparison."""

    def __init__(self):
        self.classifier = HistGradientBoostingClassifier(
            max_iter=300,
            learning_rate=0.03,
            max_leaf_nodes=7,
            min_samples_leaf=200,
            l2_regularization=1.0,
            categorical_features=CATEGORICAL,
            random_state=SEED,
        )

    def fit(self, frame: pd.DataFrame) -> "TreeModel":
        self.classifier.fit(frame[FEATURES], frame["late"].astype(int))
        return self

    def predict(self, frame: pd.DataFrame) -> np.ndarray:
        return self.classifier.predict_proba(frame[FEATURES])[:, 1]
