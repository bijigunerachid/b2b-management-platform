"""Loads sales from MySQL and turns them into one row per product per week."""

import pandas as pd

from ..db import read


def load_sales(connection) -> pd.DataFrame:
    """Units ordered per product per day. Cancelled orders aren't demand."""
    sales = read(
        connection,
        """SELECT oi.product_id, DATE(o.created_at) AS day, SUM(oi.quantity) AS units
           FROM order_items oi
           INNER JOIN orders o ON o.id = oi.order_id
           WHERE o.status <> 'Cancelled'
           GROUP BY oi.product_id, DATE(o.created_at)""",
    )
    if sales.empty:
        return pd.DataFrame(columns=["product_id", "day", "units"])
    sales["day"] = pd.to_datetime(sales["day"])
    sales["units"] = sales["units"].astype(float)
    return sales


def load_products(connection) -> pd.DataFrame:
    products = read(connection, "SELECT id AS product_id, category_id, price, is_active FROM products")
    products["price"] = products["price"].astype(float)
    products["is_active"] = products["is_active"].astype(bool)
    return products


def week_start(dates: pd.Series) -> pd.Series:
    """Monday of the week each date falls in."""
    dates = pd.to_datetime(dates).dt.normalize()
    return dates - pd.to_timedelta(dates.dt.weekday, unit="D")


def weekly_panel(sales: pd.DataFrame, products: pd.DataFrame, last_week: pd.Timestamp) -> pd.DataFrame:
    """Every product's weekly units from its first sale up to `last_week` (inclusive), zeros filled in.

    `last_week` should be the last *complete* week so the newest row isn't a partial week.
    """
    sales = sales.assign(week=week_start(sales["day"]))
    sales = sales[sales["week"] <= last_week]
    weekly = sales.groupby(["product_id", "week"], as_index=False)["units"].sum()

    first = weekly.groupby("product_id")["week"].min()
    frames = []
    for product_id, start in first.items():
        weeks = pd.date_range(start, last_week, freq="7D")
        frames.append(pd.DataFrame({"product_id": product_id, "week": weeks}))
    if not frames:
        return pd.DataFrame(columns=["product_id", "week", "units", "category_id", "price", "is_active"])

    grid = pd.concat(frames, ignore_index=True)
    panel = grid.merge(weekly, on=["product_id", "week"], how="left").fillna({"units": 0.0})
    panel = panel.merge(products, on="product_id", how="inner")
    return panel.sort_values(["product_id", "week"]).reset_index(drop=True)
