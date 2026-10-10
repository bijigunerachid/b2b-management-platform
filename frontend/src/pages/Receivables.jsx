import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { useToast } from "../components/ui/feedback";
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  IconAction,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedControl,
  SortHeader,
  StatCard,
  TableHead,
  TableSkeleton,
  Th,
} from "../components/ui/primitives";
import { RecordPaymentModal } from "../components/PaymentPanel";
import { can, compactMoney, exportCsv, formatDate, initials, money, number, useResource } from "../lib/api";
import { AGEING_BUCKETS, paymentBadge } from "../lib/billing";
import useTable from "../lib/useTable";

import { t } from "../i18n";
const bucketColor = {
  current: "var(--primary)",
  "1-30": "color-mix(in srgb, var(--danger) 45%, var(--surface))",
  "31-60": "color-mix(in srgb, var(--danger) 65%, var(--surface))",
  "61-90": "color-mix(in srgb, var(--danger) 82%, var(--surface))",
  "90+": "var(--danger)",
};

const accessors = {
  id: (invoice) => invoice.id,
  customer: (invoice) => invoice.company_name,
  due: (invoice) => new Date(invoice.billing.due_date).getTime(),
  overdue: (invoice) => invoice.billing.days_overdue,
  balance: (invoice) => invoice.billing.balance,
};

function AgeingChart({ buckets, outstanding, selected, onSelect }) {
  const max = Math.max(...AGEING_BUCKETS.map(({ key }) => buckets[key]?.amount ?? 0), 1);

  return (
    <Card className="flex flex-col">
      <CardHeader
        title={t("Receivables ageing")}
        description={t("Click a bar to filter the list below")}
      />
      <div className="flex-1 space-y-3 p-5">
        {AGEING_BUCKETS.map(({ key, label }) => {
          const bucket = buckets[key] ?? { amount: 0, count: 0 };
          const share = outstanding > 0 ? (bucket.amount / outstanding) * 100 : 0;
          const active = selected === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(active ? "all" : key)}
              aria-pressed={active}
              className={`group block w-full rounded-lg p-2 text-start transition ${active ? "" : "hover:bg-[var(--surface-hover)]"}`}
              style={active ? { backgroundColor: "var(--primary-soft)" } : undefined}
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium app-text">{t(label)}</span>
                <span className="tabular-nums app-text-secondary">
                  <span className="font-semibold app-text">{money(bucket.amount)}</span> · {bucket.count === 1 ? t("1 invoice") : t("{count} invoices", { count: bucket.count })} ·{" "}
                  {share.toFixed(0)}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-muted)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${(bucket.amount / max) * 100}%`, backgroundColor: bucketColor[key] }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function TopDebtors({ debtors }) {
  return (
    <Card>
      <CardHeader title={t("Top debtors")} />
      {debtors.length === 0 ? (
        <EmptyState icon="checkCircle" title={t("Nobody owes you money")} />
      ) : (
        <ol className="divide-y" style={{ borderColor: "var(--border-color)" }}>
          {debtors.slice(0, 6).map((debtor) => (
            <li key={debtor.customer_id} style={{ borderColor: "var(--border-color)" }}>
              <Link
                to={`/customers?view=${debtor.customer_id}`}
                className="flex items-center gap-3 px-5 py-3 transition hover:bg-[var(--surface-hover)]"
              >
                <Avatar label={initials(debtor.company_name)} seed={debtor.customer_id} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold app-text">{debtor.company_name}</p>
                  <p className="text-xs app-text-muted">
                    {t("{count} open", { count: debtor.invoices })}
                    {debtor.oldest_days_overdue > 0 && ` · ${t("oldest {days}d late", { days: debtor.oldest_days_overdue })}`}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-sm font-bold tabular-nums app-text">{compactMoney(debtor.balance)}</p>
                  {debtor.overdue > 0 && (
                    <p className="text-xs font-medium tabular-nums" style={{ color: "var(--danger)" }}>
                      {t("{amount} overdue", { amount: compactMoney(debtor.overdue) })}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export default function Receivables() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useResource("/receivables");
  const report = data?.data;

  const [bucket, setBucket] = useState("all");
  const [search, setSearch] = useState("");
  const [paying, setPaying] = useState(null);

  const invoices = useMemo(() => report?.invoices ?? [], [report]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase().replace(/^#/, "");
    return invoices.filter(
      (invoice) =>
        (bucket === "all" || invoice.billing.ageing_bucket === bucket) &&
        (!term || String(invoice.id).includes(term) || invoice.company_name.toLowerCase().includes(term))
    );
  }, [invoices, bucket, search]);

  const table = useTable(filtered, { accessors, initialSort: { key: "overdue", direction: "desc" } });

  if (!report) {
    return error ? (
      <ErrorState message={error} onRetry={reload} />
    ) : (
      <div className="space-y-6" aria-busy="true">
        <div className="skeleton h-16 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-80 rounded-2xl" />
      </div>
    );
  }

  const overdueInvoices = invoices.filter((invoice) => invoice.billing.overdue);
  const averageDaysLate = overdueInvoices.length
    ? Math.round(overdueInvoices.reduce((sum, invoice) => sum + invoice.billing.days_overdue, 0) / overdueInvoices.length)
    : 0;
  const canRecord = can(user, "payments.write");

  function handleExport() {
    exportCsv(
      "receivables",
      [
        [t("Invoice"), (i) => `INV-${new Date(i.created_at).getFullYear()}-${String(i.id).padStart(6, "0")}`],
        [t("Order"), (i) => i.id],
        [t("Customer"), (i) => i.company_name],
        [t("Due date"), (i) => String(i.billing.due_date).slice(0, 10)],
        [t("Days overdue"), (i) => i.billing.days_overdue],
        [t("Total (MAD)"), (i) => i.billing.total_due],
        [t("Paid (MAD)"), (i) => i.billing.amount_paid],
        [t("Balance (MAD)"), (i) => i.billing.balance],
        [t("Status"), (i) => t(i.billing.payment_status)],
      ],
      table.sorted
    );
    toast.info(t("Exported {count} open invoices to CSV.", { count: table.sorted.length }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Receivables")}
        actions={
          <>
            <Button icon="download" onClick={handleExport} disabled={filtered.length === 0}>
              {t("Export")}
            </Button>
            <Button size="icon" variant="ghost" icon="refresh" onClick={reload} aria-label={t("Refresh")} title={t("Refresh")} className={loading ? "[&_svg]:animate-spin" : ""} />
          </>
        }
      />

      {error && <ErrorState message={`${error} ${t("Showing the last loaded data.")}`} onRetry={reload} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("Outstanding")} value={compactMoney(report.outstanding)} hint={t("{count} open invoices incl. VAT", { count: number(invoices.length) })} icon="wallet" tone="primary" />
        <StatCard
          label={t("Overdue")}
          value={compactMoney(report.overdue)}
          hint={t("{percent}% of outstanding", { percent: report.outstanding > 0 ? ((report.overdue / report.outstanding) * 100).toFixed(0) : 0 })}
          icon="alert"
          tone="danger"
          onClick={() => setBucket("all")}
        />
        <StatCard label={t("Overdue invoices")} value={number(report.overdue_count)} hint={t("Past their 30-day terms")} icon="receipt" tone="warning" />
        <StatCard label={t("Average delay")} value={t("{count} days", { count: averageDaysLate })} hint={t("Across overdue invoices")} icon="clock" tone="info" />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <AgeingChart buckets={report.buckets} outstanding={report.outstanding} selected={bucket} onSelect={(value) => { setBucket(value); table.setPage(1); }} />
        </div>
        <div className="xl:col-span-2">
          <TopDebtors debtors={report.top_debtors} />
        </div>
      </div>

      <Card>
        <div className="space-y-3 border-b p-4" style={{ borderColor: "var(--border-color)" }}>
          <SegmentedControl
            label={t("Filter by age")}
            value={bucket}
            onChange={(value) => {
              setBucket(value);
              table.setPage(1);
            }}
            options={[
              { value: "all", label: t("All open"), count: invoices.length },
              ...AGEING_BUCKETS.map(({ key, label }) => ({ value: key, label, count: report.buckets[key]?.count ?? 0 })),
            ]}
          />
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              table.setPage(1);
            }}
            placeholder={t("Search order # or customer...")}
            className="sm:w-80"
          />
        </div>

        {loading && !data ? (
          <TableSkeleton columns={7} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={invoices.length ? "search" : "checkCircle"}
            title={invoices.length ? t("No invoices match") : t("All invoices are paid")}
            description={invoices.length ? t("Try another age bucket or search.") : t("No open balances.")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-start text-sm">
              <TableHead>
                <SortHeader label={t("Order")} column="id" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label={t("Customer")} column="customer" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label={t("Due")} column="due" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label={t("Status")} column="overdue" sort={table.sort} onSort={table.toggleSort} />
                <Th align="right" className="hidden 2xl:table-cell">{t("Invoice total")}</Th>
                <SortHeader label={t("Balance")} column="balance" sort={table.sort} onSort={table.toggleSort} align="right" />
                <Th align="right">{t("Actions")}</Th>
              </TableHead>
              <tbody>
                {table.rows.map((invoice) => {
                  const badge = paymentBadge(invoice.billing);
                  return (
                    <tr key={invoice.id} className="border-t transition-colors hover:bg-[var(--surface-hover)]" style={{ borderColor: "var(--border-color)" }}>
                      <td className="px-5 py-3.5 font-bold app-text">#{invoice.id}</td>
                      <td className="px-5 py-3.5">
                        <Link to={`/customers?view=${invoice.customer_id}`} className="flex items-center gap-3 hover:underline">
                          <Avatar label={initials(invoice.company_name)} seed={invoice.customer_id} size={32} rounded="rounded-lg" />
                          <span className="max-w-[160px] truncate font-medium app-text">{invoice.company_name}</span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 app-text-secondary">{formatDate(invoice.billing.due_date)}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={badge.tone} icon={badge.icon}>
                          {badge.label}
                        </Badge>
                        {badge.detail === "Partially paid" && <p className="mt-1 text-xs app-text-muted">{t("Partially paid")}</p>}
                      </td>
                      <td className="hidden whitespace-nowrap px-5 py-3.5 text-end tabular-nums app-text-secondary 2xl:table-cell">{money(invoice.billing.total_due)}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-end font-semibold tabular-nums app-text">{money(invoice.billing.balance)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1">
                          {canRecord && <IconAction icon="wallet" label={t("Record payment for order {id}", { id: invoice.id })} onClick={() => setPaying(invoice)} />}
                          <Link
                            to={`/orders?view=${invoice.id}`}
                            aria-label={t("View order {id}", { id: invoice.id })}
                            title={t("View order")}
                            className="flex h-8 w-8 items-center justify-center rounded-lg transition text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                          >
                            <Icon name="eye" size={17} />
                          </Link>
                          <a
                            href={`/orders/${invoice.id}/invoice`}
                            target="_blank"
                            rel="noopener"
                            aria-label={t("Open invoice for order {id}", { id: invoice.id })}
                            title={t("Open invoice")}
                            className="flex h-8 w-8 items-center justify-center rounded-lg transition text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                          >
                            <Icon name="download" size={17} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <Pagination page={table.page} totalPages={table.totalPages} total={table.total} pageSize={table.pageSize} onPageChange={table.setPage} label={t("open invoices")} />
        )}
      </Card>

      <RecordPaymentModal
        open={Boolean(paying)}
        onClose={() => setPaying(null)}
        order={paying}
        billing={paying?.billing}
        onRecorded={reload}
      />
    </div>
  );
}
