"""Invoices, when each one was settled, and whether that was late.

Uses the same rules as backend/src/billing/billing.js: an invoice is the
order total plus 20% VAT, due 30 days after the order, minus credit notes;
refunds count against what was paid.
"""

import numpy as np
import pandas as pd

from ..db import read

VAT_RATE = 0.2
PAYMENT_TERMS_DAYS = 30
GRACE_DAYS = 7  # a few days late isn't worth chasing; "late" means later than this
EPSILON = 0.005


def load_invoices(connection) -> pd.DataFrame:
    invoices = read(
        connection,
        """SELECT o.id AS order_id, o.customer_id, o.created_at, o.total_amount,
                  COALESCE(cn.credited, 0) AS credited, COALESCE(cn.refunded, 0) AS refunded,
                  c.country, c.price_list_id
           FROM orders o
           INNER JOIN customers c ON c.id = o.customer_id
           LEFT JOIN (
               SELECT order_id, SUM(total) AS credited, SUM(refund_amount) AS refunded
               FROM credit_notes GROUP BY order_id
           ) cn ON cn.order_id = o.id
           WHERE o.status <> 'Cancelled'""",
    )
    for column in ("total_amount", "credited", "refunded"):
        invoices[column] = invoices[column].astype(float)
    invoices["created_at"] = pd.to_datetime(invoices["created_at"])
    return invoices


def load_payments(connection) -> pd.DataFrame:
    payments = read(
        connection,
        "SELECT order_id, amount, paid_at FROM payments WHERE voided_at IS NULL ORDER BY paid_at, id",
    )
    if payments.empty:
        return pd.DataFrame(columns=["order_id", "amount", "paid_at"])
    payments["amount"] = payments["amount"].astype(float)
    payments["paid_at"] = pd.to_datetime(payments["paid_at"])
    return payments


def settle(invoices: pd.DataFrame, payments: pd.DataFrame) -> pd.DataFrame:
    """Adds invoice_total, due_date, cutoff (due + grace) and settled_at (NaT if still open)."""
    invoices = invoices.copy()
    invoices["invoice_total"] = (invoices["total_amount"] * (1 + VAT_RATE)).round(2)
    owed = invoices["invoice_total"] - invoices["credited"] + invoices["refunded"]
    invoices["day"] = invoices["created_at"].dt.normalize()
    invoices["due_date"] = invoices["day"] + pd.Timedelta(days=PAYMENT_TERMS_DAYS)
    invoices["cutoff"] = invoices["due_date"] + pd.Timedelta(days=GRACE_DAYS)

    payments = payments.sort_values("paid_at").copy()
    payments["paid_so_far"] = payments.groupby("order_id")["amount"].cumsum()
    payments = payments.merge(pd.DataFrame({"order_id": invoices["order_id"], "owed": owed}), on="order_id")
    # First payment date at which the invoice was covered.
    covered = payments[payments["paid_so_far"] >= payments["owed"] - EPSILON]
    settled_at = covered.groupby("order_id")["paid_at"].min()

    invoices["settled_at"] = invoices["order_id"].map(settled_at)
    # Fully credited invoices are settled when they were issued (nothing to pay).
    nothing_owed = owed <= EPSILON
    invoices.loc[nothing_owed & invoices["settled_at"].isna(), "settled_at"] = invoices["day"]
    return invoices.sort_values(["created_at", "order_id"]).reset_index(drop=True)


def label(invoices: pd.DataFrame, as_of: pd.Timestamp) -> pd.Series:
    """1 if settled after the cutoff (or still open past it), 0 if settled in time,
    NaN if the cutoff hasn't passed by `as_of` (outcome not known yet)."""
    late = (invoices["settled_at"].isna() | (invoices["settled_at"] > invoices["cutoff"])).astype(float)
    known = invoices["cutoff"] <= as_of
    return late.where(known, np.nan)
