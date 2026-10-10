"""Features for "will this invoice be paid late?", as of the day it's issued.

Everything about the customer comes from their earlier invoices, using only
what was known on that day: an earlier invoice counts as late or on time only
once its own deadline had passed, and its payment date only if it was already
paid. The model never sees how the invoice it scores, or any invoice still
running, turned out.
"""

import numpy as np
import pandas as pd

RECENT = 3  # "recent behaviour" = the customer's last 3 invoices with a known outcome

FEATURES = [
    "known_invoices", "late_share", "recent_late_share",
    "mean_delay", "recent_delay", "max_delay",
    "open_invoices", "overdue_invoices", "overdue_amount", "max_days_overdue",
    "prior_invoices", "days_as_customer", "invoices_last_90_days",
    "log_amount", "amount_vs_usual",
    "month", "foreign", "has_price_list",
]
CATEGORICAL = ["month"]

DAY = np.timedelta64(1, "D")


def _customer_features(group: pd.DataFrame) -> pd.DataFrame:
    created = group["created_at"].to_numpy()
    due = group["due_date"].to_numpy()
    cutoff = group["cutoff"].to_numpy()
    settled = group["settled_at"].to_numpy()
    amount = group["invoice_total"].to_numpy()

    rows = []
    for i in range(len(group)):
        t = created[i]
        prior = slice(0, i)
        p_cutoff, p_settled, p_due, p_created, p_amount = cutoff[prior], settled[prior], due[prior], created[prior], amount[prior]
        settled_by_t = ~np.isnat(p_settled) & (p_settled <= t)

        # Outcomes known at t: deadline passed, so late = not settled by the deadline.
        known = p_cutoff <= t
        late = known & ~(settled_by_t & (p_settled <= p_cutoff))
        known_late = late[known]

        # Days after the due date that already-settled invoices were paid.
        delays = ((p_settled[settled_by_t] - p_due[settled_by_t]) / DAY).astype(float)

        open_ = ~settled_by_t
        overdue = open_ & (p_due < t)
        days_overdue = ((t - p_due[overdue]) / DAY).astype(float)

        rows.append({
            "known_invoices": int(known.sum()),
            "late_share": known_late.mean() if known_late.size else np.nan,
            "recent_late_share": known_late[-RECENT:].mean() if known_late.size else np.nan,
            "mean_delay": delays.mean() if delays.size else np.nan,
            "recent_delay": delays[-RECENT:].mean() if delays.size else np.nan,
            "max_delay": delays.max() if delays.size else np.nan,
            "open_invoices": int(open_.sum()),
            "overdue_invoices": int(overdue.sum()),
            "overdue_amount": float(p_amount[overdue].sum()),
            "max_days_overdue": days_overdue.max() if days_overdue.size else 0.0,
            "prior_invoices": i,
            "days_as_customer": float((t - p_created[0]) / DAY) if i else 0.0,
            "invoices_last_90_days": int((p_created >= t - 90 * DAY).sum()),
            "amount_vs_usual": amount[i] / p_amount.mean() if i else np.nan,
        })
    return pd.DataFrame(rows, index=group.index)


def build_frame(invoices: pd.DataFrame) -> pd.DataFrame:
    """One row per invoice with its features. `invoices` comes from data.settle()."""
    invoices = invoices.sort_values(["customer_id", "created_at", "order_id"])
    parts = [_customer_features(group) for _, group in invoices.groupby("customer_id", sort=False)]
    frame = invoices.join(pd.concat(parts))
    frame["log_amount"] = np.log1p(frame["invoice_total"])
    frame["month"] = frame["created_at"].dt.month
    frame["foreign"] = (frame["country"].fillna("Morocco") != "Morocco").astype(int)
    frame["has_price_list"] = frame["price_list_id"].notna().astype(int)
    return frame.sort_values(["created_at", "order_id"]).reset_index(drop=True)


def customer_history_baseline(frame: pd.DataFrame, base_rate: float, strength: float = 2.0) -> pd.Series:
    """The obvious rule a credit controller would use: how often this customer
    paid late before, pulled towards the overall rate when there's little history."""
    late = frame["late_share"].fillna(0) * frame["known_invoices"]
    return (late + strength * base_rate) / (frame["known_invoices"] + strength)
