# ML jobs

Offline training jobs for the platform. Each job reads from the app's MySQL database, trains and tests a model, and writes the results back to tables the API reads:

- `ml_models`: one row per training run, with its test metrics (`metrics`) and the full backtest (`details`). Only the newest run per model name is active.
- an output table per model: `demand_forecasts` (units per product) and `payment_risk_scores` (probability per open invoice, with the facts behind it).

The API never runs Python. If a job has never run, the app shows an empty state, reorder suggestions use the manual reorder points, and Receivables shows no risk column.

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

## Late-payment risk

```bash
python -m b2b_ml risk --dry-run   # train, test and print the results; writes nothing
python -m b2b_ml risk             # same, then score the open invoices
```

Predicts whether an invoice will be paid more than 7 days after its due date (30-day terms). Settlement follows the app's billing rules: the invoice total with VAT, minus credit notes, with refunds counted against payments. Only open invoices that aren't late yet get a score, because for the others the answer is already known.

| File | What it does |
|---|---|
| `payment_risk/data.py` | Invoices, the date each one was fully paid, and the late/on-time label |
| `payment_risk/features.py` | The customer's history as of each invoice's issue date, and the "customer's past late rate" rule to beat |
| `payment_risk/model.py` | Logistic regression on six inputs with per-invoice reasons; gradient-boosted trees for comparison |
| `payment_risk/pipeline.py` | Monthly backtest, final training, scoring, saving |

### No leakage

Features describe what the business knew on the day the invoice was issued. An earlier invoice counts as late or on time only once its own deadline (due date + 7 days) had passed, and its payment date only if it was already paid. `tests/test_payment_risk.py` rewrites all payments after a date and checks that no feature of an earlier invoice changes. In the backtest, the training set for a month contains only invoices whose outcome was known on the first day of that month.

### Choosing the model

On the six test months, regularised logistic regression (C=0.1) beat gradient-boosted trees on the full feature set on Brier score, log loss and AUC, after I tuned both. With six inputs it can also give exact reasons: each input's contribution to the log-odds compared with an average invoice. Inputs adding more than 0.15 are listed as reasons. I dropped two inputs (recent late share, days overdue) that overlapped with others and got negative weights, which would have made the explanations contradict themselves. Removing them didn't change the score.

The main score is the Brier score, because the app shows probabilities and they should be honest. AUC (ranking) and calibration by quintile are reported too. "Caught in the riskiest 20%" is near its ceiling for every useful method, because 38% of invoices are late, so it doesn't separate them much.

## Tests

```bash
python -m pytest
```

They use synthetic data and don't need a database: settlement and labels, leakage checks for both models, metrics, and small backtests where the model has to beat the simple rule.
