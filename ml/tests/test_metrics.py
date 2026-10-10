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


def test_auc_and_capture_rate_reward_good_ranking():
    actual = [0, 0, 0, 1, 1]
    assert metrics.roc_auc(actual, [0.1, 0.2, 0.3, 0.8, 0.9]) == pytest.approx(1.0)
    assert metrics.roc_auc(actual, [0.9, 0.8, 0.3, 0.2, 0.1]) == pytest.approx(0.0)
    # The riskiest 40% (2 of 5) holds both late invoices.
    assert metrics.capture_rate(actual, [0.1, 0.2, 0.3, 0.8, 0.9], share=0.4) == pytest.approx(1.0)


def test_brier_and_log_loss_punish_confident_mistakes():
    assert metrics.brier([1, 0], [1.0, 0.0]) == pytest.approx(0.0)
    assert metrics.brier([1, 0], [0.5, 0.5]) == pytest.approx(0.25)
    assert metrics.log_loss([1], [0.01]) > metrics.log_loss([1], [0.4])


def test_calibration_groups_compare_predicted_and_observed():
    probability = [0.1] * 5 + [0.9] * 5
    actual = [0, 0, 0, 0, 1] + [1, 1, 1, 1, 0]
    groups = metrics.calibration(actual, probability, bins=2)
    assert [group["count"] for group in groups] == [5, 5]
    assert groups[0]["observed"] == pytest.approx(0.2)
    assert groups[1]["predicted"] == pytest.approx(0.9)
