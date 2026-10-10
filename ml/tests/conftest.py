import numpy as np
import pandas as pd
import pytest


def make_panel(products: int = 30, weeks: int = 130, seed: int = 0) -> pd.DataFrame:
    """Weekly sales with a yearly cycle that differs by category, plus Poisson noise."""
    rng = np.random.default_rng(seed)
    start = pd.Timestamp("2024-01-01")  # a Monday
    rows = []
    for product_id in range(1, products + 1):
        category_id = product_id % 3 + 1
        level = rng.uniform(1, 6)
        peak = {1: 10, 2: 36, 3: 48}[category_id]  # week of the year sales peak
        for week in range(weeks):
            season = 1 + 0.8 * np.cos(2 * np.pi * (week % 52 - peak) / 52)
            rows.append({
                "product_id": product_id,
                "week": start + pd.Timedelta(weeks=week),
                "units": float(rng.poisson(level * season)),
                "category_id": category_id,
                "price": 10.0 * product_id,
                "is_active": True,
            })
    return pd.DataFrame(rows)


@pytest.fixture
def panel() -> pd.DataFrame:
    return make_panel()
