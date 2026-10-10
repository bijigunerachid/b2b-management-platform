import numpy as np
import pandas as pd
import pytest

from b2b_ml.payment_risk.data import label, settle
from b2b_ml.payment_risk.features import FEATURES, build_frame
from b2b_ml.payment_risk.model import RiskModel
from b2b_ml.payment_risk.pipeline import backtest, open_invoices

START = pd.Timestamp("2025-01-06")


def make_book(customers: int = 40, invoices_each: int = 30, seed: int = 0):
    """Invoices every ~2 weeks per customer; each customer has a usual delay (some pay late)."""
    rng = np.random.default_rng(seed)
    invoices, payments = [], []
    order_id = 0
    for customer in range(1, customers + 1):
        usual = rng.choice([-10, -3, 15])  # early, on time, slow
        for k in range(invoices_each):
            order_id += 1
            created = START + pd.Timedelta(days=int(k * 14 + rng.integers(0, 5)))
            total_ht = float(rng.uniform(500, 20000))
            invoices.append({
                "order_id": order_id, "customer_id": customer, "created_at": created, "total_amount": total_ht,
                "credited": 0.0, "refunded": 0.0, "country": "Morocco", "price_list_id": None,
            })
            delay = usual + rng.normal(0, 6) + (6 if total_ht > 15000 else 0)
            paid_at = created + pd.Timedelta(days=30 + float(delay))
            payments.append({"order_id": order_id, "amount": round(total_ht * 1.2, 2), "paid_at": paid_at.normalize()})
    return pd.DataFrame(invoices), pd.DataFrame(payments)


def test_settlement_counts_credit_notes_and_partial_payments():
    invoices = pd.DataFrame([
        {"order_id": 1, "customer_id": 1, "created_at": START, "total_amount": 100.0, "credited": 20.0, "refunded": 0.0},
        {"order_id": 2, "customer_id": 1, "created_at": START, "total_amount": 100.0, "credited": 0.0, "refunded": 0.0},
    ])
    payments = pd.DataFrame([
        {"order_id": 1, "amount": 100.0, "paid_at": START + pd.Timedelta(days=10)},  # 120 - 20 credited = 100 owed
        {"order_id": 2, "amount": 60.0, "paid_at": START + pd.Timedelta(days=10)},
        {"order_id": 2, "amount": 60.0, "paid_at": START + pd.Timedelta(days=50)},
    ])
    settled = settle(invoices, payments).set_index("order_id")
    assert settled.loc[1, "settled_at"] == START + pd.Timedelta(days=10)
    assert settled.loc[2, "settled_at"] == START + pd.Timedelta(days=50)  # second installment completes it

    late = label(settled.reset_index(), as_of=START + pd.Timedelta(days=100))
    assert list(late) == [0.0, 1.0]  # due day 30, late after day 37
    assert label(settled.reset_index(), as_of=START + pd.Timedelta(days=20)).isna().all()  # not known yet


def test_features_only_use_what_was_known_when_the_invoice_was_issued():
    invoices, payments = make_book(customers=5, invoices_each=20)
    before = build_frame(settle(invoices, payments))

    # Rewrite history after a date: every payment after it becomes very late.
    cutoff = START + pd.Timedelta(days=150)
    changed = payments.copy()
    after = changed["paid_at"] > cutoff
    changed.loc[after, "paid_at"] = changed.loc[after, "paid_at"] + pd.Timedelta(days=200)
    after_frame = build_frame(settle(invoices, changed))

    earlier = before["created_at"] <= cutoff
    pd.testing.assert_frame_equal(
        before.loc[earlier, FEATURES].reset_index(drop=True),
        after_frame.loc[after_frame["created_at"] <= cutoff, FEATURES].reset_index(drop=True),
    )


def test_model_beats_the_customer_history_rule_on_synthetic_data():
    invoices, payments = make_book()
    frame = build_frame(settle(invoices, payments))
    result = backtest(frame, as_of=frame["created_at"].max() + pd.Timedelta(days=60), count=4)

    model, history, base = (result["methods"][name] for name in ("model", "customer_history", "base_rate"))
    assert result["folds"] == 4
    assert model["auc"] > 0.8
    assert model["auc"] > base["auc"] + 0.2
    assert model["brier"] < history["brier"]  # invoice size matters here, which the simple rule ignores


def test_reasons_name_the_inputs_that_raise_the_risk():
    invoices, payments = make_book()
    frame = build_frame(settle(invoices, payments))
    as_of = frame["created_at"].max() + pd.Timedelta(days=60)
    model = RiskModel().fit(frame.assign(late=label(frame, as_of)).dropna(subset=["late"]))

    probabilities = model.predict(frame)
    assert ((probabilities > 0) & (probabilities < 1)).all()
    riskiest = frame.iloc[[int(np.argmax(probabilities))]]
    assert "history" in model.reasons(riskiest)[0]


def test_only_unpaid_invoices_that_are_not_late_yet_get_scored():
    invoices, payments = make_book(customers=3, invoices_each=10)
    settled = settle(invoices, payments.iloc[:-5])  # the last few stay unpaid
    as_of = settled["created_at"].max() + pd.Timedelta(days=5)
    scored = open_invoices(settled, as_of)
    assert scored["settled_at"].isna().all()
    assert (scored["cutoff"] > as_of).all()
    assert len(scored) > 0
