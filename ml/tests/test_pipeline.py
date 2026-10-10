import pandas as pd

from b2b_ml.forecast.features import build_frame
from b2b_ml.forecast.model import DemandModel
from b2b_ml.forecast.pipeline import backtest, last_complete_week


def test_last_complete_week_is_the_monday_before_this_week():
    assert last_complete_week(pd.Timestamp("2026-10-10")) == pd.Timestamp("2026-09-28")  # a Saturday
    assert last_complete_week(pd.Timestamp("2026-10-05")) == pd.Timestamp("2026-09-28")  # a Monday


def test_model_learns_seasonality_better_than_moving_average(panel):
    result = backtest(build_frame(panel), folds=6)

    assert result["folds"] == 6
    model, average = result["methods"]["model"], result["methods"]["moving_average"]
    assert model["rmse"] < average["rmse"]
    assert abs(model["bias"]) < 0.15
    assert 0.0 <= model["above_upper"] <= 0.25


def test_predictions_are_ordered_and_non_negative(panel):
    frame = build_frame(panel)
    known = frame[frame["target"].notna()]
    predicted = DemandModel().fit(known).predict(frame.tail(50))
    assert (predicted["lower"] >= 0).all()
    assert (predicted["lower"] <= predicted["units"]).all()
    assert (predicted["units"] <= predicted["upper"]).all()


def test_publishes_the_simple_method_when_the_model_loses():
    from b2b_ml.forecast.pipeline import published_method

    evaluation = {"best_baseline": "moving_average", "methods": {"model": {"rmse": 10.0}, "moving_average": {"rmse": 12.0}}}
    assert published_method(evaluation) == "model"
    evaluation["methods"]["model"]["rmse"] = 12.5
    assert published_method(evaluation) == "moving_average"
