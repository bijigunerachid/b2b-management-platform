# ML jobs

Offline training jobs for the platform. Each job reads from the app's MySQL database, trains and tests a model, and writes the results back to two tables the API reads:

- `ml_models`: one row per training run, with its test metrics (`metrics`) and the full backtest (`details`). Only the newest run per model name is active.
- `demand_forecasts`: the active model's prediction for each product.

The API never runs Python. If a job has never run, the app shows an empty state and reorder suggestions use the manual reorder points.

## Setup

Python 3.11 or newer.

```bash
python -m venv .venv
.venv/Scripts/activate      # Windows; on macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Database settings come from `backend/.env`. Environment variables take precedence, so `DB_NAME=b2b_ml python -m b2b_ml forecast` points one run at another database.

## Demand forecast

```bash
python -m b2b_ml forecast --dry-run   # train, test and print the results; writes nothing
python -m b2b_ml forecast             # same, then publish the forecasts
```

It predicts units sold per product over the next 4 weeks, starting from the last complete week (Monday to Sunday, UTC). Cancelled orders don't count as demand.

| File | What it does |
|---|---|
| `forecast/data.py` | Daily sales from MySQL turned into one row per product per week, with zero weeks filled in |
| `forecast/features.py` | Inputs for each product and week, the target (units in the next 4 weeks), and the simple baseline methods |
| `forecast/model.py` | Expected units (Poisson loss) plus 10% and 90% quantile models |
| `forecast/pipeline.py` | Backtest, final training, scoring, saving to the database |
| `metrics.py` | WAPE, MAE, RMSE, bias, interval coverage |

### How it's tested

Rolling-origin backtest: for each of the last six 4-week periods, the model is trained only on rows whose 4-week target ended before the period started, then compared with what actually sold. The same rows are scored by four simple methods (last 4 weeks again, 13-week average, same weeks last year, yearly average × category season), and the model is compared with the best of them.

The main score is RMSE. The model predicts the expected number of units, and squared error is the score that expected-value forecasts are built to minimise. WAPE is also reported. On intermittent demand it favours forecasts that run below the mean, so on its own it would pick a method that under-orders. Bias is shown so that tradeoff stays visible.

For the interval, the number to watch is the share of actual sales above the upper bound (target 10%), because safety stock is sized from it. Overall coverage runs above 80%: for most products the lower bound is 0, and sales can't fall below 0.

`tests/test_features.py` checks for leakage: changing every week after a date must not change any input at or before that date.

### Tuning

The hyperparameters in `model.py` were chosen from a small grid on the same backtest periods (learning rate, leaf size, number of leaves). That selection leaks a little information from the test periods into the model choice, so treat the reported margin over the baselines as slightly optimistic. Heavier regularisation (at least 200 samples per leaf) helped consistently, as you'd expect when over half the 4-week windows have no sales.

## Tests

```bash
python -m pytest
```

They use synthetic data and don't need a database.
