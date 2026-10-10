import { useState } from "react";
import Button from "../components/ui/Button";
import { Badge, Card, CardHeader, EmptyState, ErrorState, PageHeader, StatCard, TableHead, Th } from "../components/ui/primitives";
import { formatDate, number, useResource } from "../lib/api";
import { dayDate as weekDate, niceMax, pct } from "../lib/ml";

import { t } from "../i18n";

const METHODS = {
  model: { label: "Gradient-boosted model", description: "Learns from recent sales, last year, category seasonality and price" },
  naive: { label: "Last 4 weeks again", description: "Assumes the next 4 weeks repeat the last 4" },
  moving_average: { label: "13-week average", description: "Average weekly sales over the last quarter" },
  seasonal_naive: { label: "Same weeks last year", description: "What sold in these weeks a year ago" },
  seasonal_average: { label: "Yearly average × season", description: "The product's yearly average, scaled by its category's season" },
};

const SERIES = [
  { key: "actual", label: "Actual sales", color: "var(--series-actual)" },
  { key: "forecast", label: "Model", color: "var(--series-forecast)" },
  { key: "baseline", label: "Best simple method", color: "var(--series-baseline)" },
];

/** Total units per test period: what sold, what the model said, what the best simple method said. */
function BacktestChart({ periods }) {
  const [hovered, setHovered] = useState(null);
  const max = niceMax(Math.max(...periods.flatMap((period) => SERIES.map((series) => period[series.key]))));
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max];

  return (
    <div className="px-5 pb-5 pt-4">
      <div className="mb-4 flex flex-wrap gap-4 text-xs app-text-secondary" aria-label={t("Legend")}>
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.color }} /> {t(series.label)}
          </span>
        ))}
      </div>
      <div className="relative h-56 ps-12">
        {ticks.map((tick) => (
          <div
            key={tick}
            className="absolute start-12 end-0 border-t"
            style={{ bottom: `${(tick / max) * 100}%`, borderColor: tick === 0 ? "var(--border-strong)" : "var(--chart-grid)", borderStyle: tick === 0 ? "solid" : "dashed" }}
          >
            <span className="absolute -start-12 w-10 -translate-y-1/2 pe-2 text-end text-[11px] tabular-nums app-text-muted">{number(tick)}</span>
          </div>
        ))}
        <div className="relative flex h-full items-end gap-3 sm:gap-6">
          {periods.map((period, index) => {
            const top = Math.max(...SERIES.map((series) => period[series.key])) / max;
            return (
            <div
              key={period.origin}
              className="relative flex h-full flex-1 items-end justify-center gap-[2px]"
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              tabIndex={0}
              aria-label={t("4 weeks after {date}: {actual} sold, model {forecast}, simple method {baseline}", {
                date: weekDate(period.origin),
                actual: number(Math.round(period.actual)),
                forecast: number(Math.round(period.forecast)),
                baseline: number(Math.round(period.baseline)),
              })}
            >
              {hovered === index && <div className="absolute inset-0 rounded-lg" style={{ backgroundColor: "var(--surface-hover)", opacity: 0.6 }} />}
              {SERIES.map((series) => (
                <div
                  key={series.key}
                  className="relative w-full max-w-6 rounded-t-[4px]"
                  style={{ height: `${(period[series.key] / max) * 100}%`, backgroundColor: series.color, opacity: hovered === null || hovered === index ? 1 : 0.45 }}
                />
              ))}
              {hovered === index && (
                <div
                  className="pointer-events-none absolute z-10 w-max min-w-44 rounded-lg border px-3 py-2 text-xs animate-fade-in"
                  style={{
                    bottom: `calc(${Math.min(top, 0.55) * 100}% + 10px)`,
                    ...(index > periods.length / 2 ? { insetInlineEnd: 0 } : { insetInlineStart: 0 }),
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--border-color)",
                    boxShadow: "var(--pop-shadow)",
                  }}
                >
                  <p className="mb-1 font-semibold app-text">{t("4 weeks after {date}", { date: weekDate(period.origin) })}</p>
                  {SERIES.map((series) => (
                    <p key={series.key} className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 app-text-secondary">
                        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: series.color }} />
                        {t(series.label)}
                      </span>
                      <span className="font-semibold tabular-nums app-text">{number(Math.round(period[series.key]))}</span>
                    </p>
                  ))}
                </div>
              )}
              <span className="absolute -bottom-6 whitespace-nowrap text-[11px] app-text-muted">{formatDate(`${period.origin}T12:00:00`).replace(/,? \d{4}$/, "")}</span>
            </div>
            );
          })}
        </div>
      </div>
      <div className="h-6" />
    </div>
  );
}

function MethodTable({ methods, best }) {
  const order = ["model", ...Object.keys(METHODS).filter((key) => key !== "model" && methods[key])];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-start text-sm">
        <TableHead>
          <Th>{t("Forecasting method")}</Th>
          <Th align="right">{t("WAPE")}</Th>
          <Th align="right">{t("RMSE")}</Th>
          <Th align="right">{t("Bias")}</Th>
        </TableHead>
        <tbody>
          {order.map((key) => {
            const values = methods[key];
            const isModel = key === "model";
            return (
              <tr
                key={key}
                className="border-t"
                style={{ borderColor: "var(--border-color)", backgroundColor: isModel ? "color-mix(in srgb, var(--primary) 6%, transparent)" : undefined }}
              >
                <td className="px-5 py-3">
                  <p className="flex items-center gap-2 font-medium app-text">
                    {t(METHODS[key]?.label ?? key)}
                    {key === best && <Badge tone="info">{t("best simple method")}</Badge>}
                  </p>
                  <p className="text-xs app-text-muted">{t(METHODS[key]?.description ?? "")}</p>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums app-text">{pct(values.wape)}</td>
                <td className={`whitespace-nowrap px-5 py-3 text-end tabular-nums app-text ${isModel ? "font-bold" : ""}`}>{values.rmse.toFixed(2)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums app-text-secondary">{pct(values.bias, true)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DemandModel({ model }) {
  const details = model.details ?? {};
  const backtest = details.backtest;
  const metrics = model.metrics;
  const best = backtest?.best_baseline ?? metrics.baseline;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("Error vs best simple method")}
          value={pct(-metrics.improvement_vs_baseline, true)}
          hint={t("RMSE {model} vs {baseline} ({method})", { model: metrics.rmse.toFixed(2), baseline: metrics.baseline_rmse.toFixed(2), method: t(METHODS[best]?.label ?? best).toLowerCase() })}
          icon="sparkles"
          tone={metrics.improvement_vs_baseline > 0 ? "success" : "warning"}
        />
        <StatCard label={t("WAPE")} value={pct(metrics.wape)} hint={t("Simple method: {value}", { value: pct(metrics.baseline_wape) })} icon="revenue" tone="primary" />
        <StatCard
          label={t("Bias")}
          value={pct(metrics.bias, true)}
          hint={metrics.bias < 0 ? t("Forecasts run slightly low") : t("Forecasts run slightly high")}
          icon="alert"
          tone="info"
        />
        <StatCard
          label={t("Sales above the upper bound")}
          value={pct(metrics.above_upper)}
          hint={t("Target 10%. Safety stock is sized from this bound.")}
          icon="box"
          tone={Math.abs(metrics.above_upper - 0.1) <= 0.03 ? "success" : "warning"}
        />
      </div>

      {backtest && (
        <>
          <Card>
            <CardHeader
              title={t("Model vs simple methods")}
              description={t("Tested on {periods} four-week periods it never saw: {count} product forecasts. Lower is better.", { periods: backtest.folds, count: number(backtest.rows) })}
            />
            <MethodTable methods={backtest.methods} best={best} />
            <div className="border-t px-5 py-3 text-xs app-text-muted" style={{ borderColor: "var(--border-color)" }}>
              {t("RMSE is the main score: the model predicts expected sales, which is what reordering needs. WAPE favours forecasts that run low on lumpy demand, so it's shown alongside, with bias.")}
            </div>
          </Card>

          <Card>
            <CardHeader title={t("Backtest, all products")} description={t("Each period, the model was retrained on earlier data only, then compared with what actually sold")} />
            <BacktestChart periods={backtest.per_origin} />
          </Card>
        </>
      )}

      <Card>
        <CardHeader title={t("Training")} />
        <dl className="grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-2 xl:grid-cols-3">
          {[
            [t("Trained"), formatDate(model.trained_at, true)],
            [t("Version"), model.version],
            [t("Sales history from"), details.data_from ? weekDate(details.data_from) : "—"],
            [t("Forecast from"), details.origin_week ? weekDate(details.origin_week) : "—"],
            [t("Training examples"), number(details.training_rows)],
            [t("Products forecast"), number(details.products_scored)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs app-text-muted">{label}</dt>
              <dd className="font-medium tabular-nums app-text">{value}</dd>
            </div>
          ))}
          <div className="sm:col-span-2 xl:col-span-3">
            <dt className="text-xs app-text-muted">{t("Algorithm")}</dt>
            <dd className="font-medium app-text" dir="ltr">
              {details.algorithm ?? "—"}
            </dd>
          </div>
          {details.features && (
            <div className="sm:col-span-2 xl:col-span-3">
              <dt className="mb-1.5 text-xs app-text-muted">{t("Inputs")}</dt>
              <dd className="flex flex-wrap gap-1.5" dir="ltr">
                {details.features.map((feature) => (
                  <code key={feature} className="rounded-md px-1.5 py-0.5 text-[11px] app-text-secondary" style={{ backgroundColor: "var(--surface-muted)" }}>
                    {feature}
                  </code>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </Card>
    </div>
  );
}

function Versions({ models }) {
  return (
    <Card>
      <CardHeader title={t("Versions")} description={t("Every training run is kept with its test results")} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-start text-sm">
          <TableHead>
            <Th>{t("Version")}</Th>
            <Th>{t("Trained")}</Th>
            <Th align="right">{t("RMSE")}</Th>
            <Th align="right">{t("WAPE")}</Th>
            <Th align="right">{t("vs simple method")}</Th>
          </TableHead>
          <tbody>
            {models.map((model) => (
              <tr key={model.id} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                <td className="px-5 py-3">
                  <span className="font-medium tabular-nums app-text">{model.version}</span>
                  {model.is_active && (
                    <Badge tone="success" dot className="ms-2">
                      {t("In use")}
                    </Badge>
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-3 app-text-secondary">{formatDate(model.trained_at, true)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums app-text">{model.metrics?.rmse?.toFixed(2) ?? "—"}</td>
                <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums app-text-secondary">{pct(model.metrics?.wape)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums app-text-secondary">{pct(-(model.metrics?.improvement_vs_baseline ?? NaN), true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function Forecast() {
  const { data, loading, error, reload } = useResource("/ml/models");
  const models = (data?.data ?? []).filter((model) => model.name === "demand_forecast");
  const active = models.find((model) => model.is_active);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Demand forecast")}
        description={t("Predicts how many units of each product will sell in the next 4 weeks. Trained on order history, tested on weeks it never saw, and used for reorder suggestions.")}
        actions={<Button size="icon" variant="ghost" icon="refresh" onClick={reload} aria-label={t("Refresh")} title={t("Refresh")} className={loading ? "[&_svg]:animate-spin" : ""} />}
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      {!data ? (
        !error && (
          <div className="space-y-6" aria-busy="true">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="skeleton h-32 rounded-2xl" />
              ))}
            </div>
            <div className="skeleton h-80 rounded-2xl" />
          </div>
        )
      ) : !active ? (
        <Card>
          <EmptyState icon="sparkles" title={t("No model trained yet")} description={t("Run the training job in the ml folder (python -m b2b_ml forecast). Results appear here.")} />
        </Card>
      ) : (
        <>
          <DemandModel model={active} />
          <Versions models={models} />
        </>
      )}
    </div>
  );
}
