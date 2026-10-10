import math

import pytest

from b2b_ml import metrics


def test_wape_is_total_error_over_total_actual():
    assert metrics.wape([10, 0, 10], [8, 2, 10]) == pytest.approx(4 / 20)


def test_wape_is_undefined_without_sales():
    assert math.isnan(metrics.wape([0, 0], [1, 2]))


def test_bias_sign_shows_direction():
    assert metrics.bias([10, 10], [12, 12]) == pytest.approx(0.2)
    assert metrics.bias([10, 10], [5, 5]) == pytest.approx(-0.5)


def test_mae_and_rmse():
    assert metrics.mae([0, 0], [3, 4]) == pytest.approx(3.5)
    assert metrics.rmse([0, 0], [3, 4]) == pytest.approx(math.sqrt(12.5))


def test_coverage_counts_bounds_as_inside():
    assert metrics.coverage([1, 5, 9, 10], [1, 1, 1, 1], [9, 9, 9, 9]) == pytest.approx(0.75)
