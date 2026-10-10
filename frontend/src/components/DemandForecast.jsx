import { useState } from "react";
import { formatDate, number, useResource } from "../lib/api";
import { dayDate as weekDate, niceMax } from "../lib/ml";

import { t } from "../i18n";

function round(value) {
  return value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
}

function addWeeks(week, count) {
  const date = new Date(`${week}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count * 7);
  return date.toISOString().slice(0, 10);
}

function coverTone(weeks) {
  if (weeks < 2) return "var(--danger)";
  if (weeks < 4) return "var(--warning)";
  return "var(--text-primary)";
}

/** Weekly sales for the last 26 weeks, then the forecast as an average per week with its 80% range. */
function ForecastChart({ history, forecast }) {
  const [hovered, setHovered] = useState(null);
  const horizon = forecast.horizon_weeks;
  const perWeek = { units: forecast.units / horizon, lower: forecast.lower_units / horizon, upper: forecast.upper_units / horizon };
  const max = niceMax(Math.max(...history.map((week) => week.units), perWeek.upper, 1));
  const height = (value) => `${(value / max) * 100}%`;
  const firstForecastWeek = addWeeks(forecast.origin_week, 1);

  const readout =
    hovered === null
      ? t("Bars: units sold each week. Shaded: expected weekly sales for the next {count} weeks (80% range).", { count: horizon })
      : hovered === "forecast"
        ? t("From {date}: about {units} a week (80% range {lower}–{upper})", { date: weekDate(firstForecastWeek), units: round(perWeek.units), lower: round(perWeek.lower), upper: round(perWeek.upper) })
        : t("Week of {date}: {units} sold", { date: weekDate(history[hovered].week), units: number(history[hovered].units) });

  return (
    <div>
      <div className="relative h-36 ps-8" onMouseLeave={() => setHovered(null)}>
        {[0, max / 2, max].map((tick) => (
          <div
            key={tick}
            className="absolute start-8 end-0 border-t"
            style={{ bottom: height(tick), borderColor: tick === 0 ? "var(--border-strong)" : "var(--chart-grid)", borderStyle: tick === 0 ? "solid" : "dashed" }}
          >
            <span className="absolute -start-8 w-7 -translate-y-1/2 pe-1 text-end text-[10px] tabular-nums app-text-muted">{number(tick)}</span>
          </div>
        ))}

        <div className="relative flex h-full items-end gap-[2px]">
          {history.map((week, index) => (
            <div
              key={week.week}
              className="flex h-full flex-1 items-end"
              onMouseEnter={() => setHovered(index)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              tabIndex={0}
              aria-label={t("Week of {date}: {units} sold", { date: weekDate(week.week), units: number(week.units) })}
            >
              {week.units > 0 && (
                <div
                  className="w-full rounded-t-[3px] transition-opacity"
                  style={{ height: height(week.units), backgroundColor: "var(--series-actual)", opacity: hovered === null || hovered === index ? 1 : 0.45 }}
                />
              )}
            </div>
          ))}

          <div
            className="relative h-full border-s border-dashed ps-[2px]"
            style={{ flex: horizon, borderColor: "var(--border-strong)" }}
            onMouseEnter={() => setHovered("forecast")}
            onFocus={() => setHovered("forecast")}
            onBlur={() => setHovered(null)}
            tabIndex={0}
            aria-label={t("From {date}: about {units} a week (80% range {lower}–{upper})", { date: weekDate(firstForecastWeek), units: round(perWeek.units), lower: round(perWeek.lower), upper: round(perWeek.upper) })}
          >
            <div
              className="absolute inset-x-[2px] rounded-[3px]"
              style={{
                bottom: height(perWeek.lower),
                height: `max(2px, ${height(perWeek.upper - perWeek.lower)})`,
                backgroundColor: "color-mix(in srgb, var(--series-forecast) 22%, transparent)",
                opacity: hovered === null || hovered === "forecast" ? 1 : 0.5,
              }}
            />
            <div className="absolute inset-x-[2px] h-[2px] rounded-full" style={{ bottom: height(perWeek.units), backgroundColor: "var(--series-forecast)" }} />
          </div>
        </div>
      </div>
      <div className="mt-1 flex justify-between ps-8 text-[10px] app-text-muted">
        <span>{weekDate(history[0].week)}</span>
        <span style={{ color: "var(--series-forecast)" }} className="font-semibold">
          {t("Next {count} weeks", { count: horizon })}
        </span>
      </div>
      <p className="mt-2 min-h-8 text-xs app-text-secondary" aria-live="polite">
        {readout}
      </p>
    </div>
  );
}

export default function DemandForecast({ product, stock }) {
  const { data, loading, error } = useResource(product ? `/ml/forecasts/products/${product.id}` : null);
  const result = data?.data;

  if (error) return null; // the forecast is extra information: never block the stock history
  if (loading && !result) return <div className="skeleton mb-4 h-56 rounded-xl" />;
  if (!result) return null;

  const { model, forecast, history } = result;
  // Weeks of sales the current stock covers; null when almost nothing is expected to sell.
  const cover = forecast && forecast.units >= 0.5 ? Number(stock) / (forecast.units / forecast.horizon_weeks) : null;

  return (
    <section className="mb-4 rounded-xl border p-4" style={{ borderColor: "var(--border-color)" }} aria-labelledby="forecast-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 id="forecast-heading" className="text-sm font-semibold app-text">
          {t("Demand forecast")}
        </h3>
        {model && <span className="text-[11px] app-text-muted">{t("Model trained {date}", { date: formatDate(model.trained_at) })}</span>}
      </div>

      {!forecast ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs app-text-secondary" style={{ borderColor: "var(--border-strong)" }}>
          {model ? t("No forecast for this product. It has no sales history yet, or it's inactive.") : t("No forecast yet. Once the demand model has been trained, expected sales appear here.")}
        </p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs app-text-muted">{t("Expected sales, next {count} weeks", { count: forecast.horizon_weeks })}</p>
              <p className="text-xl font-bold tabular-nums app-text">{number(Math.round(forecast.units))}</p>
              <p className="text-[11px] tabular-nums app-text-muted">
                {t("80% range {lower}–{upper}", { lower: number(Math.floor(forecast.lower_units)), upper: number(Math.ceil(forecast.upper_units)) })}
              </p>
            </div>
            <div>
              <p className="text-xs app-text-muted">{t("Current stock lasts")}</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: cover === null ? "var(--text-primary)" : coverTone(cover) }}>
                {cover === null ? "—" : cover < 1 ? t("Under a week") : cover > 26 ? t("26+ weeks") : t("{count} weeks", { count: Math.floor(cover) })}
              </p>
              <p className="text-[11px] app-text-muted">{t("at the expected rate")}</p>
            </div>
          </div>
          <ForecastChart history={history} forecast={forecast} />
        </>
      )}
    </section>
  );
}
