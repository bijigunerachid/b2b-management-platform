"""Command line: python -m b2b_ml <job> [--dry-run]

    forecast   backtest + train the demand forecast, publish forecasts for the app
    risk       backtest + train the late-payment model, score open invoices
    recommend  backtest + train product recommendations, publish them per customer
"""

import argparse
import json

JOBS = ("forecast", "risk", "recommend")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m b2b_ml")
    parser.add_argument("job", choices=JOBS)
    parser.add_argument("--dry-run", action="store_true", help="train and evaluate without writing to the database")
    args = parser.parse_args()

    if args.job == "forecast":
        from .forecast.pipeline import run

        report_forecast(run(write=not args.dry_run))
    elif args.job == "risk":
        from .payment_risk.pipeline import run

        report_risk(run(write=not args.dry_run))
    elif args.job == "recommend":
        from .recommend.pipeline import run

        report_recommend(run(write=not args.dry_run))


def report_forecast(result: dict) -> None:
    backtest = result["details"]["backtest"]
    print(f"{result['name']} {result['version']}: {backtest['folds']} backtest folds, {backtest['rows']} product forecasts")
    print(f"{'method':<18}{'WAPE':>8}{'MAE':>8}{'RMSE':>8}{'bias':>8}")
    for method, values in backtest["methods"].items():
        print(f"{method:<18}{values['wape']:>8.1%}{values['mae']:>8.2f}{values['rmse']:>8.2f}{values['bias']:>8.1%}")
    print(f"vs best baseline ({backtest['best_baseline']}): {backtest['improvement_vs_baseline']:+.1%} lower RMSE")
    model = backtest["methods"]["model"]
    print(f"80% interval coverage: {model['interval_coverage']:.1%}, above upper bound: {model['above_upper']:.1%} (target 10%)")
    print(json.dumps({key: result["details"][key] for key in ("origin_week", "products_scored", "training_rows")}))


def report_risk(result: dict) -> None:
    backtest = result["details"]["backtest"]
    print(f"{result['name']} {result['version']}: {backtest['folds']} test months, {backtest['rows']} invoices, {backtest['late_rate']:.1%} paid late")
    print(f"{'method':<18}{'AUC':>7}{'AP':>7}{'Brier':>8}{'logloss':>9}{'top 20%':>9}")
    for method, values in backtest["methods"].items():
        print(f"{method:<18}{values['auc']:>7.3f}{values['average_precision']:>7.3f}{values['brier']:>8.4f}"
              f"{values['log_loss']:>9.4f}{values['capture_20']:>9.1%}")
    print(f"vs {backtest['best_baseline']}: {backtest['improvement_vs_baseline']:+.1%} lower Brier score")
    print("calibration (predicted -> observed):", ", ".join(f"{b['predicted']:.2f}->{b['observed']:.2f}" for b in backtest["calibration"]))
    print(json.dumps({key: result["details"][key] for key in ("as_of", "invoices_scored", "training_rows")}))


def report_recommend(result: dict) -> None:
    backtest = result["details"]["backtest"]
    print(f"{result['name']} {result['version']}: {backtest['folds']} folds, {backtest['rows']} customer windows, top {backtest['k']}")
    print(f"{'method':<22}{'recall':>8}{'NDCG':>8}{'hit rate':>10}{'precision':>11}")
    for method, values in backtest["methods"].items():
        print(f"{method:<22}{values['recall']:>8.3f}{values['ndcg']:>8.3f}{values['hit_rate']:>10.1%}{values['precision']:>11.3f}")
    print(f"vs {backtest['best_baseline']}: {backtest['improvement_vs_baseline']:+.1%} recall")
    print(json.dumps({key: result["details"][key] for key in ("as_of", "customers", "recommendations")}))


if __name__ == "__main__":
    main()
