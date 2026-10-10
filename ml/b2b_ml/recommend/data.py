"""Who bought what, and when."""

import pandas as pd

from ..db import read


def load_purchases(connection) -> pd.DataFrame:
    """One row per customer, product and order day. Cancelled orders don't count."""
    purchases = read(
        connection,
        """SELECT o.customer_id, oi.product_id, MIN(o.created_at) AS created_at
           FROM order_items oi
           INNER JOIN orders o ON o.id = oi.order_id
           WHERE o.status <> 'Cancelled'
           GROUP BY o.customer_id, oi.product_id, DATE(o.created_at)""",
    )
    if purchases.empty:
        return pd.DataFrame(columns=["customer_id", "product_id", "created_at"])
    purchases["created_at"] = pd.to_datetime(purchases["created_at"])
    return purchases.sort_values("created_at").reset_index(drop=True)


def load_products(connection) -> pd.DataFrame:
    products = read(connection, "SELECT id AS product_id, name, category_id, is_active FROM products")
    products["is_active"] = products["is_active"].astype(bool)
    return products
