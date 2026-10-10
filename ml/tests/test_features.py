import numpy as np
import pandas as pd
import pytest

from b2b_ml.forecast.features import FEATURES, HORIZON, baselines, build_frame


def test_target_is_units_of_the_next_four_weeks(panel):
    frame = build_frame(panel)
    one = frame[frame["product_id"] == 1].reset_index(drop=True)
    expected = one["units"].iloc[11:15].sum()
    assert one.loc[10, "target"] == pytest.approx(expected)
    assert one["target"].tail(HORIZON).isna().all()  # future not known yet


def test_features_never_use_the_future(panel):
    """Changing every week after t must not change any feature at t."""
    cutoff = panel["week"].min() + pd.Timedelta(weeks=80)
    changed = panel.copy()
    future = changed["week"] > cutoff
    changed.loc[future, "units"] = changed.loc[future, "units"] * 7 + 100

    before = build_frame(panel)
    after = build_frame(changed)
    at_or_before = before["week"] <= cutoff

    pd.testing.assert_frame_equal(
        before.loc[at_or_before, FEATURES].reset_index(drop=True),
        after.loc[at_or_before, FEATURES].reset_index(drop=True),
    )
    # ...while the target, which is the future, does change.
    assert not np.allclose(
        before.loc[before["week"] == cutoff, "target"], after.loc[after["week"] == cutoff, "target"]
    )


def test_baselines_have_no_gaps(panel):
    frame = build_frame(panel)
    assert not baselines(frame).isna().any().any()
