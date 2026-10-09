import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { Drawer, Modal } from "../components/ui/Modal";
import { useConfirm, useToast } from "../components/ui/feedback";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Field,
  IconAction,
  InlineAlert,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedControl,
  SortHeader,
  StatCard,
  TableHead,
  TableSkeleton,
  Th,
  toneStyle,
} from "../components/ui/primitives";
import { api, can, compactMoney, exportCsv, formatDate, initials, money, number, timeAgo, toList, useActiveProducts, useResource } from "../lib/api";
import { localDateInput } from "../lib/billing";
import { usePrices } from "../lib/pricing";
import { QUOTE_STATUS, QUOTE_STATUS_ORDER, validityLabel } from "../lib/quoteStatus";
import company from "../config/company";
import useTable from "../lib/useTable";

const accessors = {
  id: (quote) => quote.id,
  customer: (quote) => quote.company_name,
  created: (quote) => new Date(quote.created_at).getTime(),
  valid: (quote) => quote.valid_until,
  total: (quote) => quote.total_amount,
  status: (quote) => QUOTE_STATUS_ORDER.indexOf(quote.status),
};

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function daysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

let lineCounter = 0;
const newLine = (values = {}) => {
  lineCounter += 1;
  return { key: lineCounter, product_id: "", quantity: "1", unit_price: "", ...values };
};

function StatusBadge({ status }) {
  const meta = QUOTE_STATUS[status] ?? QUOTE_STATUS.Draft;
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {status}
    </Badge>
  );
}

function QuoteBuilder({ open, onClose, editing, initialCustomerId, onSaved }) {
  const customersResource = useResource(open ? "/customers" : null);
  const customers = toList(customersResource.data);
  const { products, loading: productsLoading } = useActiveProducts(open);

  const [form, setForm] = useState({ customer_id: "", valid_until: "", notes: "" });
  const [lines, setLines] = useState([newLine()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const prepareKey = open ? `${editing?.id ?? "new"}:${initialCustomerId ?? ""}` : null;
  const [preparedFor, setPreparedFor] = useState(null);
  if (prepareKey !== preparedFor) {
    setPreparedFor(prepareKey);
    if (prepareKey) {
      const defaultValidity = new Date();
      defaultValidity.setDate(defaultValidity.getDate() + 30);
      setForm({
        customer_id: String(editing?.customer_id ?? initialCustomerId ?? ""),
        valid_until: editing?.valid_until && editing.valid_until >= localDateInput() ? editing.valid_until : localDateInput(defaultValidity),
        notes: editing?.notes ?? "",
      });
      setLines(
        editing?.items?.length
          ? editing.items.map((item) => newLine({ product_id: String(item.product_id), quantity: String(item.quantity), unit_price: String(Number(item.unit_price)) }))
          : [newLine()]
      );
      setError("");
    }
  }

  const productById = new Map(products.map((product) => [String(product.id), product]));
  const chosen = new Set(lines.map((line) => line.product_id).filter(Boolean));
  const { prices } = usePrices("/pricing/preview", form.customer_id, lines);
  const customerPrice = (product) => prices.get(product.id)?.unit_price ?? Number(product.price);

  const summary = lines.reduce(
    (acc, line) => {
      const product = productById.get(line.product_id);
      if (!product) return acc;
      const quantity = Number(line.quantity) || 0;
      const price = line.unit_price === "" ? customerPrice(product) : Number(line.unit_price) || 0;
      acc.list += Number(product.price) * quantity;
      acc.subtotal += price * quantity;
      return acc;
    },
    { list: 0, subtotal: 0 }
  );
  const subtotal = round2(summary.subtotal);
  const vat = round2(subtotal * company.vatRate);
  const savings = round2(summary.list - subtotal);
  const selectedCustomer = customers.find((customer) => String(customer.id) === form.customer_id);

  function updateLine(key, changes) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...changes } : line)));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const items = lines
      .filter((line) => line.product_id)
      .map((line) => ({
        product_id: Number(line.product_id),
        quantity: Number(line.quantity),
        unit_price: line.unit_price === "" ? undefined : round2(line.unit_price),
      }));

    if (!form.customer_id) return setError("Choose a customer.");
    if (items.length === 0) return setError("Add at least one product.");
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) return setError("Quantities must be whole numbers of 1 or more.");
    if (items.some((item) => item.unit_price !== undefined && (!Number.isFinite(item.unit_price) || item.unit_price < 0))) return setError("Prices can't be negative.");

    setSaving(true);
    try {
      const body = { customer_id: Number(form.customer_id), valid_until: form.valid_until, notes: form.notes, items };
      const result = editing
        ? await api(`/quotes/${editing.id}`, { method: "PUT", body })
        : await api("/quotes", { method: "POST", body });
      onSaved(editing?.id ?? result.data?.quoteId, Boolean(editing));
    } catch (err) {
      setError(err.message || "Could not save the quote.");
    } finally {
      setSaving(false);
    }
  }

  const loading = (customersResource.loading && !customersResource.data) || (productsLoading && products.length === 0);

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      busy={saving}
      size="xl"
      icon="fileText"
      eyebrow={editing ? editing.number : "New quote"}
      title={editing ? "Edit draft quote" : "Create a quote"}
      description="Leave a price empty to use the customer's price."
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="quote-form" variant="primary" icon="check" loading={saving} disabled={chosen.size === 0 || !form.customer_id}>
            {editing ? "Save draft" : "Create draft"} · {money(subtotal)} HT
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            <div className="skeleton h-11" />
            <div className="skeleton h-20" />
            <div className="skeleton h-20" />
          </div>
          <div className="skeleton h-64 rounded-xl" />
        </div>
      ) : (
        <form id="quote-form" onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0 space-y-5">
            <InlineAlert>{error}</InlineAlert>

            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Field label="Customer" required>
                {(id) => (
                  <select id={id} value={form.customer_id} onChange={(event) => setForm((f) => ({ ...f, customer_id: event.target.value }))} required className="app-input">
                    <option value="">Select a customer...</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.company_name}
                        {customer.city ? `, ${customer.city}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Valid until" required>
                {(id) => (
                  <input
                    id={id}
                    type="date"
                    value={form.valid_until}
                    min={localDateInput()}
                    max={localDateInput(daysFromToday(365))}
                    onChange={(event) => setForm((f) => ({ ...f, valid_until: event.target.value }))}
                    required
                    className="app-input"
                  />
                )}
              </Field>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium app-text">
                  Lines <span style={{ color: "var(--danger)" }}>*</span>
                </p>
                <Button size="sm" variant="ghost" icon="plus" onClick={() => setLines((current) => [...current, newLine()])} disabled={chosen.size >= products.length}>
                  Add line
                </Button>
              </div>

              <div className="space-y-2">
                {lines.map((line, index) => {
                  const product = productById.get(line.product_id);
                  const listPrice = product ? Number(product.price) : null;
                  const rule = product ? prices.get(product.id) : null;
                  const price = line.unit_price === "" ? (product ? customerPrice(product) : null) : Number(line.unit_price);
                  const discount = listPrice > 0 && price !== null ? 1 - price / listPrice : 0;

                  return (
                    <div
                      key={line.key}
                      className="grid grid-cols-2 gap-2 rounded-xl border p-3 animate-fade-in sm:grid-cols-[1fr_84px_130px_auto] sm:items-start"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      <div className="col-span-2 min-w-0 sm:col-span-1">
                        <select
                          value={line.product_id}
                          onChange={(event) => {
                            updateLine(line.key, { product_id: event.target.value, unit_price: "" });
                          }}
                          aria-label={`Product for line ${index + 1}`}
                          className="app-input"
                        >
                          <option value="">Select a product...</option>
                          {products.map((option) => (
                            <option key={option.id} value={option.id} disabled={chosen.has(String(option.id)) && String(option.id) !== line.product_id}>
                              {option.name} · {money(option.price)}
                            </option>
                          ))}
                        </select>
                        {product && (
                          <p className="mt-1.5 text-xs app-text-muted">
                            List {money(listPrice)} · {product.stock} in stock
                            {discount > 0.0005 && (
                              <span className="ml-1.5 font-semibold" style={{ color: "var(--success)" }}>
                                −{Math.round(discount * 1000) / 10}% discount
                              </span>
                            )}
                            {line.unit_price === "" && rule?.label && <span className="ml-1.5">({rule.label})</span>}
                            {discount < -0.0005 && (
                              <span className="ml-1.5 font-semibold" style={{ color: "var(--warning)" }}>
                                above list price
                              </span>
                            )}
                          </p>
                        )}
                      </div>

                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                        aria-label={`Quantity for line ${index + 1}`}
                        className="app-input text-center tabular-nums"
                      />

                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_price}
                          onChange={(event) => updateLine(line.key, { unit_price: event.target.value })}
                          placeholder={product ? String(customerPrice(product)) : "Price"}
                          aria-label={`Unit price for line ${index + 1}`}
                          disabled={!product}
                          className="app-input pr-11 text-right tabular-nums"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold app-text-muted">MAD</span>
                      </div>

                      <IconAction
                        icon="trash"
                        label={`Remove line ${index + 1}`}
                        tone="danger"
                        disabled={lines.length === 1}
                        onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <Field label="Notes for the customer" hint={`${form.notes.length}/1000 · printed on the quote`}>
              {(id) => (
                <textarea
                  id={id}
                  value={form.notes}
                  onChange={(event) => setForm((f) => ({ ...f, notes: event.target.value }))}
                  rows={2}
                  maxLength={1000}
                  placeholder="Delivery terms, installation, conditions..."
                  className="app-input resize-y"
                />
              )}
            </Field>
          </div>

          <aside className="h-fit rounded-xl border p-5 lg:sticky lg:top-0" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface-muted)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider app-text-muted">Quote summary</p>
            <div className="mt-4 flex items-center gap-3">
              {selectedCustomer ? (
                <>
                  <Avatar label={initials(selectedCustomer.company_name)} seed={selectedCustomer.id} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold app-text">{selectedCustomer.company_name}</p>
                    <p className="truncate text-xs app-text-muted">{selectedCustomer.contact_name}</p>
                  </div>
                </>
              ) : (
                <p className="text-sm app-text-muted">No customer selected</p>
              )}
            </div>
            <dl className="mt-5 space-y-2 border-t pt-4 text-sm" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex justify-between">
                <dt className="app-text-secondary">List price total</dt>
                <dd className="tabular-nums app-text">{money(summary.list)}</dd>
              </div>
              {savings > 0 && (
                <div className="flex justify-between">
                  <dt className="app-text-secondary">Discount</dt>
                  <dd className="font-semibold tabular-nums" style={{ color: "var(--success)" }}>
                    −{money(savings)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="app-text-secondary">Subtotal (HT)</dt>
                <dd className="font-semibold tabular-nums app-text">{money(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="app-text-secondary">VAT {Math.round(company.vatRate * 100)}%</dt>
                <dd className="tabular-nums app-text">{money(vat)}</dd>
              </div>
            </dl>
            <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <p className="text-xs app-text-secondary">Total (TTC)</p>
              <p className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums app-text">{money(round2(subtotal + vat))}</p>
              <p className="mt-2 text-xs app-text-muted">Saved as a draft. You can still edit it until it's sent.</p>
            </div>
          </aside>
        </form>
      )}
    </Modal>
  );
}

function Timeline({ quote }) {
  const decidedLabel = quote.status === "Rejected" ? "Rejected" : quote.status === "Expired" ? "Expired" : "Accepted";
  const steps = [
    { label: "Created", at: quote.created_at, done: true },
    { label: "Sent", at: quote.sent_at, done: Boolean(quote.sent_at) },
    {
      label: decidedLabel,
      at: quote.decided_at ?? (quote.status === "Expired" ? `${quote.valid_until}T23:59:00` : null),
      done: ["Accepted", "Rejected", "Converted", "Expired"].includes(quote.status),
      bad: ["Rejected", "Expired"].includes(quote.status),
    },
    { label: "Converted", at: quote.converted_at, done: quote.status === "Converted" },
  ];

  return (
    <ol className="flex items-start">
      {steps.map((step, index) => (
        <li key={step.label} className="relative flex flex-1 flex-col items-center text-center">
          {index < steps.length - 1 && (
            <span className="absolute left-1/2 top-4 h-0.5 w-full" style={{ backgroundColor: steps[index + 1].done && !steps[index + 1].bad ? "var(--success)" : "var(--border-color)" }} />
          )}
          <span
            className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2"
            style={
              step.done
                ? { borderColor: step.bad ? "var(--danger)" : "var(--success)", ...toneStyle(step.bad ? "danger" : "success") }
                : { borderColor: "var(--border-color)", backgroundColor: "var(--surface)", color: "var(--text-muted)" }
            }
          >
            <Icon name={step.bad ? "close" : step.done ? "check" : "clock"} size={15} strokeWidth={2.2} />
          </span>
          <span className={`mt-2 text-xs font-semibold ${step.done ? "app-text" : "app-text-muted"}`}>{step.label}</span>
          {step.done && step.at && <span className="text-[11px] app-text-muted">{formatDate(step.at)}</span>}
        </li>
      ))}
    </ol>
  );
}

const actionButtons = {
  edit: { label: "Edit", icon: "edit" },
  send: { label: "Mark as sent", icon: "send", variant: "primary" },
  accept: { label: "Accept", icon: "checkCircle", variant: "primary" },
  reject: { label: "Reject", icon: "thumbsDown", variant: "danger-ghost" },
  convert: { label: "Convert to order", icon: "orders", variant: "primary" },
  duplicate: { label: "Duplicate", icon: "copy" },
  delete: { label: "Delete", icon: "trash", variant: "danger-ghost" },
};

function QuoteDrawer({ quoteId, version, open, onClose, onAction, busy, canWrite }) {
  const { data, loading, error } = useResource(quoteId ? `/quotes/${quoteId}?v=${version}` : null);
  const quote = data?.data;
  const items = quote?.items ?? [];

  const stockProblems = quote?.status === "Accepted"
    ? items.filter((item) => !item.product_active || item.current_stock < item.quantity)
    : [];
  const listTotal = items.reduce((sum, item) => sum + Number(item.list_price) * item.quantity, 0);
  const savings = quote ? round2(listTotal - quote.total_amount) : 0;
  const actions = canWrite ? quote?.actions ?? [] : [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={quote?.number ?? (quoteId ? `Quote #${quoteId}` : "")}
      description={quote ? `${quote.company_name} · created ${timeAgo(quote.created_at)}` : "Loading..."}
      icon="fileText"
      footer={
        quote && (
          <>
            {actions.includes("delete") && (
              <Button variant="danger-ghost" icon="trash" onClick={() => onAction("delete", quote)} disabled={busy} className="mr-auto">
                Delete
              </Button>
            )}
            {actions.includes("reject") && (
              <Button variant="danger-ghost" icon="thumbsDown" onClick={() => onAction("reject", quote)} disabled={busy} className="mr-auto">
                Reject
              </Button>
            )}
            <a
              href={`/quotes/${quote.id}/print`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--control-radius)] border px-4 text-sm font-semibold transition hover:bg-[var(--surface-hover)] app-text"
              style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface)" }}
            >
              <Icon name="download" size={17} /> Print
            </a>
            {["duplicate", "edit", "send", "accept", "convert"]
              .filter((action) => actions.includes(action))
              .map((action) => (
                <Button
                  key={action}
                  variant={actionButtons[action].variant ?? "secondary"}
                  icon={actionButtons[action].icon}
                  onClick={() => onAction(action, quote)}
                  loading={busy === action}
                  disabled={Boolean(busy) || (action === "convert" && stockProblems.length > 0)}
                >
                  {actionButtons[action].label}
                </Button>
              ))}
          </>
        )
      }
    >
      {error ? (
        <ErrorState message={error} />
      ) : loading && !quote ? (
        <div className="space-y-4">
          <div className="skeleton h-24 rounded-xl" />
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-48 rounded-xl" />
        </div>
      ) : (
        quote && (
          <div className="space-y-6">
            <div className="rounded-xl border p-5" style={{ borderColor: "var(--border-color)" }}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <StatusBadge status={quote.status} />
                <span className="text-xs app-text-secondary">{QUOTE_STATUS[quote.status]?.description}</span>
              </div>
              <Timeline quote={quote} />
            </div>

            {quote.status === "Converted" && quote.order_id && (
              <Link
                to={`/orders?view=${quote.order_id}`}
                className="flex items-center gap-3 rounded-xl border p-4 transition hover:bg-[var(--surface-hover)]"
                style={{ borderColor: "var(--border-color)", ...toneStyle("info") }}
              >
                <Icon name="orders" size={20} />
                <span className="flex-1 text-sm font-semibold">Converted into order #{quote.order_id}</span>
                <Icon name="chevronRight" size={18} />
              </Link>
            )}

            {stockProblems.length > 0 && (
              <InlineAlert>
                Can't convert yet:{" "}
                {stockProblems
                  .map((item) => (item.product_active ? `${item.product_name} (${item.current_stock} in stock, ${item.quantity} quoted)` : `${item.product_name} is inactive`))
                  .join("; ")}
                .
              </InlineAlert>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Link
                to={`/customers?view=${quote.customer_id}`}
                className="col-span-2 flex items-center gap-3 rounded-xl border p-4 transition hover:bg-[var(--surface-hover)] sm:col-span-1"
                style={{ borderColor: "var(--border-color)" }}
              >
                <Avatar label={initials(quote.company_name)} seed={quote.customer_id} size={36} />
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide app-text-muted">Customer</p>
                  <p className="truncate text-sm font-semibold app-text">{quote.company_name}</p>
                </div>
              </Link>
              <div className="col-span-2 rounded-xl border p-4 sm:col-span-1" style={{ borderColor: "var(--border-color)" }}>
                <p className="text-xs font-medium uppercase tracking-wide app-text-muted">Valid until</p>
                <p className="text-sm font-semibold app-text">{formatDate(`${quote.valid_until}T00:00:00`)}</p>
                {validityLabel(quote) && (
                  <p className="text-xs font-medium" style={{ color: quote.days_left < 0 ? "var(--warning)" : quote.days_left <= 3 ? "var(--danger)" : "var(--text-muted)" }}>
                    {validityLabel(quote)}
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-bold app-text">
                Lines <span className="font-normal app-text-muted">({items.length})</span>
              </h3>
              <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
                <table className="w-full text-left text-sm">
                  <TableHead>
                    <Th className="!px-4">Product</Th>
                    <Th className="!px-4" align="right">Qty</Th>
                    <Th className="!px-4" align="right">Amount</Th>
                  </TableHead>
                  <tbody>
                    {items.map((item) => {
                      const discount = Number(item.list_price) > 0 ? 1 - Number(item.unit_price) / Number(item.list_price) : 0;
                      return (
                        <tr key={item.product_id} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                          <td className="px-4 py-3">
                            <p className="font-medium app-text">{item.product_name}</p>
                            <p className="text-xs app-text-muted">
                              {money(item.unit_price)} each
                              {discount > 0.0005 && (
                                <span className="ml-1.5 font-semibold" style={{ color: "var(--success)" }}>
                                  −{Math.round(discount * 1000) / 10}% off {money(item.list_price)}
                                </span>
                              )}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums app-text">×{item.quantity}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums app-text">{money(item.subtotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <dl className="space-y-1.5 border-t px-4 py-3.5 text-sm" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface-muted)" }}>
                  {savings > 0.004 && (
                    <div className="flex justify-between">
                      <dt className="app-text-secondary">Discount vs list price</dt>
                      <dd className="font-semibold tabular-nums" style={{ color: "var(--success)" }}>
                        −{money(savings)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="app-text-secondary">Subtotal (HT)</dt>
                    <dd className="tabular-nums app-text">{money(quote.total_amount)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="app-text-secondary">VAT</dt>
                    <dd className="tabular-nums app-text">{money(quote.vat)}</dd>
                  </div>
                  <div className="flex justify-between pt-1 text-base">
                    <dt className="font-semibold app-text">Total (TTC)</dt>
                    <dd className="font-bold tabular-nums app-text">{money(quote.total_with_vat)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {quote.notes && (
              <div>
                <h3 className="mb-2 text-sm font-bold app-text">Notes</h3>
                <p className="rounded-xl p-4 text-sm app-muted app-text-secondary">{quote.notes}</p>
              </div>
            )}
          </div>
        )
      )}
    </Drawer>
  );
}

export default function Quotes() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const canWrite = can(user, "quotes.write");

  const { data, loading, error, reload } = useResource("/quotes");
  const quotes = useMemo(() => toList(data), [data]);

  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(null);
  const [drawerVersion, setDrawerVersion] = useState(0);
  const [builder, setBuilder] = useState({ open: false, editing: null });

  const viewId = params.get("view");
  const [lastViewId, setLastViewId] = useState(viewId);
  if (viewId && viewId !== lastViewId) setLastViewId(viewId);

  const createRequested = params.get("new") === "1" && canWrite;

  function updateParams(changes) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  }

  const counts = useMemo(() => {
    const result = { All: quotes.length };
    for (const name of QUOTE_STATUS_ORDER) result[name] = quotes.filter((quote) => quote.status === name).length;
    return result;
  }, [quotes]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quotes.filter(
      (quote) =>
        (status === "All" || quote.status === status) &&
        (!term || quote.number.toLowerCase().includes(term) || String(quote.id) === term.replace(/^#/, "") || quote.company_name.toLowerCase().includes(term))
    );
  }, [quotes, status, search]);

  const table = useTable(filtered, { accessors, initialSort: { key: "created", direction: "desc" } });

  const open = quotes.filter((quote) => quote.status === "Sent" || quote.status === "Accepted");
  const pipeline = open.reduce((sum, quote) => sum + quote.total_with_vat, 0);
  const yearAgo = daysFromToday(-365).getTime();
  const decided = quotes.filter((quote) => ["Converted", "Rejected", "Expired"].includes(quote.status) && new Date(quote.created_at).getTime() >= yearAgo);
  const won = decided.filter((quote) => quote.status === "Converted").length;
  const expiringSoon = quotes.filter((quote) => quote.status === "Sent" && quote.days_left <= 7).length;

  async function handleAction(action, quote) {
    if (action === "edit") {
      setBuilder({ open: true, editing: quote });
      return;
    }

    const confirmations = {
      send: { title: `Mark ${quote.number} as sent?`, message: "The quote will be locked for editing while the customer decides.", confirmLabel: "Mark as sent", tone: "primary", icon: "send" },
      accept: { title: `Accept ${quote.number}?`, message: `${quote.company_name} accepted the offer of ${money(quote.total_with_vat)} (TTC). You can then convert it into an order.`, confirmLabel: "Mark accepted", tone: "primary", icon: "checkCircle" },
      reject: { title: `Reject ${quote.number}?`, message: "Record that the customer declined this offer. You can duplicate it later to make a new one.", confirmLabel: "Mark rejected" },
      convert: { title: `Convert ${quote.number} into an order?`, message: `This creates a Pending order for ${quote.company_name} at the quoted prices and reserves the stock.`, confirmLabel: "Create order", tone: "primary", icon: "orders" },
      delete: { title: `Delete ${quote.number}?`, message: "This draft will be permanently removed.", confirmLabel: "Delete draft" },
    };

    if (confirmations[action] && !(await confirm(confirmations[action]))) return;

    setBusy(action);
    try {
      const path = action === "delete" ? `/quotes/${quote.id}` : `/quotes/${quote.id}/${action}`;
      const result = await api(path, { method: action === "delete" ? "DELETE" : "POST" });

      reload();
      setDrawerVersion((value) => value + 1);

      if (action === "convert") {
        toast.success(`Order #${result.data.orderId} created from ${quote.number}.`, { title: "Quote converted" });
        navigate(`/orders?view=${result.data.orderId}`);
      } else if (action === "duplicate") {
        toast.success("A new draft was created with the same lines.", { title: "Quote duplicated" });
        updateParams({ view: result.data.quoteId });
      } else if (action === "delete") {
        toast.success(`${quote.number} was deleted.`);
        updateParams({ view: null });
      } else {
        toast.success(result.message);
      }
    } catch (err) {
      toast.error(err.message || "The action failed.", { title: "Quote not updated" });
    } finally {
      setBusy(null);
    }
  }

  function closeBuilder() {
    setBuilder({ open: false, editing: null });
    if (createRequested) updateParams({ new: null, customer: null });
  }

  function handleExport() {
    exportCsv(
      "quotes",
      [
        ["Quote", (q) => q.number],
        ["Customer", (q) => q.company_name],
        ["Status", (q) => q.status],
        ["Created", (q) => q.created_at],
        ["Valid until", (q) => q.valid_until],
        ["Lines", (q) => q.item_count],
        ["Subtotal HT (MAD)", (q) => q.total_amount],
        ["Total TTC (MAD)", (q) => q.total_with_vat],
        ["Order", (q) => q.order_id ?? ""],
      ],
      table.sorted
    );
    toast.info(`Exported ${table.sorted.length} quotes to CSV.`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotes"
        actions={
          <>
            <Button icon="download" onClick={handleExport} disabled={filtered.length === 0}>
              Export
            </Button>
            {canWrite && (
              <Button variant="primary" icon="plus" onClick={() => setBuilder({ open: true, editing: null })}>
                New quote
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open pipeline" value={compactMoney(pipeline)} hint={`${open.length} sent or accepted quotes (TTC)`} icon="fileText" tone="primary" loading={loading && !data} />
        <StatCard
          label="Win rate"
          value={decided.length ? `${Math.round((won / decided.length) * 100)}%` : "—"}
          hint={`${won} of ${decided.length} decided quotes, last 12 months`}
          icon="revenue"
          tone="success"
          loading={loading && !data}
          onClick={() => setStatus("Converted")}
        />
        <StatCard label="Awaiting answer" value={number(counts.Sent ?? 0)} hint={`${expiringSoon} expire within 7 days`} icon="send" tone="warning" loading={loading && !data} onClick={() => setStatus("Sent")} />
        <StatCard label="Ready to convert" value={number(counts.Accepted ?? 0)} hint="Accepted, no order yet" icon="checkCircle" tone="info" loading={loading && !data} onClick={() => setStatus("Accepted")} />
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}

      <Card>
        <div className="space-y-3 border-b p-4" style={{ borderColor: "var(--border-color)" }}>
          <SegmentedControl
            label="Filter by status"
            value={status}
            onChange={(value) => {
              setStatus(value);
              table.setPage(1);
            }}
            options={["All", ...QUOTE_STATUS_ORDER].map((name) => ({ value: name, label: name, count: counts[name] ?? 0 }))}
          />
          <div className="flex items-center gap-3">
            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value);
                table.setPage(1);
              }}
              placeholder="Search quote number or customer..."
              className="sm:w-80"
            />
            <Button size="icon" variant="ghost" icon="refresh" onClick={reload} aria-label="Refresh" title="Refresh" className={`ml-auto ${loading ? "[&_svg]:animate-spin" : ""}`} />
          </div>
        </div>

        {loading && !data ? (
          <TableSkeleton columns={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={quotes.length ? "search" : "fileText"}
            title={quotes.length ? "No quotes match" : "No quotes yet"}
            description={quotes.length ? "Try another status or search." : "Create your first quote to start building a pipeline."}
            action={
              !quotes.length &&
              canWrite && (
                <Button variant="primary" icon="plus" onClick={() => setBuilder({ open: true, editing: null })}>
                  New quote
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <TableHead>
                <SortHeader label="Quote" column="id" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label="Customer" column="customer" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label="Valid until" column="valid" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label="Status" column="status" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label="Total (TTC)" column="total" sort={table.sort} onSort={table.toggleSort} align="right" />
                <Th align="right">Actions</Th>
              </TableHead>
              <tbody>
                {table.rows.map((quote) => {
                  const validity = validityLabel(quote);
                  return (
                    <tr
                      key={quote.id}
                      onClick={() => updateParams({ view: quote.id })}
                      className="cursor-pointer border-t transition-colors hover:bg-[var(--surface-hover)]"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      <td className="px-5 py-3.5">
                        <p className="whitespace-nowrap font-bold app-text">{quote.number}</p>
                        <p className="whitespace-nowrap text-xs app-text-muted">
                          {formatDate(quote.created_at)} · {quote.item_count} line{quote.item_count === 1 ? "" : "s"}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar label={initials(quote.company_name)} seed={quote.customer_id} size={34} rounded="rounded-lg" />
                          <span className="max-w-[170px] truncate font-medium app-text">{quote.company_name}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <p className="app-text">{formatDate(`${quote.valid_until}T00:00:00`)}</p>
                        {validity && (
                          <p className="text-xs font-medium" style={{ color: quote.days_left < 0 ? "var(--warning)" : quote.days_left <= 3 ? "var(--danger)" : "var(--text-muted)" }}>
                            {validity}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={quote.status} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums app-text">{money(quote.total_with_vat)}</td>
                      <td className="px-5 py-3.5" onClick={(event) => event.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {canWrite && quote.actions.includes("convert") && (
                            <IconAction icon="orders" label={`Convert ${quote.number} to an order`} onClick={() => handleAction("convert", quote)} disabled={Boolean(busy)} />
                          )}
                          {canWrite && quote.actions.includes("send") && (
                            <IconAction icon="send" label={`Mark ${quote.number} as sent`} onClick={() => handleAction("send", quote)} disabled={Boolean(busy)} />
                          )}
                          <IconAction icon="eye" label={`View ${quote.number}`} onClick={() => updateParams({ view: quote.id })} />
                          <a
                            href={`/quotes/${quote.id}/print`}
                            target="_blank"
                            rel="noopener"
                            aria-label={`Print ${quote.number}`}
                            title="Print quote"
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
          <Pagination page={table.page} totalPages={table.totalPages} total={table.total} pageSize={table.pageSize} onPageChange={table.setPage} label="quotes" />
        )}
      </Card>

      <QuoteDrawer
        quoteId={viewId ?? lastViewId}
        version={drawerVersion}
        open={Boolean(viewId)}
        onClose={() => updateParams({ view: null })}
        onAction={handleAction}
        busy={busy}
        canWrite={canWrite}
      />

      {canWrite && (
        <QuoteBuilder
          open={builder.open || createRequested}
          onClose={closeBuilder}
          editing={builder.editing}
          initialCustomerId={params.get("customer") ?? undefined}
          onSaved={(quoteId, wasEditing) => {
            toast.success(wasEditing ? "Draft updated." : "Draft quote created.", { title: wasEditing ? "Quote saved" : "Quote created" });
            closeBuilder();
            reload();
            setDrawerVersion((value) => value + 1);
            updateParams({ new: null, customer: null, view: quoteId });
          }}
        />
      )}
    </div>
  );
}
