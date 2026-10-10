"""Command line: python -m b2b_ml <job> [--dry-run]

    forecast   backtest + train the demand forecast, publish forecasts for the app
"""

import argparse
import json

JOBS = ("forecast",)


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m b2b_ml")
    parser.add_argument("job", choices=JOBS)
    parser.add_argument("--dry-run", action="store_true", help="train and evaluate without writing to the database")
    args = parser.parse_args()

    if args.job == "forecast":
        from .forecast.pipeline import run

        result = run(write=not args.dry_run)
        report(result)


def report(result: dict) -> None:
    backtest = result["details"]["backtest"]
    print(f"{result['name']} {result['version']}: {backtest['folds']} backtest folds, {backtest['rows']} product forecasts")
    print(f"{'method':<18}{'WAPE':>8}{'MAE':>8}{'RMSE':>8}{'bias':>8}")
    for method, values in backtest["methods"].items():
        print(f"{method:<18}{values['wape']:>8.1%}{values['mae']:>8.2f}{values['rmse']:>8.2f}{values['bias']:>8.1%}")
    print(f"vs best baseline ({backtest['best_baseline']}): {backtest['improvement_vs_baseline']:+.1%} lower RMSE")
    model = backtest["methods"]["model"]
    print(f"80% interval coverage: {model['interval_coverage']:.1%}, above upper bound: {model['above_upper']:.1%} (target 10%)")
    print(json.dumps({key: result["details"][key] for key in ("origin_week", "products_scored", "training_rows")}))


if __name__ == "__main__":
    main()
