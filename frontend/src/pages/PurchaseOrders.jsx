import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { PO_STATUS, PO_STATUS_ORDER, estimatedCost } from "../lib/purchasing";
import useTable from "../lib/useTable";

import { t } from "../i18n";
const accessors = {
  id: (po) => po.id,
  supplier: (po) => po.supplier_name,
  expected: (po) => po.expected_at ?? "9999",
  total: (po) => po.total_amount,
  status: (po) => PO_STATUS_ORDER.indexOf(po.status),
};

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

let lineCounter = 0;
const newLine = (values = {}) => {
  lineCounter += 1;
  return { key: lineCounter, product_id: "", quantity: "1", unit_cost: "", ...values };
};

function StatusBadge({ po }) {
  if (po.late) {
    return (
      <Badge tone="danger" icon="alert">
        {t("Overdue")}
      </Badge>
    );
  }
  const meta = PO_STATUS[po.status] ?? PO_STATUS.Draft;
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {po.status}
    </Badge>
  );
}

function PurchaseOrderBuilder({ open, onClose, editing, onSaved }) {
  const suppliersResource = useResource(open ? "/suppliers" : null);
  const suppliers = toList(suppliersResource.data).filter((supplier) => supplier.is_active || String(supplier.id) === String(editing?.supplier_id));
  const { products, loading: productsLoading } = useActiveProducts(open);

  const [form, setForm] = useState({ supplier_id: "", expected_at: "", notes: "" });
  const [lines, setLines] = useState([newLine()]);
  const [onlySupplier, setOnlySupplier] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const prepareKey = open ? String(editing?.id ?? "new") : null;
  const [preparedFor, setPreparedFor] = useState(null);
  if (prepareKey !== preparedFor) {
    setPreparedFor(prepareKey);
    if (prepareKey) {
      setForm({ supplier_id: String(editing?.supplier_id ?? ""), expected_at: editing?.expected_at ?? "", notes: editing?.notes ?? "" });
      setLines(
        editing?.items?.length
          ? editing.items.map((item) => newLine({ product_id: String(item.product_id), quantity: String(item.quantity), unit_cost: String(Number(item.unit_cost)) }))
          : [newLine()]
      );
      setOnlySupplier(true);
      setError("");
    }
  }

  const supplier = suppliers.find((item) => String(item.id) === form.supplier_id);
  const productById = new Map(products.map((product) => [String(product.id), product]));
  const supplierProducts = products.filter((product) => String(product.supplier_id) === form.supplier_id);
  const pickable = onlySupplier && supplierProducts.length > 0 ? supplierProducts : products;
  const chosen = new Set(lines.map((line) => line.product_id).filter(Boolean));

  const total = round2(
    lines.reduce((sum, line) => (line.product_id ? sum + (Number(line.quantity) || 0) * (Number(line.unit_cost) || 0) : sum), 0)
  );
  const units = lines.reduce((sum, line) => (line.product_id ? sum + (Number(line.quantity) || 0) : sum), 0);

  function updateLine(key, changes) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...changes } : line)));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const items = lines
      .filter((line) => line.product_id)
      .map((line) => ({ product_id: Number(line.product_id), quantity: Number(line.quantity), unit_cost: round2(line.unit_cost) }));

    if (!form.supplier_id) return setError(t("Choose a supplier."));
    if (items.length === 0) return setError(t("Add at least one product."));
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) return setError(t("Quantities must be whole numbers of 1 or more."));
    if (items.some((item) => !Number.isFinite(item.unit_cost) || item.unit_cost < 0)) return setError(t("Enter a unit cost for every line."));

    setSaving(true);
    try {
      const body = { supplier_id: Number(form.supplier_id), expected_at: form.expected_at || null, notes: form.notes, items };
      const result = editing
        ? await api(`/purchase-orders/${editing.id}`, { method: "PUT", body })
        : await api("/purchase-orders", { method: "POST", body });
      onSaved(editing?.id ?? result.data?.purchaseOrderId, Boolean(editing));
    } catch (err) {
      setError(err.message || t("Could not save the purchase order."));
    } finally {
      setSaving(false);
    }
  }

  const loading = (suppliersResource.loading && !suppliersResource.data) || (productsLoading && products.length === 0);

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      busy={saving}
      size="xl"
      icon="truck"
      eyebrow={editing ? editing.number : t("New purchase order")}
      title={editing ? t("Edit draft purchase order") : t("Create a purchase order")}
      description={t("Stock is only added when the order is received.")}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            {t("Cancel")}
          </Button>
          <Button type="submit" form="po-form" variant="primary" icon="check" loading={saving} disabled={chosen.size === 0 || !form.supplier_id}>
            {editing ? t("Save draft") : t("Create draft")} · {money(total)}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-11" />
          <div className="skeleton h-20" />
          <div className="skeleton h-20" />
        </div>
      ) : (
        <form id="po-form" onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0 space-y-5">
            <InlineAlert>{error}</InlineAlert>
            {suppliers.length === 0 && (
              <InlineAlert tone="warning">
                {t("Add a supplier first.")}{" "}
                <Link to="/suppliers?new=1" className="font-semibold underline">
                  {t("Create a supplier")}
                </Link>
              </InlineAlert>
            )}

            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Field label={t("Supplier")} required>
                {(id) => (
                  <select id={id} value={form.supplier_id} onChange={(event) => setForm((f) => ({ ...f, supplier_id: event.target.value }))} required className="app-input">
                    <option value="">{t("Select a supplier...")}</option>
                    {suppliers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.lead_time_days} days
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t("Expected delivery")} hint={supplier && !form.expected_at ? t("Defaults to +{count} days when ordered", { count: supplier.lead_time_days }) : undefined}>
                {(id) => (
                  <input
                    id={id}
                    type="date"
                    value={form.expected_at}
                    min={localDateInput()}
                    onChange={(event) => setForm((f) => ({ ...f, expected_at: event.target.value }))}
                    className="app-input"
                  />
                )}
              </Field>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium app-text">
                  {t("Lines")} <span style={{ color: "var(--danger)" }}>*</span>
                </p>
                <div className="flex items-center gap-3">
                  {supplierProducts.length > 0 && (
                    <label className="flex items-center gap-2 text-xs app-text-secondary">
                      <input type="checkbox" checked={onlySupplier} onChange={(event) => setOnlySupplier(event.target.checked)} />
                      {t("Only {supplier}'s products ({count})", { supplier: supplier?.name, count: supplierProducts.length })}
                    </label>
                  )}
                  <Button size="sm" variant="ghost" icon="plus" onClick={() => setLines((current) => [...current, newLine()])}>
                    {t("Add line")}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {lines.map((line, index) => {
                  const product = productById.get(line.product_id);
                  const options = product && !pickable.includes(product) ? [product, ...pickable] : pickable;

                  return (
                    <div
                      key={line.key}
                      className="grid grid-cols-2 gap-2 rounded-xl border p-3 animate-fade-in sm:grid-cols-[1fr_90px_120px_auto] sm:items-start"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      <div className="col-span-2 min-w-0 sm:col-span-1">
                        <select
                          value={line.product_id}
                          onChange={(event) => {
                            const next = productById.get(event.target.value);
                            updateLine(line.key, {
                              product_id: event.target.value,
                              unit_cost: next ? String(estimatedCost(next.price)) : "",
                              quantity: next ? String(Math.max(1, (Number(next.reorder_point) || 5) * 3 - Number(next.stock))) : "1",
                            });
                          }}
                          aria-label={t("Product for line {number}", { number: index + 1 })}
                          className="app-input"
                        >
                          <option value="">{t("Select a product...")}</option>
                          {options.map((option) => (
                            <option key={option.id} value={option.id} disabled={chosen.has(String(option.id)) && String(option.id) !== line.product_id}>
                              {option.name} · {t("{count} in stock", { count: option.stock })}
                            </option>
                          ))}
                        </select>
                        {product && (
                          <p className="mt-1.5 text-xs app-text-muted">
                            {t("{count} in stock", { count: product.stock })} · {t("reorder at {count}", { count: product.reorder_point })}
                            {Number(product.on_order) > 0 && ` · ${t("{count} already on order", { count: product.on_order })}`} · {t("sells at {price}", { price: money(product.price) })}
                          </p>
                        )}
                      </div>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                        aria-label={t("Quantity for line {number}", { number: index + 1 })}
                        className="app-input text-center tabular-nums"
                      />
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_cost}
                          onChange={(event) => updateLine(line.key, { unit_cost: event.target.value })}
                          placeholder={t("Unit cost")}
                          aria-label={t("Unit cost for line {number}", { number: index + 1 })}
                          className="app-input pe-11 text-end tabular-nums"
                        />
                        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold app-text-muted">{t("MAD")}</span>
                      </div>
                      <IconAction icon="trash" label={t("Remove line {number}", { number: index + 1 })} tone="danger" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} />
                    </div>
                  );
                })}
              </div>
            </div>

            <Field label={t("Notes for the supplier")} hint={`${form.notes.length}/1000`}>
              {(id) => (
                <textarea id={id} value={form.notes} onChange={(event) => setForm((f) => ({ ...f, notes: event.target.value }))} rows={2} maxLength={1000} className="app-input resize-y" />
              )}
            </Field>
          </div>

          <aside className="h-fit rounded-xl border p-5 lg:sticky lg:top-0" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface-muted)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider app-text-muted">{t("Order summary")}</p>
            <p className="mt-4 text-sm font-semibold app-text">{supplier?.name ?? "No supplier selected"}</p>
            {supplier && <p className="text-xs app-text-muted">{[supplier.city, supplier.country].filter(Boolean).join(", ")} · {t("{count} days lead time", { count: supplier.lead_time_days })}</p>}
            <dl className="mt-5 space-y-2 border-t pt-4 text-sm" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex justify-between">
                <dt className="app-text-secondary">{t("Products")}</dt>
                <dd className="font-semibold app-text">{chosen.size}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="app-text-secondary">{t("Units")}</dt>
                <dd className="font-semibold app-text">{number(units)}</dd>
              </div>
            </dl>
            <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <p className="text-xs app-text-secondary">{t("Total cost (HT)")}</p>
              <p className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums app-text">{money(total)}</p>
              <p className="mt-2 text-xs app-text-muted">{t("Unit costs start at an estimate; replace them with the supplier's quote.")}</p>
            </div>
          </aside>
        </form>
      )}
    </Modal>
  );
}

function Timeline({ po }) {
  const cancelled = po.status === "Cancelled";
  const steps = [
    { label: "Drafted", at: po.created_at, done: true },
    { label: "Ordered", at: po.ordered_at, done: Boolean(po.ordered_at) },
    cancelled
      ? { label: "Cancelled", at: po.cancelled_at, done: true, bad: true }
      : { label: po.late ? "Overdue" : "Received", at: po.received_at ?? (po.status === "Ordered" ? `${po.expected_at}T12:00:00` : null), done: po.status === "Received", warn: po.late },
  ];

  return (
    <ol className="flex items-start">
      {steps.map((step, index) => (
        <li key={step.label} className="relative flex flex-1 flex-col items-center text-center">
          {index < steps.length - 1 && (
            <span className="absolute start-1/2 top-4 h-0.5 w-full" style={{ backgroundColor: steps[index + 1].done && !steps[index + 1].bad ? "var(--success)" : "var(--border-color)" }} />
          )}
          <span
            className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2"
            style={
              step.done
                ? { borderColor: step.bad ? "var(--danger)" : "var(--success)", ...toneStyle(step.bad ? "danger" : "success") }
                : step.warn
                  ? { borderColor: "var(--danger)", ...toneStyle("danger") }
                  : { borderColor: "var(--border-color)", backgroundColor: "var(--surface)", color: "var(--text-muted)" }
            }
          >
            <Icon name={step.bad ? "close" : step.done ? "check" : step.warn ? "alert" : "clock"} size={15} strokeWidth={2.2} />
          </span>
          <span className={`mt-2 text-xs font-semibold ${step.done || step.warn ? "app-text" : "app-text-muted"}`}>{t(step.label)}</span>
          {step.at && <span className="text-[11px] app-text-muted">{step.done ? formatDate(step.at) : `due ${formatDate(step.at)}`}</span>}
        </li>
      ))}
    </ol>
  );
}

function PurchaseOrderDrawer({ poId, version, open, onClose, onAction, busy, allowed }) {
  const { data, loading, error } = useResource(poId ? `/purchase-orders/${poId}?v=${version}` : null);
  const po = data?.data;
  const items = po?.items ?? [];
  const actions = (po?.actions ?? []).filter(allowed);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={po?.number ?? (poId ? t("Purchase order #{id}", { id: poId }) : "")}
      description={po ? `${po.supplier_name} · ${t("created {when}", { when: timeAgo(po.created_at) })}${po.created_by_name ? ` ${t("by {name}", { name: po.created_by_name })}` : ""}` : t("Loading...")}
      icon="truck"
      footer={
        po && (
          <>
            {actions.includes("delete") && (
              <Button variant="danger-ghost" icon="trash" onClick={() => onAction("delete", po)} disabled={Boolean(busy)} className="me-auto">
                {t("Delete")}
              </Button>
            )}
            {actions.includes("cancel") && !actions.includes("delete") && (
              <Button variant="danger-ghost" icon="ban" onClick={() => onAction("cancel", po)} disabled={Boolean(busy)} className="me-auto">
                {t("Cancel order")}
              </Button>
            )}
            {actions.includes("edit") && (
              <Button icon="edit" onClick={() => onAction("edit", po)} disabled={Boolean(busy)}>
                {t("Edit")}
              </Button>
            )}
            {actions.includes("order") && (
              <Button variant="primary" icon="send" onClick={() => onAction("order", po)} loading={busy === "order"} disabled={Boolean(busy)}>
                {t("Place order")}
              </Button>
            )}
            {actions.includes("receive") && (
              <Button variant="primary" icon="checkCircle" onClick={() => onAction("receive", po)} loading={busy === "receive"} disabled={Boolean(busy)}>
                {t("Receive into stock")}
              </Button>
            )}
          </>
        )
      }
    >
      {error ? (
        <ErrorState message={error} />
      ) : loading && !po ? (
        <div className="space-y-4">
          <div className="skeleton h-24 rounded-xl" />
          <div className="skeleton h-48 rounded-xl" />
        </div>
      ) : (
        po && (
          <div className="space-y-6">
            <div className="rounded-xl border p-5" style={{ borderColor: "var(--border-color)" }}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <StatusBadge po={po} />
                <span className="text-xs app-text-secondary">{po.late ? t("Expected {date}. Follow up with the supplier.", { date: formatDate(`${po.expected_at}T00:00:00`) }) : t(PO_STATUS[po.status]?.description)}</span>
              </div>
              <Timeline po={po} />
            </div>

            <div className="flex items-center gap-3 rounded-xl border p-4" style={{ borderColor: "var(--border-color)" }}>
              <Avatar label={initials(po.supplier_name)} seed={po.supplier_id} size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide app-text-muted">{t("Supplier")}</p>
                <p className="truncate text-sm font-semibold app-text">{po.supplier_name}</p>
                <p className="truncate text-xs app-text-muted">{[po.supplier_email, po.supplier_phone].filter(Boolean).join(" · ")}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-bold app-text">
                {t("Lines")} <span className="font-normal app-text-muted">({items.length})</span>
              </h3>
              <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
                <table className="w-full text-start text-sm">
                  <TableHead>
                    <Th className="!px-4">{t("Product")}</Th>
                    <Th className="!px-4" align="right">{t("Qty")}</Th>
                    <Th className="!px-4" align="right">{t("Cost")}</Th>
                  </TableHead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.product_id} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                        <td className="px-4 py-3">
                          <p className="font-medium app-text">{item.product_name}</p>
                          <p className="text-xs app-text-muted">
                            {t("{price} each", { price: money(item.unit_cost) })}
                            {po.status === "Ordered" && (
                              <>
                                {" · stock "}
                                {item.current_stock} → <span className="font-semibold" style={{ color: "var(--success)" }}>{item.current_stock + item.quantity}</span>
                              </>
                            )}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-end tabular-nums app-text">×{item.quantity}</td>
                        <td className="px-4 py-3 text-end font-semibold tabular-nums app-text">{money(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between border-t px-4 py-3.5" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface-muted)" }}>
                  <span className="text-sm font-semibold app-text-secondary">{t("Total cost (HT)")}</span>
                  <span className="text-lg font-bold tabular-nums app-text">{money(po.total_amount)}</span>
                </div>
              </div>
            </div>

            {po.notes && (
              <div>
                <h3 className="mb-2 text-sm font-bold app-text">{t("Notes")}</h3>
                <p className="rounded-xl p-4 text-sm app-muted app-text-secondary">{po.notes}</p>
              </div>
            )}
          </div>
        )
      )}
    </Drawer>
  );
}

export default function PurchaseOrders() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const canWrite = can(user, "purchasing.write");
  const canReceive = can(user, "purchasing.receive");
  const allowed = (action) => (action === "receive" ? canReceive : canWrite);

  const { data, loading, error, reload } = useResource("/purchase-orders");
  const orders = useMemo(() => toList(data), [data]);

  const [status, setStatus] = useState(() => {
    const wanted = (params.get("status") ?? "").toLowerCase();
    if (wanted === "late") return "Late";
    return PO_STATUS_ORDER.find((name) => name.toLowerCase() === wanted) ?? "All";
  });
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(null);
  const [version, setVersion] = useState(0);
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
    const result = { All: orders.length, Late: orders.filter((po) => po.late).length };
    for (const name of PO_STATUS_ORDER) result[name] = orders.filter((po) => po.status === name).length;
    return result;
  }, [orders]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter(
      (po) =>
        (status === "All" || (status === "Late" ? po.late : po.status === status)) &&
        (!term || po.number.toLowerCase().includes(term) || po.supplier_name.toLowerCase().includes(term))
    );
  }, [orders, status, search]);

  const table = useTable(filtered, { accessors, initialSort: { key: "id", direction: "desc" } });

  const open = orders.filter((po) => po.status === "Ordered");
  const openValue = open.reduce((sum, po) => sum + po.total_amount, 0);
  const receivedThisMonth = orders.filter((po) => {
    if (po.status !== "Received" || !po.received_at) return false;
    const date = new Date(po.received_at);
    const today = new Date();
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  });

  async function handleAction(action, po) {
    if (action === "edit") {
      setBuilder({ open: true, editing: po });
      return;
    }

    const units = (po.items ?? []).reduce((sum, item) => sum + item.quantity, 0) || po.unit_count;
    const confirmations = {
      order: { title: t("Place {number}?", { number: po.number }), message: t("Mark this order as sent to {supplier}. It will be locked for editing and counted as stock on order.", { supplier: po.supplier_name }), confirmLabel: t("Place order"), tone: "primary", icon: "send" },
      receive: { title: t("Receive {number}?", { number: po.number }), message: t("Add {count} units from {supplier} to stock. Each line is recorded in the stock ledger.", { count: number(units), supplier: po.supplier_name }), confirmLabel: t("Receive into stock"), tone: "primary", icon: "checkCircle" },
      cancel: { title: t("Cancel {number}?", { number: po.number }), message: t("The order will not be received and stops counting as stock on order."), confirmLabel: t("Cancel order") },
      delete: { title: t("Delete {number}?", { number: po.number }), message: t("This draft will be permanently removed."), confirmLabel: t("Delete draft") },
    };

    if (confirmations[action] && !(await confirm(confirmations[action]))) return;

    setBusy(action);
    try {
      const path = action === "delete" ? `/purchase-orders/${po.id}` : `/purchase-orders/${po.id}/${action}`;
      const result = await api(path, { method: action === "delete" ? "DELETE" : "POST" });
      reload();
      setVersion((value) => value + 1);
      toast.success(result.message, { title: action === "receive" ? t("Stock updated") : undefined });
      if (action === "delete") updateParams({ view: null });
    } catch (err) {
      toast.error(err.message || t("The action failed."), { title: t("Purchase order not updated") });
    } finally {
      setBusy(null);
    }
  }

  function closeBuilder() {
    setBuilder({ open: false, editing: null });
    if (createRequested) updateParams({ new: null });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Purchase orders")}
        actions={
          <>
            <Button
              icon="download"
              disabled={filtered.length === 0}
              onClick={() => {
                exportCsv(
                  "purchase-orders",
                  [
                    ["PO", (po) => po.number],
                    [t("Supplier"), (po) => po.supplier_name],
                    [t("Status"), (po) => (po.late ? t("Overdue") : t(po.status))],
                    [t("Expected"), (po) => po.expected_at ?? ""],
                    [t("Lines"), (po) => po.item_count],
                    [t("Units"), (po) => po.unit_count],
                    [t("Total (MAD)"), (po) => po.total_amount],
                  ],
                  table.sorted
                );
                toast.info(t("Exported {count} purchase orders to CSV.", { count: table.sorted.length }));
              }}
            >
              {t("Export")}
            </Button>
            {canWrite && (
              <Button variant="primary" icon="plus" onClick={() => setBuilder({ open: true, editing: null })}>
                {t("New purchase order")}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("On order")} value={compactMoney(openValue)} hint={t("{count} open orders", { count: open.length })} icon="truck" tone="primary" loading={loading && !data} onClick={() => setStatus("Ordered")} />
        <StatCard label={t("Overdue deliveries")} value={number(counts.Late)} hint={t("Past their expected date")} icon="alert" tone="danger" loading={loading && !data} onClick={() => setStatus("Late")} />
        <StatCard label={t("Drafts")} value={number(counts.Draft ?? 0)} hint={t("Not yet sent to suppliers")} icon="edit" tone="warning" loading={loading && !data} onClick={() => setStatus("Draft")} />
        <StatCard label={t("Received this month")} value={number(receivedThisMonth.length)} hint={compactMoney(receivedThisMonth.reduce((sum, po) => sum + po.total_amount, 0))} icon="checkCircle" tone="success" loading={loading && !data} />
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}

      <Card>
        <div className="space-y-3 border-b p-4" style={{ borderColor: "var(--border-color)" }}>
          <SegmentedControl
            label={t("Filter by status")}
            value={status}
            onChange={(value) => {
              setStatus(value);
              table.setPage(1);
            }}
            options={[
              { value: "All", label: "All", count: counts.All },
              { value: "Draft", label: "Draft", count: counts.Draft ?? 0 },
              { value: "Ordered", label: "Ordered", count: counts.Ordered ?? 0 },
              { value: "Late", label: "Overdue", count: counts.Late },
              { value: "Received", label: "Received", count: counts.Received ?? 0 },
              { value: "Cancelled", label: "Cancelled", count: counts.Cancelled ?? 0 },
            ]}
          />
          <div className="flex items-center gap-3">
            <SearchInput value={search} onChange={(value) => { setSearch(value); table.setPage(1); }} placeholder={t("Search PO number or supplier...")} className="sm:w-80" />
            <Button size="icon" variant="ghost" icon="refresh" onClick={reload} aria-label={t("Refresh")} title={t("Refresh")} className={`ms-auto ${loading ? "[&_svg]:animate-spin" : ""}`} />
          </div>
        </div>

        {loading && !data ? (
          <TableSkeleton columns={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={orders.length ? "search" : "truck"}
            title={orders.length ? t("No purchase orders match") : t("No purchase orders yet")}
            description={orders.length ? t("Try another status or search.") : t("Create one, or generate drafts from reorder suggestions on the Stock page.")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-start text-sm">
              <TableHead>
                <SortHeader label={t("Purchase order")} column="id" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label={t("Supplier")} column="supplier" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label={t("Expected")} column="expected" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label={t("Status")} column="status" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label={t("Total")} column="total" sort={table.sort} onSort={table.toggleSort} align="right" />
                <Th align="right">{t("Actions")}</Th>
              </TableHead>
              <tbody>
                {table.rows.map((po) => (
                  <tr
                    key={po.id}
                    onClick={() => updateParams({ view: po.id })}
                    className="cursor-pointer border-t transition-colors hover:bg-[var(--surface-hover)]"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <td className="px-5 py-3.5">
                      <p className="whitespace-nowrap font-bold app-text">{po.number}</p>
                      <p className="whitespace-nowrap text-xs app-text-muted">
                        {po.item_count} line{po.item_count === 1 ? "" : "s"} · {number(po.unit_count)} units
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar label={initials(po.supplier_name)} seed={po.supplier_id} size={34} rounded="rounded-lg" />
                        <span className="max-w-[180px] truncate font-medium app-text">{po.supplier_name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      {po.status === "Received" ? (
                        <span className="app-text-secondary">{t("Received {date}", { date: formatDate(po.received_at) })}</span>
                      ) : po.expected_at ? (
                        <span style={po.late ? { color: "var(--danger)", fontWeight: 600 } : undefined} className={po.late ? "" : "app-text"}>
                          {formatDate(`${po.expected_at}T00:00:00`)}
                        </span>
                      ) : (
                        <span className="app-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge po={po} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-end font-semibold tabular-nums app-text">{money(po.total_amount)}</td>
                    <td className="px-5 py-3.5" onClick={(event) => event.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {canReceive && po.actions.includes("receive") && <IconAction icon="checkCircle" label={t("Receive {number}", { number: po.number })} onClick={() => handleAction("receive", po)} disabled={Boolean(busy)} />}
                        {canWrite && po.actions.includes("order") && <IconAction icon="send" label={t("Place {number}", { number: po.number })} onClick={() => handleAction("order", po)} disabled={Boolean(busy)} />}
                        <IconAction icon="eye" label={t("View {number}", { number: po.number })} onClick={() => updateParams({ view: po.id })} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <Pagination page={table.page} totalPages={table.totalPages} total={table.total} pageSize={table.pageSize} onPageChange={table.setPage} label={t("purchase orders")} />
        )}
      </Card>

      <PurchaseOrderDrawer
        poId={viewId ?? lastViewId}
        version={version}
        open={Boolean(viewId)}
        onClose={() => updateParams({ view: null })}
        onAction={handleAction}
        busy={busy}
        allowed={allowed}
      />

      {canWrite && (
        <PurchaseOrderBuilder
          open={builder.open || createRequested}
          onClose={closeBuilder}
          editing={builder.editing}
          onSaved={(id, wasEditing) => {
            toast.success(wasEditing ? t("Draft updated.") : t("Draft purchase order created."), { title: wasEditing ? t("Saved") : t("Created") });
            closeBuilder();
            reload();
            setVersion((value) => value + 1);
            updateParams({ new: null, view: id });
          }}
        />
      )}
    </div>
  );
}
