"""Features for "how many units of this product will sell in the next 4 weeks?".

One row per product per origin week t. Every feature uses only weeks up to and
including t, so a model never sees the future it is asked to predict.
"""

import numpy as np
import pandas as pd

HORIZON = 4  # weeks predicted ahead

FEATURES = [
    "lag_1", "lag_2", "lag_3", "lag_4",
    "sum_4", "mean_13", "mean_26", "mean_52",
    "last_year", "trend", "weeks_on_sale",
    "category_sum_4", "category_mean_52", "seasonal_index", "seasonal_estimate", "share_of_category",
    "log_price", "category_id", "target_month",
]
CATEGORICAL = ["category_id", "target_month"]


def build_frame(panel: pd.DataFrame, horizon: int = HORIZON) -> pd.DataFrame:
    """Adds features and the target (`target`, NaN where the future isn't known yet)."""
    panel = panel.sort_values(["product_id", "week"]).reset_index(drop=True)
    grouped = panel.groupby("product_id", sort=False)["units"]

    frame = panel[["product_id", "week", "units", "category_id", "price", "is_active"]].copy()
    # Units sold in weeks t+1..t+horizon (NaN where the future isn't known yet).
    frame["target"] = grouped.transform(lambda units: units.rolling(horizon, min_periods=horizon).sum().shift(-horizon))
    for lag in range(1, 5):
        frame[f"lag_{lag}"] = grouped.shift(lag - 1)

    rolling_4 = grouped.transform(lambda units: units.rolling(4, min_periods=1).sum())
    frame["sum_4"] = rolling_4
    frame["mean_13"] = grouped.transform(lambda units: units.rolling(13, min_periods=1).mean()) * horizon
    frame["mean_26"] = grouped.transform(lambda units: units.rolling(26, min_periods=1).mean()) * horizon

    # The same 4 weeks one year earlier: weeks t-51..t-48, i.e. the 4-week sum ending at t-48.
    full_year = grouped.transform(lambda units: units.rolling(4, min_periods=4).sum().shift(52 - horizon))
    frame["last_year"] = full_year

    frame["mean_52"] = grouped.transform(lambda units: units.rolling(52, min_periods=1).mean()) * horizon
    frame["trend"] = (frame["sum_4"] + 1) / (frame["mean_26"] + 1)

    # Single products sell too rarely to show seasonality on their own, so pool
    # the whole category: how busy were these same weeks last year, relative to
    # a normal 4 weeks? Multiply the product's usual level by that.
    category = (
        panel.groupby(["category_id", "week"], as_index=False)["units"].sum().sort_values(["category_id", "week"])
    )
    by_category = category.groupby("category_id", sort=False)["units"]
    category["category_sum_4"] = by_category.transform(lambda units: units.rolling(4, min_periods=1).sum())
    category["category_mean_52"] = by_category.transform(lambda units: units.rolling(52, min_periods=1).mean()) * horizon
    category["category_last_year"] = by_category.transform(
        lambda units: units.rolling(4, min_periods=4).sum().shift(52 - horizon)
    )
    frame = frame.merge(
        category[["category_id", "week", "category_sum_4", "category_mean_52", "category_last_year"]],
        on=["category_id", "week"],
        how="left",
    )
    # No history a year back yet: assume an average month.
    frame["seasonal_index"] = ((frame["category_last_year"] + 1) / (frame["category_mean_52"] + 1)).fillna(1.0)
    frame["seasonal_estimate"] = frame["mean_52"] * frame["seasonal_index"]
    frame["share_of_category"] = (frame["mean_52"] + 0.1) / (frame["category_mean_52"] + 1)
    frame["weeks_on_sale"] = frame.groupby("product_id", sort=False).cumcount() + 1
    frame["log_price"] = np.log1p(frame["price"])
    frame["target_month"] = (frame["week"] + pd.Timedelta(days=7)).dt.month
    frame["category_id"] = frame["category_id"].astype(int)

    return frame.sort_values(["product_id", "week"]).reset_index(drop=True)


def baselines(frame: pd.DataFrame) -> pd.DataFrame:
    """Simple forecasts the model has to beat."""
    return pd.DataFrame(
        {
            "naive": frame["sum_4"],  # the last 4 weeks again
            "moving_average": frame["mean_13"],  # average of the last quarter
            "seasonal_naive": frame["last_year"].fillna(frame["sum_4"]),  # same weeks last year
            "seasonal_average": frame["seasonal_estimate"],  # usual level x category seasonality
        },
        index=frame.index,
    )
