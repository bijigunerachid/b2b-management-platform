import pandas as pd

from b2b_ml.forecast.data import week_start, weekly_panel


def test_week_start_is_monday():
    days = pd.Series(pd.to_datetime(["2026-10-05", "2026-10-08", "2026-10-11"]))  # Mon, Thu, Sun
    assert list(week_start(days)) == [pd.Timestamp("2026-10-05")] * 3


def test_weekly_panel_fills_gaps_from_first_sale_to_last_week():
    sales = pd.DataFrame({
        "product_id": [1, 1, 1],
        "day": pd.to_datetime(["2026-09-08", "2026-09-10", "2026-09-29"]),
        "units": [2.0, 3.0, 4.0],
    })
    products = pd.DataFrame({"product_id": [1, 2], "category_id": [1, 1], "price": [5.0, 6.0], "is_active": [True, True]})

    panel = weekly_panel(sales, products, last_week=pd.Timestamp("2026-09-21"))

    assert list(panel["week"].dt.strftime("%m-%d")) == ["09-07", "09-14", "09-21"]
    assert list(panel["units"]) == [5.0, 0.0, 0.0]  # the 09-29 sale is after last_week
    assert set(panel["product_id"]) == {1}  # product 2 never sold
