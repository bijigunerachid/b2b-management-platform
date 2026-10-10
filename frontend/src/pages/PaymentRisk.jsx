import { useState } from "react";
import Button from "../components/ui/Button";
import { Badge, Card, CardHeader, EmptyState, ErrorState, PageHeader, StatCard, TableHead, Th } from "../components/ui/primitives";
import { formatDate, number, useResource } from "../lib/api";
import { dayDate, pct } from "../lib/ml";

import { t } from "../i18n";

const METHODS = {
  model: { label: "Logistic regression", description: "Six inputs: payment history, recent delays, overdue invoices, invoice size, month, new customer" },
  trees: { label: "Gradient-boosted trees", description: "Every feature, more flexible: tried, and slightly worse on these tests" },
  customer_history: { label: "Customer's late rate", description: "How often this customer paid late before" },
  base_rate: { label: "Overall late rate", description: "The same probability for every invoice" },
};

const INPUTS = {
  history: "Past late payments",
  recent_delay: "Recent payment delays",
  overdue_invoices: "Invoices already overdue",
  log_amount: "Invoice size",
  busy_month: "August or December",
  new_customer: "New customer",
};

const SERIES = [
  { key: "predicted", label: "Predicted", color: "var(--series-forecast)" },
  { key: "observed", label: "Actually late", color: "var(--series-actual)" },
];

/** Invoices split into five equal groups by predicted risk: predicted vs actual late rate. */
function CalibrationChart({ bins }) {
  const [hovered, setHovered] = useState(null);

  return (
    <div className="px-5 pb-5 pt-4">
      <div className="mb-4 flex flex-wrap gap-4 text-xs app-text-secondary" aria-label={t("Legend")}>
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: series.color }} /> {t(series.label)}
          </span>
        ))}
      </div>
      <div className="relative h-52 ps-10">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <div
            key={tick}
            className="absolute start-10 end-0 border-t"
            style={{ bottom: `${tick * 100}%`, borderColor: tick === 0 ? "var(--border-strong)" : "var(--chart-grid)", borderStyle: tick === 0 ? "solid" : "dashed" }}
          >
            <span className="absolute -start-10 w-8 -translate-y-1/2 pe-1 text-end text-[11px] tabular-nums app-text-muted">{tick * 100}%</span>
          </div>
        ))}
        <div className="relative flex h-full items-end gap-4 sm:gap-8">
          {bins.map((bin, index) => (
            <div
              key={index}
              className="relative flex h-full flex-1 items-end justify-center gap-[2px]"
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              tabIndex={0}
              aria-label={t("Risk group {group}: predicted {predicted}, actually late {observed}, {count} invoices", {
                group: index + 1,
                predicted: pct(bin.predicted),
                observed: pct(bin.observed),
                count: number(bin.count),
              })}
            >
              {SERIES.map((series) => (
                <div key={series.key} className="relative flex h-full w-full max-w-10 flex-col justify-end">
                  {hovered === index && (
                    <span className="mb-1 text-center text-[11px] font-semibold tabular-nums app-text">{Math.round(bin[series.key] * 100)}%</span>
                  )}
                  <div
                    className="w-full rounded-t-[4px]"
                    style={{
                      height: `max(2px, ${bin[series.key] * 100}%)`,
                      backgroundColor: series.color,
                      opacity: hovered === null || hovered === index ? 1 : 0.45,
                    }}
                  />
                </div>
              ))}
              <span className="absolute -bottom-6 whitespace-nowrap text-[11px] app-text-muted">{t("Group {group}", { group: index + 1 })}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 flex justify-between ps-10 text-[11px] app-text-muted">
        <span>{t("Lowest risk")}</span>
        <span>{t("Highest risk")}</span>
      </div>
    </div>
  );
}

/** How much each input raises the odds of paying late (per standard deviation of that input). */
function Drivers({ coefficients }) {
  const entries = Object.entries(coefficients).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, value]) => Math.abs(value)), 0.01);

  return (
    <ul className="space-y-3 p-5">
      {entries.map(([name, value]) => (
        <li key={name} className="grid grid-cols-[minmax(0,13rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate app-text">{t(INPUTS[name] ?? name)}</span>
          <div className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-muted)" }}>
            <div className="h-full rounded-full" style={{ width: `${(Math.abs(value) / max) * 100}%`, backgroundColor: value >= 0 ? "var(--series-forecast)" : "var(--series-actual)" }} />
          </div>
          <span className="w-12 text-end text-xs tabular-nums app-text-muted">×{Math.exp(value).toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
}

function MethodTable({ methods }) {
  const order = Object.keys(METHODS).filter((key) => methods[key]);
  const fixed = (value, digits) => (value === null || value === undefined || Number.isNaN(value) ? "—" : value.toFixed(digits));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-start text-sm">
        <TableHead>
          <Th>{t("Approach")}</Th>
          <Th align="right">{t("Brier score")}</Th>
          <Th align="right">{t("AUC")}</Th>
          <Th align="right">{t("Log loss")}</Th>
          <Th align="right">{t("Caught in riskiest 20%")}</Th>
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
                    {key === "customer_history" && <Badge tone="info">{t("simple rule to beat")}</Badge>}
                  </p>
                  <p className="text-xs app-text-muted">{t(METHODS[key].description)}</p>
                </td>
                <td className={`whitespace-nowrap px-5 py-3 text-end tabular-nums app-text ${isModel ? "font-bold" : ""}`}>{fixed(values.brier, 4)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums app-text">{fixed(values.auc, 3)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums app-text-secondary">{fixed(values.log_loss, 3)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums app-text-secondary">{pct(values.capture_20)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RiskModel({ model }) {
  const details = model.details ?? {};
  const backtest = details.backtest;
  const metrics = model.metrics;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("Error vs simple rule")}
          value={pct(-metrics.improvement_vs_baseline, true)}
          hint={t("Brier score {model} vs {baseline} for the customer's late rate", { model: metrics.brier.toFixed(4), baseline: metrics.baseline_brier.toFixed(4) })}
          icon="sparkles"
          tone={metrics.improvement_vs_baseline > 0 ? "success" : "warning"}
        />
        <StatCard label={t("AUC")} value={metrics.auc.toFixed(3)} hint={t("Simple rule: {value}. 0.5 is guessing, 1 is perfect.", { value: metrics.baseline_auc.toFixed(3) })} icon="revenue" tone="primary" />
        <StatCard label={t("Paid late")} value={pct(metrics.late_rate)} hint={t("Of invoices in the test months (more than 7 days after the due date)")} icon="clock" tone="warning" />
        <StatCard label={t("Open invoices scored")} value={number(details.invoices_scored)} hint={t("Unpaid and not late yet")} icon="receipt" tone="info" />
      </div>

      {backtest && (
        <Card>
          <CardHeader
            title={t("Model vs simple methods")}
            description={t("Tested on {months} months it never saw: {count} invoices. Lower Brier score and log loss are better; higher AUC is better.", { months: backtest.folds, count: number(backtest.rows) })}
          />
          <MethodTable methods={backtest.methods} />
          <div className="border-t px-5 py-3 text-xs app-text-muted" style={{ borderColor: "var(--border-color)" }}>
            {t("The Brier score is the main measure: it checks that the probabilities are right, not just the ranking. A 40% score should mean about 4 in 10 such invoices are paid late.")}
          </div>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {backtest?.calibration && (
          <Card>
            <CardHeader title={t("Are the probabilities honest?")} description={t("Test invoices in five equal groups, from lowest to highest predicted risk")} />
            <CalibrationChart bins={backtest.calibration} />
          </Card>
        )}
        {details.coefficients && (
          <Card>
            <CardHeader title={t("What drives the risk")} description={t("How much each factor multiplies the odds of paying late, for a typical difference between customers")} />
            <Drivers coefficients={details.coefficients} />
          </Card>
        )}
      </div>

      <Card>
        <CardHeader title={t("Training")} />
        <dl className="grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-2 xl:grid-cols-3">
          {[
            [t("Trained"), formatDate(model.trained_at, true)],
            [t("Version"), model.version],
            [t("Invoices from"), details.data_from ? dayDate(details.data_from) : "—"],
            [t("Training examples"), number(details.training_rows)],
            [t("Paid late in training data"), pct(details.training_late_rate)],
            [t("Payment terms"), t("{count} days, late after {grace} more", { count: details.payment_terms_days, grace: details.late_definition_days })],
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
            <Th align="right">{t("Brier score")}</Th>
            <Th align="right">{t("AUC")}</Th>
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
                <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums app-text">{model.metrics?.brier?.toFixed(4) ?? "—"}</td>
                <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums app-text-secondary">{model.metrics?.auc?.toFixed(3) ?? "—"}</td>
                <td className="whitespace-nowrap px-5 py-3 text-end tabular-nums app-text-secondary">{pct(-(model.metrics?.improvement_vs_baseline ?? NaN), true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function PaymentRisk() {
  const { data, loading, error, reload } = useResource("/ml/models");
  const models = (data?.data ?? []).filter((model) => model.name === "payment_risk");
  const active = models.find((model) => model.is_active);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Payment risk")}
        description={t("Estimates how likely each open invoice is to be paid more than 7 days late, from the customer's payment history. Tested on months it never saw. Scores appear on the Receivables page.")}
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
          <EmptyState icon="sparkles" title={t("No model trained yet")} description={t("Run the training job in the ml folder (python -m b2b_ml risk). Results appear here.")} />
        </Card>
      ) : (
        <>
          <RiskModel model={active} />
          <Versions models={models} />
        </>
      )}
    </div>
  );
}
