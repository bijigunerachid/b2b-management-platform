// Helpers shared by the model pages and the places that show model output.
import { formatDate, money, number } from "./api";

import { t } from "../i18n";

/** "73.8%"; with `signed`, "+4.9%" / "−4.9%", kept left-to-right so the sign stays in front in Arabic. */
export function pct(value, signed = false) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const text = `${Math.abs(value * 100).toFixed(1)}%`;
  if (!signed) return text;
  return `\u2066${value > 0 ? "+" : value < 0 ? "−" : ""}${text}\u2069`;
}

/** A round number at or above `value`, for chart axes. */
export function niceMax(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 2.5, 5, 10].find((step) => step * magnitude >= value) * magnitude;
}

/** Formats a YYYY-MM-DD date from the API; noon keeps it on the same day in every time zone. */
export function dayDate(day) {
  return formatDate(`${day}T12:00:00`);
}

// Late-payment risk ------------------------------------------------------------

export const LIKELY_LATE = 0.5;

export function riskLevel(probability) {
  if (probability >= LIKELY_LATE) return { tone: "danger", label: "Likely late" };
  if (probability >= 0.25) return { tone: "warning", label: "Some risk" };
  return { tone: "success", label: "Likely on time" };
}

/** The reasons the model gave for one invoice, in plain words. */
export function riskReasons(facts) {
  if (!facts) return [];
  return (facts.reasons ?? [])
    .map((reason) => {
      switch (reason) {
        case "history":
          return facts.known_invoices > 0
            ? t("Paid late on {late} of {count} earlier invoices", { late: number(facts.late_invoices), count: facts.known_invoices })
            : null;
        case "recent_delay":
          return facts.recent_delay > 0 ? t("Recent invoices were paid {count} days after the due date", { count: Math.round(facts.recent_delay) }) : null;
        case "overdue_invoices":
          return facts.overdue_invoices > 0 ? t("Other invoices already overdue: {count}", { count: facts.overdue_invoices }) : null;
        case "log_amount":
          return t("Large invoice ({amount})", { amount: money(facts.invoice_total) });
        case "busy_month":
          return t("Issued in August or December, when payments slow down");
        case "new_customer":
          return t("New customer, no payment history yet");
        default:
          return null;
      }
    })
    .filter(Boolean);
}
