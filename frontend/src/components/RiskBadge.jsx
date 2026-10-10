import Icon from "./ui/Icon";
import { Popover, toneStyle } from "./ui/primitives";
import { number } from "../lib/api";
import { riskLevel, riskReasons } from "../lib/ml";

import { t } from "../i18n";

/** Late-payment risk for one invoice; opens the reasons behind the score. */
export default function RiskBadge({ risk, align = "right" }) {
  if (!risk) return null;
  const percent = Math.round(risk.probability * 100);
  const level = riskLevel(risk.probability);
  const reasons = riskReasons(risk.facts);
  const facts = risk.facts ?? {};

  return (
    <Popover
      align={align}
      width={300}
      label={t("Late payment risk")}
      trigger={({ props }) => (
        <button
          type="button"
          {...props}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold transition hover:brightness-95"
          style={toneStyle(level.tone)}
          title={t("Why?")}
        >
          <Icon name="sparkles" size={12} />
          {t("{percent}% late risk", { percent })}
        </button>
      )}
    >
      <div className="space-y-3 p-4 text-sm">
        <div>
          <p className="font-semibold app-text">{t(level.label)}</p>
          <p className="text-xs app-text-muted">
            {t("{percent}% chance this invoice is paid more than 7 days after its due date.", { percent })}
          </p>
        </div>
        {reasons.length > 0 ? (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide app-text-muted">{t("Main reasons")}</p>
            <ul className="space-y-1">
              {reasons.map((reason) => (
                <li key={reason} className="flex gap-2 app-text-secondary">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current" />
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs app-text-secondary">{t("Nothing stands out: this customer usually pays on time.")}</p>
        )}
        {facts.known_invoices > 0 && (
          <p className="border-t pt-2 text-xs app-text-muted" style={{ borderColor: "var(--border-color)" }}>
            {t("History: {late} of {count} earlier invoices paid late", { late: number(facts.late_invoices), count: facts.known_invoices })}
          </p>
        )}
      </div>
    </Popover>
  );
}
