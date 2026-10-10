import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, TableSkeleton } from "../components/ui/primitives";
import { ChangeList } from "../components/HistoryPanel";
import { formatDate, timeAgo, useResource } from "../lib/api";

const AREAS = [
  ["", "All activity"],
  ["auth", "Sign-ins"],
  ["order", "Orders"],
  ["payment", "Payments"],
  ["credit_note", "Credit notes"],
  ["quote", "Quotes"],
  ["customer", "Customers"],
  ["product", "Products"],
  ["stock", "Stock"],
  ["purchase_order", "Purchase orders"],
  ["pricing", "Pricing"],
  ["user", "Staff accounts"],
  ["portal", "Portal access"],
];

const ENTITY_LINKS = {
  order: (id) => `/orders?view=${id}`,
  customer: (id) => `/customers?view=${id}`,
  quote: (id) => `/quotes?view=${id}`,
  purchase_order: (id) => `/purchase-orders?view=${id}`,
};

function tone(action) {
  if (action === "auth.login_failed" || /deleted|voided|cancelled|disabled|deactivated/.test(action)) return "danger";
  if (action.startsWith("auth.")) return "neutral";
  if (/created|granted|recorded|received|activated|enabled/.test(action)) return "success";
  return "info";
}

function Entry({ entry }) {
  const [open, setOpen] = useState(false);
  const link = entry.entity_id && ENTITY_LINKS[entry.entity_type]?.(entry.entity_id);
  const hasMore = entry.changes?.length || entry.details;

  return (
    <li className="px-5 py-3.5" style={{ borderColor: "var(--border-color)" }}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <div className="w-28 shrink-0 text-xs app-text-muted" title={formatDate(entry.created_at, true)}>
          <p className="font-medium app-text-secondary">{formatDate(entry.created_at)}</p>
          <p>
            {new Date(entry.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {timeAgo(entry.created_at)}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm app-text">
            {entry.summary}
            {link && (
              <Link to={link} className="ml-2 text-xs font-semibold hover:underline" style={{ color: "var(--primary)" }}>
                Open
              </Link>
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs app-text-muted">
            <span>{entry.user_name ?? (entry.action === "auth.login_failed" ? "Unknown" : "System")}</span>
            {entry.user_role && <span>· {entry.user_role}</span>}
            <Badge tone={tone(entry.action)}>{entry.action}</Badge>
          </p>
          <ChangeList changes={entry.changes} />
          {open && (
            <dl className="mt-2 grid gap-x-4 gap-y-1 rounded-lg p-3 text-xs app-muted sm:grid-cols-[auto_1fr]">
              <dt className="app-text-muted">Request</dt>
              <dd className="font-mono app-text">
                {entry.method} {entry.path} → {entry.status}
              </dd>
              {entry.ip && (
                <>
                  <dt className="app-text-muted">IP address</dt>
                  <dd className="font-mono app-text">{entry.ip}</dd>
                </>
              )}
              {entry.details && (
                <>
                  <dt className="app-text-muted">Sent data</dt>
                  <dd className="overflow-x-auto">
                    <pre className="whitespace-pre-wrap break-all font-mono app-text">{JSON.stringify(entry.details, null, 2)}</pre>
                  </dd>
                </>
              )}
            </dl>
          )}
        </div>
        {hasMore && (
          <Button size="sm" variant="ghost" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
            {open ? "Less" : "Details"}
            <Icon name="chevronDown" size={15} className={open ? "rotate-180" : ""} />
          </Button>
        )}
      </div>
    </li>
  );
}

export default function AuditLog() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");

  const set = (changes) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in changes)) next.delete("page");
    setParams(next, { replace: true });
  };

  // Debounce the search box into the URL.
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((params.get("q") ?? "") !== search.trim()) {
        const next = new URLSearchParams(params);
        if (search.trim()) next.set("q", search.trim());
        else next.delete("q");
        next.delete("page");
        setParams(next, { replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, params, setParams]);

  const query = new URLSearchParams({ limit: "25" });
  for (const key of ["q", "action", "user_id", "entity_type", "entity_id", "from", "to", "page"]) {
    if (params.get(key)) query.set(key, params.get(key));
  }
  const { data, loading, error, reload } = useResource(`/audit?${query}`);
  const entries = data?.data ?? [];
  const people = data?.people ?? [];
  const pagination = data?.pagination ?? { page: 1, totalPages: 1, total: 0, limit: 25 };
  const filtered = ["q", "action", "user_id", "entity_type", "from", "to"].some((key) => params.get(key));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Every change made through the app, and every sign-in attempt. Entries can't be edited or deleted."
        actions={<Button size="icon" variant="ghost" icon="refresh" onClick={reload} aria-label="Refresh" title="Refresh" className={loading ? "[&_svg]:animate-spin" : ""} />}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b p-4" style={{ borderColor: "var(--border-color)" }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search summary or person..." className="sm:w-72" />
          <select value={params.get("action") ?? ""} onChange={(event) => set({ action: event.target.value })} className="app-input h-10 w-auto" aria-label="Area">
            {AREAS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select value={params.get("user_id") ?? ""} onChange={(event) => set({ user_id: event.target.value })} className="app-input h-10 w-auto max-w-56" aria-label="Person">
            <option value="">Everyone</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} ({person.role})
              </option>
            ))}
          </select>
          <input type="date" value={params.get("from") ?? ""} onChange={(event) => set({ from: event.target.value })} className="app-input h-10 w-auto" aria-label="From" />
          <input type="date" value={params.get("to") ?? ""} onChange={(event) => set({ to: event.target.value })} className="app-input h-10 w-auto" aria-label="To" />
          {(filtered || params.get("entity_id")) && (
            <Button
              variant="ghost"
              icon="close"
              onClick={() => {
                setSearch("");
                setParams({}, { replace: true });
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {params.get("entity_type") && params.get("entity_id") && (
          <p className="border-b px-5 py-2.5 text-sm app-text-secondary" style={{ borderColor: "var(--border-color)" }}>
            Showing the history of {params.get("entity_type").replace("_", " ")} #{params.get("entity_id")}
          </p>
        )}

        {error && <ErrorState message={error} onRetry={reload} />}
        {loading && !data ? (
          <TableSkeleton columns={3} />
        ) : entries.length === 0 ? (
          <EmptyState icon="list" title={filtered ? "Nothing matches" : "No activity yet"} description={filtered ? "Try other filters." : "Changes will appear here as people use the app."} />
        ) : (
          <ul className={`divide-y transition-opacity ${loading ? "opacity-60" : ""}`} style={{ borderColor: "var(--border-color)" }}>
            {entries.map((entry) => (
              <Entry key={entry.id} entry={entry} />
            ))}
          </ul>
        )}

        {entries.length > 0 && (
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pagination.limit}
            onPageChange={(page) => set({ page: String(page) })}
            label="entries"
          />
        )}
      </Card>
    </div>
  );
}
