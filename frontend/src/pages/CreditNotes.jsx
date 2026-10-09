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
        ["Credit note", (n) => n.number],
        ["Date", (n) => String(n.created_at).slice(0, 10)],
        ["Order", (n) => n.order_id],
        ["Customer", (n) => n.company_name],
        ["Reason", (n) => n.reason],
        ["Units", (n) => n.units],
        ["Subtotal (MAD)", (n) => n.subtotal],
        ["Total (MAD)", (n) => n.total],
        ["Refunded (MAD)", (n) => n.refund_amount],
        ["Refund method", (n) => n.refund_method ?? ""],
      ],
      table.sorted
    );
    toast.info(`Exported ${table.sorted.length} credit notes to CSV.`);
  }

  function changeFilter(update) {
    update();
    table.setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credit notes"
        description="Returns are recorded from a completed order."
        actions={
          <>
            <Button icon="download" onClick={handleExport} disabled={filtered.length === 0}>
              Export
            </Button>
            <Button size="icon" variant="ghost" icon="refresh" onClick={reload} aria-label="Refresh" title="Refresh" className={loading ? "[&_svg]:animate-spin" : ""} />
          </>
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Credit notes" value={number(notes.length)} hint={`${number(units)} units returned`} icon="undo" tone="primary" />
        <StatCard label="Credited" value={compactMoney(credited)} hint="Incl. VAT" icon="receipt" tone="info" />
        <StatCard label="Refunded" value={compactMoney(refunded)} hint={credited > 0 ? `${((refunded / credited) * 100).toFixed(0)}% of credits` : null} icon="wallet" tone="warning" />
        <StatCard
          label="Top reason"
          value={topReason ? `${Math.round((reasonCounts[topReason] / notes.length) * 100)}%` : "None"}
          hint={topReason ? `${topReason}, ${reasonCounts[topReason]} credit notes` : null}
          icon="alert"
          tone="danger"
        />
      </div>

      <Card>
        <div className="space-y-3 border-b p-4" style={{ borderColor: "var(--border-color)" }}>
          <SegmentedControl
            label="Filter by reason"
            value={reason}
            onChange={(value) => changeFilter(() => setReason(value))}
            options={[
              { value: "all", label: "All", count: notes.length },
              ...RETURN_REASONS.map((value) => ({ value, label: value, count: reasonCounts[value] })),
            ]}
          />
          <SearchInput
            value={search}
            onChange={(value) => changeFilter(() => setSearch(value))}
            placeholder="Search number, order # or customer..."
            className="sm:w-80"
          />
        </div>

        {loading && !data ? (
          <TableSkeleton columns={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={notes.length ? "search" : "undo"}
            title={notes.length ? "No credit notes match" : "No credit notes yet"}
            description={notes.length ? "Try another reason or search." : "Open a completed order and choose Return items."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <TableHead>
                <SortHeader label="Number" column="id" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label="Customer" column="customer" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label="Date" column="date" sort={table.sort} onSort={table.toggleSort} />
                <Th className="hidden 2xl:table-cell">Reason</Th>
                <SortHeader label="Total" column="total" sort={table.sort} onSort={table.toggleSort} align="right" />
                <Th align="right">Actions</Th>
              </TableHead>
              <tbody>
                {table.rows.map((note) => (
                  <tr key={note.id} className="border-t transition-colors hover:bg-[var(--surface-hover)]" style={{ borderColor: "var(--border-color)" }}>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <p className="font-bold app-text">{note.number}</p>
                      <p className="text-xs app-text-muted">
                        Order #{note.order_id} · {number(note.units)} {note.units === 1 ? "unit" : "units"}
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
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <p className="font-semibold tabular-nums app-text">{money(note.total)}</p>
                      {note.refund_amount > 0 && <p className="text-xs tabular-nums app-text-muted">{money(note.refund_amount)} refunded</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        <Link to={`/orders?view=${note.order_id}`} aria-label={`View order ${note.order_id}`} title="View order" className={linkClass}>
                          <Icon name="eye" size={17} />
                        </Link>
                        <a href={`/credit-notes/${note.id}/print`} target="_blank" rel="noopener" aria-label={`Open ${note.number}`} title="Open credit note" className={linkClass}>
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
          <Pagination page={table.page} totalPages={table.totalPages} total={table.total} pageSize={table.pageSize} onPageChange={table.setPage} label="credit notes" />
        )}
      </Card>
    </div>
  );
}
