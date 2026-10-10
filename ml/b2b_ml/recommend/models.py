"""Recommenders that score every product for every customer.

All of them work on the customer × product matrix of past purchases. Products
a customer already buys are never recommended: "buy again" is a different
question, and an easy one.
"""

import numpy as np
import pandas as pd


class Interactions:
    """Customer × product matrix from purchase rows (1 = bought at least once)."""

    def __init__(self, purchases: pd.DataFrame, customer_ids, product_ids, weighting: str = "binary"):
        self.customer_ids = np.asarray(customer_ids)
        self.product_ids = np.asarray(product_ids)
        self.customer_index = {customer: i for i, customer in enumerate(self.customer_ids)}
        self.product_index = {product: j for j, product in enumerate(self.product_ids)}

        counts = np.zeros((len(self.customer_ids), len(self.product_ids)))
        rows = purchases["customer_id"].map(self.customer_index)
        cols = purchases["product_id"].map(self.product_index)
        keep = rows.notna() & cols.notna()
        np.add.at(counts, (rows[keep].astype(int).to_numpy(), cols[keep].astype(int).to_numpy()), 1)
        self.bought = counts > 0
        self.X = np.log1p(counts) if weighting == "log" else self.bought.astype(float)


class Popularity:
    """Bought by the most customers recently. The rule to beat."""

    name = "popularity"

    def fit(self, data: Interactions, recent: Interactions | None = None, **_):
        source = recent if recent is not None else data
        self.popularity = source.bought.sum(axis=0).astype(float)
        return self

    def score(self, data: Interactions) -> np.ndarray:
        return np.tile(self.popularity, (data.X.shape[0], 1))


class CategoryPopularity(Popularity):
    """Popular products in the categories this customer already buys from."""

    name = "category_popularity"

    def fit(self, data: Interactions, recent: Interactions | None = None, categories=None, prior: float = 0.02):
        super().fit(data, recent)
        self.categories = np.asarray(categories)
        self.prior = prior
        return self

    def score(self, data: Interactions) -> np.ndarray:
        unique = np.unique(self.categories)
        one_hot = (self.categories[:, None] == unique[None, :]).astype(float)  # products × categories
        per_category = data.bought.astype(float) @ one_hot
        share = per_category / np.maximum(per_category.sum(axis=1, keepdims=True), 1)
        return (share @ one_hot.T + self.prior) * self.popularity


class ItemKNN:
    """Products similar to what the customer bought, by cosine similarity of their buyers."""

    name = "item_knn"

    def fit(self, data: Interactions, **_):
        X = data.X
        norms = np.sqrt((X**2).sum(axis=0))
        similarity = (X.T @ X) / np.maximum(np.outer(norms, norms), 1e-9)
        np.fill_diagonal(similarity, 0)
        self.weights = similarity
        return self

    def score(self, data: Interactions) -> np.ndarray:
        return data.X @ self.weights


class EASE:
    """Embarrassingly Shallow Autoencoder (Steck, 2019): a closed-form linear model
    that learns how much buying product j says about buying product i. One
    regularisation parameter; fast for a catalog of a few thousand products."""

    name = "ease"

    def __init__(self, l2: float = 50.0):
        self.l2 = l2

    def fit(self, data: Interactions, **_):
        gram = data.X.T @ data.X
        gram[np.diag_indices_from(gram)] += self.l2
        inverse = np.linalg.inv(gram)
        weights = -inverse / np.diag(inverse)
        np.fill_diagonal(weights, 0)
        self.weights = weights
        return self

    def score(self, data: Interactions) -> np.ndarray:
        return data.X @ self.weights


def top_k(scores: np.ndarray, exclude: np.ndarray, k: int, allowed: np.ndarray | None = None) -> np.ndarray:
    """Indexes of the k best products per customer, skipping excluded ones."""
    scores = scores.astype(float).copy()
    scores[exclude] = -np.inf
    if allowed is not None:
        scores[:, ~allowed] = -np.inf
    best = np.argpartition(-scores, kth=min(k, scores.shape[1] - 1), axis=1)[:, :k]
    order = np.take_along_axis(scores, best, axis=1).argsort(axis=1)[:, ::-1]
    return np.take_along_axis(best, order, axis=1)


class Blend:
    """EASE plus a share of category popularity, both scaled per customer to [0, 1]."""

    name = "blend"

    def __init__(self, l2: float = 200.0, weight: float = 0.3):
        self.ease, self.popular, self.weight = EASE(l2), CategoryPopularity(), weight

    def fit(self, data, recent=None, categories=None, **_):
        self.ease.fit(data)
        self.popular.fit(data, recent=recent, categories=categories)
        return self

    def score(self, data):
        def scaled(scores):
            low, high = scores.min(axis=1, keepdims=True), scores.max(axis=1, keepdims=True)
            return (scores - low) / np.maximum(high - low, 1e-12)

        return scaled(self.ease.score(data)) + self.weight * scaled(self.popular.score(data))
