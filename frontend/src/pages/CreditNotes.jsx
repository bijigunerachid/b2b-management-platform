import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { useToast } from "../components/ui/feedback";
import {
  Avatar,
  Card,
  EmptyState,
  ErrorState,
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
import { compactMoney, exportCsv, formatDate, initials, money, number, toList, useResource } from "../lib/api";
import { RETURN_REASONS } from "../lib/returns";
import useTable from "../lib/useTable";

import { t } from "../i18n";
const accessors = {
  id: (note) => note.id,
  customer: (note) => note.company_name,
  date: (note) => new Date(note.created_at).getTime() || 0,
  total: (note) => note.total,
};

const linkClass =
  "flex h-8 w-8 items-center justify-center rounded-lg transition text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]";

export default function CreditNotes() {
  const toast = useToast();
  const { data, loading, error, reload } = useResource("/credit-notes");
  const notes = useMemo(() => toList(data, "credit_notes"), [data]);

  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("all");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return notes.filter(
      (note) =>
        (reason === "all" || note.reason === reason) &&
        (!term ||
          note.number.toLowerCase().includes(term) ||
          String(note.order_id) === term.replace(/^#/, "") ||
          note.company_name.toLowerCase().includes(term))
    );
  }, [notes, reason, search]);

  const table = useTable(filtered, { accessors, initialSort: { key: "id", direction: "desc" } });

  const credited = notes.reduce((sum, note) => sum + note.total, 0);
  const refunded = notes.reduce((sum, note) => sum + note.refund_amount, 0);
  const units = notes.reduce((sum, note) => sum + note.units, 0);
  const reasonCounts = Object.fromEntries(RETURN_REASONS.map((value) => [value, notes.filter((note) => note.reason === value).length]));
  const topReason = RETURN_REASONS.reduce((best, value) => (reasonCounts[value] > (reasonCounts[best] ?? 0) ? value : best), null);

  function handleExport() {
    exportCsv(
      "credit-notes",
      [
        [t("Credit note"), (n) => n.number],
        [t("Date"), (n) => String(n.created_at).slice(0, 10)],
        [t("Order"), (n) => n.order_id],
        [t("Customer"), (n) => n.company_name],
        [t("Reason"), (n) => t(n.reason)],
        [t("Units"), (n) => n.units],
        [t("Subtotal (MAD)"), (n) => n.subtotal],
        [t("Total (MAD)"), (n) => n.total],
        [t("Refunded (MAD)"), (n) => n.refund_amount],
        [t("Refund method"), (n) => (n.refund_method ? t(n.refund_method) : "")],
      ],
      table.sorted
    );
    toast.info(t("Exported {count} credit notes to CSV.", { count: table.sorted.length }));
  }

  function changeFilter(update) {
    update();
    table.setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Credit notes")}
        description={t("Returns are recorded from a completed order.")}
        actions={
          <>
            <Button icon="download" onClick={handleExport} disabled={filtered.length === 0}>
              {t("Export")}
            </Button>
            <Button size="icon" variant="ghost" icon="refresh" onClick={reload} aria-label={t("Refresh")} title={t("Refresh")} className={loading ? "[&_svg]:animate-spin" : ""} />
          </>
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("Credit notes")} value={number(notes.length)} hint={t("{count} units returned", { count: number(units) })} icon="undo" tone="primary" />
        <StatCard label={t("Credited")} value={compactMoney(credited)} hint={t("Incl. VAT")} icon="receipt" tone="info" />
        <StatCard label={t("Refunded")} value={compactMoney(refunded)} hint={credited > 0 ? t("{percent}% of credits", { percent: ((refunded / credited) * 100).toFixed(0) }) : null} icon="wallet" tone="warning" />
        <StatCard
          label={t("Top reason")}
          value={topReason ? `${Math.round((reasonCounts[topReason] / notes.length) * 100)}%` : t("None")}
          hint={topReason ? t("{reason}, {count} credit notes", { reason: t(topReason), count: reasonCounts[topReason] }) : null}
          icon="alert"
          tone="danger"
        />
      </div>

      <Card>
        <div className="space-y-3 border-b p-4" style={{ borderColor: "var(--border-color)" }}>
          <SegmentedControl
            label={t("Filter by reason")}
            value={reason}
            onChange={(value) => changeFilter(() => setReason(value))}
            options={[
              { value: "all", label: t("All"), count: notes.length },
              ...RETURN_REASONS.map((value) => ({ value, label: value, count: reasonCounts[value] })),
            ]}
          />
          <SearchInput
            value={search}
            onChange={(value) => changeFilter(() => setSearch(value))}
            placeholder={t("Search number, order # or customer...")}
            className="sm:w-80"
          />
        </div>

        {loading && !data ? (
          <TableSkeleton columns={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={notes.length ? "search" : "undo"}
            title={notes.length ? t("No credit notes match") : t("No credit notes yet")}
            description={notes.length ? t("Try another reason or search.") : t("Open a completed order and choose Return items.")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-start text-sm">
              <TableHead>
                <SortHeader label={t("Number")} column="id" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label={t("Customer")} column="customer" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label={t("Date")} column="date" sort={table.sort} onSort={table.toggleSort} />
                <Th className="hidden 2xl:table-cell">{t("Reason")}</Th>
                <SortHeader label={t("Total")} column="total" sort={table.sort} onSort={table.toggleSort} align="right" />
                <Th align="right">{t("Actions")}</Th>
              </TableHead>
              <tbody>
                {table.rows.map((note) => (
                  <tr key={note.id} className="border-t transition-colors hover:bg-[var(--surface-hover)]" style={{ borderColor: "var(--border-color)" }}>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <p className="font-bold app-text">{note.number}</p>
                      <p className="text-xs app-text-muted">
                        {t("Order #{id}", { id: note.order_id })} · {note.units === 1 ? t("1 unit") : t("{count} units", { count: number(note.units) })}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link to={`/customers?view=${note.customer_id}`} className="flex items-center gap-3 hover:underline">
                        <Avatar label={initials(note.company_name)} seed={note.customer_id} size={32} rounded="rounded-lg" />
                        <span className="max-w-[180px] truncate font-medium app-text">{note.company_name}</span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 app-text-secondary">{formatDate(note.created_at)}</td>
                    <td className="hidden whitespace-nowrap px-5 py-3.5 app-text-secondary 2xl:table-cell">{note.reason}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-end">
                      <p className="font-semibold tabular-nums app-text">{money(note.total)}</p>
                      {note.refund_amount > 0 && <p className="text-xs tabular-nums app-text-muted">{money(note.refund_amount)} refunded</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        <Link to={`/orders?view=${note.order_id}`} aria-label={`View order ${note.order_id}`} title={t("View order")} className={linkClass}>
                          <Icon name="eye" size={17} />
                        </Link>
                        <a href={`/credit-notes/${note.id}/print`} target="_blank" rel="noopener" aria-label={`Open ${note.number}`} title={t("Open credit note")} className={linkClass}>
                          <Icon name="download" size={17} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <Pagination page={table.page} totalPages={table.totalPages} total={table.total} pageSize={table.pageSize} onPageChange={table.setPage} label={t("credit notes")} />
        )}
      </Card>
    </div>
  );
}
