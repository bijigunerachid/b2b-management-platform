import numpy as np
import pandas as pd

from b2b_ml.recommend.models import EASE, Interactions, Popularity, top_k
from b2b_ml.recommend.pipeline import Explainer, _fit_and_rank, evaluate

START = pd.Timestamp("2025-01-01")


def make_shop(customers: int = 200, seed: int = 0):
    """Two kinds of customers buying from their own half of the catalog, plus a few
    best sellers everyone buys. Products come in pairs: buying one leads to the other."""
    rng = np.random.default_rng(seed)
    products = pd.DataFrame({"product_id": range(1, 41), "name": [f"P{i}" for i in range(1, 41)],
                             "category_id": [1 if i <= 20 else 2 for i in range(1, 41)], "is_active": True})
    rows = []
    for customer in range(1, customers + 1):
        half = range(1, 21) if customer % 2 else range(21, 41)
        day = 0
        for _ in range(rng.integers(3, 8)):
            day += int(rng.integers(5, 40))
            first = int(rng.choice(list(half)))
            picks = {first, first + 1 if first % 2 else first - 1, int(rng.choice([1, 21]))}  # pair + a best seller
            rows += [{"customer_id": customer, "product_id": p, "created_at": START + pd.Timedelta(days=day)} for p in picks]
    return pd.DataFrame(rows), products


def test_top_k_never_recommends_what_the_customer_already_bought():
    scores = np.array([[5.0, 4.0, 3.0, 2.0]])
    bought = np.array([[True, False, True, False]])
    assert list(top_k(scores, bought, k=2)[0]) == [1, 3]


def test_ease_beats_popularity_when_products_go_together():
    purchases, products = make_shop()
    cutoff = START + pd.Timedelta(days=120)
    ease = evaluate(purchases, products, cutoff, window_days=200, k=5, method="ease", l2=10.0)
    popular = evaluate(purchases, products, cutoff, window_days=200, k=5, method="popularity")
    assert len(ease) > 20
    assert ease["recall"].mean() > popular["recall"].mean() + 0.1


def test_recommendations_only_use_purchases_before_the_cutoff():
    purchases, products = make_shop()
    cutoff = START + pd.Timedelta(days=120)
    history = purchases[purchases["created_at"] < cutoff]
    changed = pd.concat([history, purchases[purchases["created_at"] >= cutoff].assign(product_id=7)])

    def ranked(rows):
        return _fit_and_rank(rows[rows["created_at"] < cutoff], products, cutoff, method="ease", l2=10.0)[3]

    assert np.array_equal(ranked(purchases), ranked(changed))


def test_reasons_are_only_given_for_pairs_seen_often_enough():
    purchases = pd.DataFrame(
        [{"customer_id": c, "product_id": p, "created_at": START} for c in range(1, 6) for p in (1, 2)]
        + [{"customer_id": 6, "product_id": 1, "created_at": START}]
        + [{"customer_id": c, "product_id": 3, "created_at": START} for c in range(7, 21)]  # most customers buy neither
    )
    data = Interactions(purchases, list(range(1, 21)), [1, 2, 3])
    explain = Explainer(data)
    # Customer 6 bought product 1; 5 of its 6 buyers also bought product 2, which only 5 of 20 customers buy.
    reason = explain(5, 1)
    assert reason == {"type": "bought_with", "product_id": 1, "share": 0.833}
    assert explain(6, 0) == {"type": "popular_in_category"}  # product 3's buyers never bought product 1


def test_popularity_scores_every_customer_the_same():
    purchases, products = make_shop(customers=20)
    data = Interactions(purchases, sorted(purchases["customer_id"].unique()), products["product_id"])
    scores = Popularity().fit(data).score(data)
    assert (scores == scores[0]).all()
    assert EASE(10.0).fit(data).weights.diagonal().sum() == 0
