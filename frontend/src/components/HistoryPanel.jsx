import { Link } from "react-router-dom";
import { formatDate, timeAgo, useResource } from "../lib/api";

import { t } from "../i18n";
function formatValue(value) {
  if (value === null || value === undefined || value === "") return "empty";
  return String(value);
}

export function ChangeList({ changes }) {
  if (!changes?.length) return null;
  return (
    <ul className="mt-1.5 space-y-0.5 text-xs">
      {changes.map((change) => (
        <li key={change.field} className="flex flex-wrap gap-x-1.5">
          <span className="font-medium app-text-secondary">{change.field.replaceAll("_", " ")}:</span>
          <span className="line-through app-text-muted">{formatValue(change.from)}</span>
          <span className="app-text-muted">→</span>
          <span className="font-medium app-text">{formatValue(change.to)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Recent audit entries for one record. Only render it for users with audit.view. */
export default function HistoryPanel({ entityType, entityId, version = 0 }) {
  const { data, loading, error } = useResource(entityId ? `/audit?entity_type=${entityType}&entity_id=${entityId}&limit=15&v=${version}` : null);
  const entries = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold app-text">{t("History")}</h3>
        {total > entries.length && (
          <Link to={`/audit?entity_type=${entityType}&entity_id=${entityId}`} className="text-xs font-semibold hover:underline" style={{ color: "var(--primary)" }}>
            {t("All {count} entries", { count: total })}
          </Link>
        )}
      </div>
      {error ? (
        <p className="text-sm app-text-secondary">{error}</p>
      ) : loading && !data ? (
        <div className="skeleton h-14 rounded-xl" />
      ) : entries.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm app-text-secondary" style={{ borderColor: "var(--border-strong)" }}>
          {t("No recorded changes yet.")}
        </p>
      ) : (
        <ol className="space-y-3 border-s ps-4" style={{ borderColor: "var(--border-color)" }}>
          {entries.map((entry) => (
            <li key={entry.id} className="relative">
              <span className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: "var(--primary)", backgroundColor: "var(--surface)" }} />
              <p className="text-sm app-text">{entry.summary}</p>
              <p className="text-xs app-text-muted" title={formatDate(entry.created_at, true)}>
                {entry.user_name ?? t("Someone")} · {timeAgo(entry.created_at)}
              </p>
              <ChangeList changes={entry.changes} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
