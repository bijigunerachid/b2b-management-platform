import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { useToast } from "../components/ui/feedback";
import {
  Card,
  CardHeader,
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
import { compactMoney, exportCsv, money, number, useResource } from "../lib/api";
import { localDateInput } from "../lib/billing";
import useTable from "../lib/useTable";

const LOW_MARGIN = 20;

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDateInput(date);
}

const PRESETS = [
  { value: "30", label: "30 days", range: () => ({ from: daysAgo(29), to: localDateInput() }) },
  { value: "90", label: "90 days", range: () => ({ from: daysAgo(89), to: localDateInput() }) },
  { value: "ytd", label: "This year", range: () => ({ from: `${new Date().getFullYear()}-01-01`, to: localDateInput() }) },
  { value: "365", label: "12 months", range: () => ({ from: daysAgo(364), to: localDateInput() }) },
];

const DIMENSIONS = {
  product: { label: "Products", key: "by_product", noun: "product" },
  customer: { label: "Customers", key: "by_customer", noun: "customer" },
  category: { label: "Categories", key: "by_category", noun: "category" },
};

const accessors = {
  label: (row) => row.label,
  units: (row) => row.units,
  revenue: (row) => row.revenue,
  margin: (row) => row.margin,
  margin_percent: (row) => row.margin_percent ?? -Infinity,
  returns: (row) => row.returns,
};

function niceMax(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 2.5, 5, 10].find((step) => step * magnitude >= value) * magnitude;
}

// Evenly spaced ticks that land on round numbers for a niceMax() value.
function axisTicks(max) {
  const mantissa = max / 10 ** Math.floor(Math.log10(max));
  const steps = Math.abs(mantissa - 2) < 1e-9 ? 4 : 5;
  return Array.from({ length: steps + 1 }, (_, index) => (max / steps) * index);
}

function monthLabel(key, withYear) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en", withYear ? { month: "short", year: "2-digit" } : { month: "short" });
}

function percent(value) {
  return value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;
}

function changeText(value, period) {
  if (value === null || value === undefined) return `No sales in the previous ${period}`;
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}% vs previous ${period}`;
}

function MarginChart({ months }) {
  const [hovered, setHovered] = useState(null);
  const max = niceMax(Math.max(...months.map((month) => month.revenue), 0));
  const ticks = axisTicks(max);
  const spansYears = new Set(months.map((month) => month.month.slice(0, 4))).size > 1;
  const labelEvery = months.length > 12 ? Math.ceil(months.length / 12) : 1;

  return (
    <Card>
      <CardHeader
        title="Revenue by month"
        description="Each bar is cost plus margin, excluding VAT and net of returns"
        actions={
          <div className="flex items-center gap-4 text-xs app-text-secondary" aria-label="Legend">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "var(--series-margin)" }} /> Margin
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "var(--series-cost)" }} /> Cost
            </span>
          </div>
        }
      />
      <div className="px-5 pb-5 pt-6">
        <div className="relative h-[260px] pl-14">
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute left-14 right-0 border-t"
              style={{ bottom: `${(tick / max) * 100}%`, borderColor: tick === 0 ? "var(--border-strong)" : "var(--chart-grid)", borderStyle: tick === 0 ? "solid" : "dashed" }}
            >
              <span className="absolute -left-14 -translate-y-1/2 pr-2 text-right text-[11px] tabular-nums app-text-muted" style={{ width: 52 }}>
                {compactMoney(tick).replace(" MAD", "")}
              </span>
            </div>
          ))}

          <div className="relative flex h-full items-end gap-1 sm:gap-2">
            {months.map((month, index) => {
              const cost = Math.max(0, month.cost);
              const margin = Math.max(0, month.margin);
              const isHovered = hovered === index;
              return (
                <div
                  key={month.month}
                  className="relative flex h-full flex-1 cursor-default items-end justify-center"
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(index)}
                  onBlur={() => setHovered(null)}
                  tabIndex={0}
                  aria-label={`${monthLabel(month.month, true)}: revenue ${money(month.revenue)}, cost ${money(month.cost)}, margin ${money(month.margin)} (${percent(month.margin_percent)})`}
                >
                  {isHovered && <div className="absolute inset-0 rounded-lg" style={{ backgroundColor: "var(--surface-hover)", opacity: 0.6 }} />}
                  <div className="relative flex w-full max-w-12 flex-col justify-end" style={{ height: "100%", opacity: hovered === null || isHovered ? 1 : 0.45 }}>
                    {margin > 0 && (
                      <div
                        className="w-full rounded-t-[4px] transition-all duration-500"
                        style={{ height: `${(margin / max) * 100}%`, backgroundColor: "var(--series-margin)", borderBottom: cost > 0 ? "2px solid var(--surface)" : undefined }}
                      />
                    )}
                    {cost > 0 && (
                      <div
                        className={`w-full transition-all duration-500 ${margin > 0 ? "" : "rounded-t-[4px]"}`}
                        style={{ height: `${(cost / max) * 100}%`, backgroundColor: "var(--series-cost)" }}
                      />
                    )}
                  </div>
                  {isHovered && (
                    <div
                      className="pointer-events-none absolute z-10 w-max min-w-44 rounded-lg border px-3 py-2 text-xs animate-fade-in"
                      style={{
                        bottom: `calc(${Math.max((month.revenue / max) * 100, 4)}% + 10px)`,
                        ...(index > months.length / 2 ? { right: 0 } : { left: 0 }),
                        backgroundColor: "var(--surface)",
                        borderColor: "var(--border-color)",
                        boxShadow: "var(--pop-shadow)",
                      }}
                    >
                      <p className="mb-1 font-semibold app-text">{monthLabel(month.month, true)}</p>
                      {[
                        ["Revenue", money(month.revenue), null],
                        ["Margin", `${money(month.margin)} (${percent(month.margin_percent)})`, "var(--series-margin)"],
                        ["Cost", money(month.cost), "var(--series-cost)"],
                        ["Orders", number(month.orders), null],
                      ].map(([label, value, color]) => (
                        <p key={label} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 app-text-secondary">
                            {color && <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />}
                            {label}
                          </span>
                          <span className="font-semibold tabular-nums app-text">{value}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  {index % labelEvery === 0 && (
                    <span className="absolute -bottom-6 text-[11px] app-text-muted">{monthLabel(month.month, spansYears)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="h-6" />
      </div>
    </Card>
  );
}

function Breakdown({ report }) {
  const toast = useToast();
  const [dimension, setDimension] = useState("product");
  const [search, setSearch] = useState("");
  const rows = useMemo(() => report[DIMENSIONS[dimension].key] ?? [], [report, dimension]);
  const showDiscounts = rows.some((row) => row.discounts > 0);
  const total = report.totals.revenue;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? rows.filter((row) => String(row.label ?? "").toLowerCase().includes(term)) : rows;
  }, [rows, search]);
  const table = useTable(filtered, { accessors, initialSort: { key: "revenue", direction: "desc" } });

  function handleExport() {
    exportCsv(
      `sales-by-${dimension}-${report.range.from}-to-${report.range.to}`,
      [
        [DIMENSIONS[dimension].noun, (row) => row.label],
        ["Orders", (row) => row.orders],
        ["Units", (row) => row.units],
        ["Revenue (MAD, HT)", (row) => row.revenue],
        ["Cost (MAD)", (row) => row.cost],
        ["Margin (MAD)", (row) => row.margin],
        ["Margin %", (row) => row.margin_percent ?? ""],
        ["Returns (MAD, HT)", (row) => row.returns],
        ["Discounts (MAD)", (row) => row.discounts],
      ],
      table.sorted
    );
    toast.info(`Exported ${table.sorted.length} rows to CSV.`);
  }

  const linkFor = (row) =>
    dimension === "customer" ? `/customers?view=${row.id}` : dimension === "product" ? `/products?q=${encodeURIComponent(row.label)}` : null;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b p-4" style={{ borderColor: "var(--border-color)" }}>
        <SegmentedControl
          label="Group sales by"
          value={dimension}
          onChange={(value) => {
            setDimension(value);
            setSearch("");
            table.setPage(1);
          }}
          options={Object.entries(DIMENSIONS).map(([value, meta]) => ({ value, label: meta.label, count: (report[meta.key] ?? []).length }))}
        />
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            table.setPage(1);
          }}
          placeholder={`Search ${DIMENSIONS[dimension].label.toLowerCase()}...`}
          className="sm:w-64"
        />
        <Button icon="download" onClick={handleExport} disabled={filtered.length === 0} className="ml-auto">
          Export
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="search" title={rows.length ? "Nothing matches" : "No sales in this period"} description={rows.length ? "Try another search." : "Pick a longer date range."} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <TableHead>
              <SortHeader label={DIMENSIONS[dimension].noun} column="label" sort={table.sort} onSort={table.toggleSort} />
              <SortHeader label="Units" column="units" sort={table.sort} onSort={table.toggleSort} align="right" />
              <SortHeader label="Revenue" column="revenue" sort={table.sort} onSort={table.toggleSort} align="right" />
              <Th className="hidden 2xl:table-cell">Share</Th>
              <SortHeader label="Margin" column="margin" sort={table.sort} onSort={table.toggleSort} align="right" />
              <SortHeader label="Margin %" column="margin_percent" sort={table.sort} onSort={table.toggleSort} align="right" />
              <SortHeader label="Returns" column="returns" sort={table.sort} onSort={table.toggleSort} align="right" />
              {showDiscounts && <Th align="right">Discounts</Th>}
            </TableHead>
            <tbody>
              {table.rows.map((row) => {
                const share = total > 0 ? (row.revenue / total) * 100 : 0;
                const low = row.margin_percent !== null && row.margin_percent < LOW_MARGIN;
                const link = linkFor(row);
                return (
                  <tr key={row.id ?? "none"} className="border-t transition-colors hover:bg-[var(--surface-hover)]" style={{ borderColor: "var(--border-color)" }}>
                    <td className="max-w-[240px] px-5 py-3">
                      {link ? (
                        <Link to={link} className="block truncate font-medium hover:underline app-text">
                          {row.label ?? "Uncategorized"}
                        </Link>
                      ) : (
                        <p className="truncate font-medium app-text">{row.label ?? "Uncategorized"}</p>
                      )}
                      <p className="truncate text-xs app-text-muted">
                        {[row.category_name, row.city, row.products !== undefined && `${row.products} products`, `${number(row.orders)} orders`].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums app-text-secondary">{number(row.units)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums app-text">{money(row.revenue)}</td>
                    <td className="hidden px-5 py-3 2xl:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-muted)" }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, share)}%`, backgroundColor: "var(--series-margin)" }} />
                        </div>
                        <span className="text-xs tabular-nums app-text-muted">{share.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums app-text">{money(row.margin)}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums">
                      <span className={low ? "inline-flex items-center gap-1 font-semibold" : "app-text-secondary"} style={low ? { color: "var(--warning)" } : undefined}>
                        {low && <Icon name="alert" size={13} />}
                        {percent(row.margin_percent)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums app-text-muted">{row.returns > 0 ? money(row.returns) : "—"}</td>
                    {showDiscounts && <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums app-text-muted">{row.discounts > 0 ? money(row.discounts) : "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > 0 && (
        <Pagination page={table.page} totalPages={table.totalPages} total={table.total} pageSize={table.pageSize} onPageChange={table.setPage} label={DIMENSIONS[dimension].label.toLowerCase()} />
      )}
    </Card>
  );
}

export default function Reports() {
  const [params, setParams] = useSearchParams();
  const preset = PRESETS.find((option) => option.value === (params.get("period") ?? "90"));
  const range = preset ? preset.range() : { from: params.get("from") ?? daysAgo(89), to: params.get("to") ?? localDateInput() };
  const [draft, setDraft] = useState(range);

  const { data, loading, error, reload } = useResource(`/reports/sales?from=${range.from}&to=${range.to}`);
  const report = data?.data;
  const period = report ? `${report.range.days} days` : "period";

  function choosePreset(value) {
    if (value === "custom") {
      setParams({ period: "custom", from: range.from, to: range.to }, { replace: true });
      setDraft(range);
      return;
    }
    setParams({ period: value }, { replace: true });
  }

  function applyCustom(event) {
    event.preventDefault();
    if (draft.from && draft.to) setParams({ period: "custom", from: draft.from, to: draft.to }, { replace: true });
  }

  const totals = report?.totals;
  const grossSales = totals ? totals.revenue + totals.returns : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Sales from orders that weren't cancelled, by order date. Excluding VAT, net of returns."
        actions={<Button size="icon" variant="ghost" icon="refresh" onClick={reload} aria-label="Refresh" title="Refresh" className={loading ? "[&_svg]:animate-spin" : ""} />}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Period"
          value={preset?.value ?? "custom"}
          onChange={choosePreset}
          options={[...PRESETS.map(({ value, label }) => ({ value, label })), { value: "custom", label: "Custom" }]}
        />
        {!preset && (
          <form onSubmit={applyCustom} className="flex flex-wrap items-center gap-2">
            <input type="date" value={draft.from} max={draft.to} onChange={(event) => setDraft((d) => ({ ...d, from: event.target.value }))} className="app-input h-10 w-auto" aria-label="From" />
            <span className="text-sm app-text-muted">to</span>
            <input type="date" value={draft.to} min={draft.from} max={localDateInput()} onChange={(event) => setDraft((d) => ({ ...d, to: event.target.value }))} className="app-input h-10 w-auto" aria-label="To" />
            <Button type="submit">Apply</Button>
          </form>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}

      {!report ? (
        !error && (
          <div className="space-y-6" aria-busy="true">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="skeleton h-32 rounded-2xl" />
              ))}
            </div>
            <div className="skeleton h-80 rounded-2xl" />
            <TableSkeleton columns={6} />
          </div>
        )
      ) : (
        <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Revenue" value={compactMoney(totals.revenue)} hint={changeText(report.changes.revenue, period)} icon="revenue" tone="primary" />
            <StatCard
              label="Gross margin"
              value={compactMoney(totals.margin)}
              hint={`${percent(totals.margin_percent)} of revenue, ${changeText(report.changes.margin, period).toLowerCase()}`}
              icon="wallet"
              tone="success"
            />
            <StatCard
              label="Orders"
              value={number(totals.orders)}
              hint={`${totals.orders ? money(totals.revenue / totals.orders) : money(0)} average, ${changeText(report.changes.orders, period).toLowerCase()}`}
              icon="orders"
              tone="info"
            />
            <StatCard
              label="Returns"
              value={compactMoney(totals.returns)}
              hint={`${grossSales > 0 ? ((totals.returns / grossSales) * 100).toFixed(1) : "0.0"}% of sales`}
              icon="undo"
              tone="warning"
            />
          </div>

          <MarginChart months={report.monthly} />
          <Breakdown report={report} />
        </div>
      )}
    </div>
  );
}
