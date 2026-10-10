import { useState } from "react";
import Button from "../components/ui/Button";
import { Badge, Card, CardHeader, EmptyState, ErrorState, PageHeader, StatCard, TableHead, Th } from "../components/ui/primitives";
import { formatDate, number, useResource } from "../lib/api";
import { dayDate, pct } from "../lib/ml";

import { t } from "../i18n";

const METHODS = {
  model: { label: "EASE + category popularity", description: "Learns which products are bought by the same customers, topped up with what's popular in their categories" },
  ease: { label: "EASE alone", description: "Only the products-bought-together part" },
  item_knn: { label: "Similar products", description: "Products whose buyers overlap with what the customer bought (cosine similarity)" },
  category_popularity: { label: "Popular in their categories", description: "Best sellers in the categories the customer already buys from" },
  popularity: { label: "Best sellers", description: "The same most popular products for everyone" },
};

const SERIES = [
  { key: "model", label: "Model", color: "var(--series-forecast)" },
  { key: "baseline", label: "Best simple rule", color: "var(--series-baseline)" },
];

/** Recall at 10 for each test period: the model against the best simple rule. */
function FoldChart({ folds, baseline }) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(0.5, ...folds.flatMap((fold) => [fold.model, fold[baseline]]));
  const ticks = [0, max / 2, max];

  return (
    <div className="px-5 pb-5 pt-4">
      <div className="mb-4 flex flex-wrap gap-4 text-xs app-text-secondary" aria-label={t("Legend")}>
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.color }} /> {t(series.label)}
          </span>
        ))}
      </div>
      <div className="relative h-48 ps-10">
        {ticks.map((tick) => (
          <div
            key={tick}
            className="absolute start-10 end-0 border-t"
            style={{ bottom: `${(tick / max) * 100}%`, borderColor: tick === 0 ? "var(--border-strong)" : "var(--chart-grid)", borderStyle: tick === 0 ? "solid" : "dashed" }}
          >
            <span className="absolute -start-10 w-8 -translate-y-1/2 pe-1 text-end text-[11px] tabular-nums app-text-muted">{Math.round(tick * 100)}%</span>
          </div>
        ))}
        <div className="relative flex h-full items-end gap-6 sm:gap-10">
          {folds.map((fold, index) => {
            const values = { model: fold.model, baseline: fold[baseline] };
            return (
              <div
                key={fold.cutoff}
                className="relative flex h-full flex-1 items-end justify-center gap-[2px]"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                tabIndex={0}
                aria-label={t("60 days from {date}: model {model}, simple rule {baseline}, {count} customers", {
                  date: dayDate(fold.cutoff),
                  model: pct(values.model),
                  baseline: pct(values.baseline),
                  count: number(fold.customers),
                })}
              >
                {SERIES.map((series) => (
                  <div key={series.key} className="flex h-full w-full max-w-10 flex-col justify-end">
                    {hovered === index && <span className="mb-1 text-center text-[11px] font-semibold tabular-nums app-text">{Math.round(values[series.key] * 100)}%</span>}
                    <div
                      className="w-full rounded-t-[4px]"
                      style={{ height: `${(values[series.key] / max) * 100}%`, backgroundColor: series.color, opacity: hovered === null || hovered === index ? 1 : 0.45 }}
                    />
                  </div>
                ))}
                <span className="absolute -bottom-6 whitespace-nowrap text-[11px] app-text-muted">{dayDate(fold.cutoff).replace(/,? \d{4}$/, "")}</span>
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
  const order = Object.keys(METHODS).filter((key) => methods[key]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-start text-sm">
        <TableHead>
          <Th>{t("Approach")}</Th>
          <Th align="right">{t("Found (recall@10)")}</Th>
          <Th align="right">{t("At least one hit")}</Th>
          <Th align="right">{t("NDCG@10")}</Th>
          <Th align="right">{t("Precision@10")}</Th>
        </TableHead>
        <tbody>
          {order.map((key) => {
            const values = methods[key];
            const isModel = key === "model";
            return (
              <tr key={key} className="border-t" style={{ borderColor: "var(--border-color)", backgroundColor: isModel ? "color-mix(in srgb, var(--primary) 6%, transparent)" : undefined }}>
                <td className="px-5 py-3">
                  <p className="flex items-center gap-2 font-medium app-text">
                    {t(METHODS[key].label)}
                    {key === best && <Badge tone="info">{t("simple rule to beat")}</Badge>}
                  </p>
                  <p className="text-xs app-text-muted">{t(METHODS[key].description)}</p>
                </td>
                <td className={`whitespace-nowrap px-5 py-3 text-end tabular-nums app-text ${isModel ? "font-bold" : ""}`}>{pct(values.recall)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums app-text">{pct(values.hit_rate)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums app-text-secondary">{values.ndcg.toFixed(3)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums app-text-secondary">{values.precision.toFixed(3)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecommendationModel({ model }) {
  const details = model.details ?? {};
  const backtest = details.backtest;
  const metrics = model.metrics;
  const best = backtest?.best_baseline ?? metrics.baseline;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("More found than the simple rule")}
          value={pct(metrics.improvement_vs_baseline, true)}
          hint={t("Recall {model} vs {baseline} ({rule})", { model: pct(metrics.recall), baseline: pct(metrics.baseline_recall), rule: t(METHODS[best]?.label ?? best).toLowerCase() })}
          icon="sparkles"
          tone={metrics.improvement_vs_baseline > 0 ? "success" : "warning"}
        />
        <StatCard label={t("Found (recall@10)")} value={pct(metrics.recall)} hint={t("Of the products customers bought for the first time, the share that was in their top 10")} icon="checkCircle" tone="primary" />
        <StatCard label={t("At least one hit")} value={pct(metrics.hit_rate)} hint={t("Customers who went on to buy one of their 10 suggestions")} icon="customers" tone="info" />
        <StatCard label={t("Customers with suggestions")} value={number(details.customers)} hint={t("Up to 10 products each")} icon="products" tone="warning" />
      </div>

      {backtest && (
        <>
          <Card>
            <CardHeader
              title={t("Model vs simple rules")}
              description={t("Purchases before a date were used to suggest 10 products per customer; the next {days} days show what they really bought. {folds} periods, {count} customer checks.", {
                days: backtest.window_days,
                folds: backtest.folds,
                count: number(backtest.rows),
              })}
            />
            <MethodTable methods={backtest.methods} best={best} />
            <div className="border-t px-5 py-3 text-xs app-text-muted" style={{ borderColor: "var(--border-color)" }}>
              {t("Only products new to each customer count: suggesting what they already reorder would be easy and useless. Precision looks low because most customers try only one or two new products in 60 days.")}
            </div>
          </Card>

          <Card>
            <CardHeader title={t("Each test period")} description={t("Share of new purchases that were in the top 10")} />
            <FoldChart folds={backtest.per_fold} baseline={best} />
          </Card>
        </>
      )}

      <Card>
        <CardHeader title={t("Training")} />
        <dl className="grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-2 xl:grid-cols-3">
          {[
            [t("Trained"), formatDate(model.trained_at, true)],
            [t("Version"), model.version],
            [t("Purchases used"), number(details.purchases)],
            [t("Customers"), number(details.customers)],
            [t("Products"), number(details.products)],
            [t("Suggestions published"), number(details.recommendations)],
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
            <Th align="right">{t("Found (recall@10)")}</Th>
            <Th align="right">{t("At least one hit")}</Th>
            <Th align="right">{t("vs simple rule")}</Th>
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
                <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums app-text">{pct(model.metrics?.recall)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums app-text-secondary">{pct(model.metrics?.hit_rate)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums app-text-secondary">{pct(model.metrics?.improvement_vs_baseline, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function Recommendations() {
  const { data, loading, error, reload } = useResource("/ml/models");
  const models = (data?.data ?? []).filter((model) => model.name === "recommendations");
  const active = models.find((model) => model.is_active);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Recommendations")}
        description={t("Suggests products each customer hasn't bought yet but is likely to need, from what similar customers buy. Shown in the customer drawer and on the client portal.")}
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
          <EmptyState icon="sparkles" title={t("No model trained yet")} description={t("Run the training job in the ml folder (python -m b2b_ml recommend). Results appear here.")} />
        </Card>
      ) : (
        <>
          <RecommendationModel model={active} />
          <Versions models={models} />
        </>
      )}
    </div>
  );
}
