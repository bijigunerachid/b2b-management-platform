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
} from "../components/ui/primitives";
import { api, can, compactMoney, exportCsv, formatDate, initials, money, number, timeAgo, toList, useActiveProducts, useResource } from "../lib/api";
import { ORDER_STATUS, STATUS_FLOW, nextStatuses } from "../lib/orderStatus";
import { paymentBadge } from "../lib/billing";
import { PRICE_SOURCES, hasDiscount, usePrices } from "../lib/pricing";
import PaymentPanel from "../components/PaymentPanel";
import ReturnsPanel from "../components/ReturnsPanel";
import HistoryPanel from "../components/HistoryPanel";
import useTable from "../lib/useTable";

const STATUSES = Object.keys(ORDER_STATUS);

const periods = {
  all: { label: "All time", days: null },
  7: { label: "Last 7 days", days: 7 },
  30: { label: "Last 30 days", days: 30 },
  90: { label: "Last 90 days", days: 90 },
};

const accessors = {
  id: (order) => Number(order.id),
  customer: (order) => order.company_name,
  date: (order) => new Date(order.created_at).getTime() || 0,
  total: (order) => Number(order.total_amount),
  status: (order) => STATUSES.indexOf(order.status),
};

const paymentFilters = {
  all: { label: "All payments", match: () => true },
  open: { label: "Open balance", match: (b) => b && b.balance > 0 },
  overdue: { label: "Overdue", match: (b) => b?.overdue },
  partial: { label: "Partially paid", match: (b) => b?.payment_status === "Partially paid" },
  paid: { label: "Paid", match: (b) => b?.payment_status === "Paid" },
  credited: { label: "Credited", match: (b) => b?.credited > 0 },
};

const actionLabels = {
  Processing: { label: "Start processing", icon: "truck" },
  Completed: { label: "Mark completed", icon: "checkCircle" },
  Cancelled: { label: "Cancel order", icon: "ban" },
};

function LinePrice({ line }) {
  if (!line || (!hasDiscount(line) && !line.next_break)) return null;
  return (
    <p className="col-span-full flex flex-wrap items-center gap-x-2 gap-y-1 text-xs app-text-muted">
      {hasDiscount(line) && (
        <>
          <span className="tabular-nums">
            <span className="line-through">{money(line.list_price)}</span>{" "}
            <span className="font-semibold app-text">{money(line.unit_price)}</span> each
          </span>
          <Badge tone={PRICE_SOURCES[line.price_source]?.tone}>{line.label}</Badge>
        </>
      )}
      {line.next_break && (
        <span>
          {line.next_break.min_quantity}+ units: {line.next_break.discount_percent}% volume discount
        </span>
      )}
    </p>
  );
}

let lineCounter = 0;
const newLine = () => {
  lineCounter += 1;
  return { key: lineCounter, product_id: "", quantity: "1" };
};

function StatusTimeline({ status }) {
  const cancelled = status === "Cancelled";
  const reached = cancelled ? 0 : STATUS_FLOW.indexOf(status);

  return (
    <ol className="flex items-start">
      {STATUS_FLOW.map((step, index) => {
        const done = !cancelled && index <= reached;
        const meta = ORDER_STATUS[step];
        const isLast = index === STATUS_FLOW.length - 1;

        return (
          <li key={step} className="relative flex flex-1 flex-col items-center text-center">
            {!isLast && (
              <span
                className="absolute left-1/2 top-4 h-0.5 w-full"
                style={{ backgroundColor: !cancelled && index < reached ? "var(--success)" : "var(--border-color)" }}
              />
            )}
            <span
              className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition"
              style={{
                borderColor: done ? meta.color : "var(--border-color)",
                backgroundColor: done ? meta.soft : "var(--surface)",
                color: done ? meta.color : "var(--text-muted)",
              }}
            >
              <Icon name={done && index < reached ? "check" : meta.icon} size={15} strokeWidth={2.2} />
            </span>
            <span className={`mt-2 text-xs font-semibold ${done ? "app-text" : "app-text-muted"}`}>{step}</span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderDrawer({ orderId, version, open, onClose, onChangeStatus, updating, canWrite, canFulfil, canSeePayments, canSeeHistory, canRecordPayments, canVoidPayments, canReturn, onPaymentsChanged, onReturned }) {
  // `version` changes the request key so the drawer refetches after updates.
  const { data, loading, error } = useResource(orderId ? `/orders/${orderId}?v=${version}` : null);
  const order = data?.data ?? null;
  const items = order?.items ?? [];
  const cancelled = order?.status === "Cancelled";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={orderId ? `Order #${orderId}` : ""}
      description={order ? `Placed ${formatDate(order.created_at, true)} · ${timeAgo(order.created_at)}` : "Loading..."}
      icon="orders"
      footer={
        order && (
          <>
            {nextStatuses(order.status)
                // Cancelling needs orders.write, and the API refuses it while payments are active.
                .filter((status) => (status === "Cancelled" ? canWrite && !(order.billing?.amount_paid > 0) : canFulfil))
                .map((status) => (
                <Button
                  key={status}
                  variant={status === "Cancelled" ? "danger-ghost" : "primary"}
                  icon={actionLabels[status].icon}
                  loading={updating === order.id}
                  onClick={() => onChangeStatus(order, status)}
                  className={status === "Cancelled" ? "order-first mr-auto" : "order-2"}
                >
                  {actionLabels[status].label}
                </Button>
              ))}
            {canWrite && order.status !== "Cancelled" && order.status !== "Completed" && order.billing?.amount_paid > 0 && (
              <span className="order-first mr-auto max-w-[180px] text-xs app-text-muted">To cancel, void its payments first.</span>
            )}
            <Link
              to={`/orders/${order.id}/invoice`}
              target="_blank"
              rel="noopener"
              className="order-1 inline-flex h-10 items-center gap-2 rounded-[var(--control-radius)] border px-4 text-sm font-semibold transition hover:bg-[var(--surface-hover)] app-text"
              style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface)" }}
            >
              <Icon name="download" size={17} /> Invoice
            </Link>
          </>
        )
      }
    >
      {error ? (
        <ErrorState message={error} />
      ) : loading && !order ? (
        <div className="space-y-4">
          <div className="skeleton h-20 rounded-xl" />
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-48 rounded-xl" />
        </div>
      ) : (
        order && (
          <div className="space-y-6">
            <div className="rounded-xl border p-5" style={{ borderColor: "var(--border-color)" }}>
              {cancelled ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)" }}>
                    <Icon name="ban" size={19} />
                  </div>
                  <div>
                    <p className="font-semibold app-text">This order was cancelled</p>
                    <p className="text-sm app-text-secondary">Reserved stock was returned to inventory.</p>
                  </div>
                </div>
              ) : (
                <StatusTimeline status={order.status} />
              )}
            </div>

            <Link
              to={`/customers?view=${order.customer_id}`}
              className="flex items-center gap-3 rounded-xl border p-4 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
              style={{ borderColor: "var(--border-color)" }}
            >
              <Avatar label={initials(order.company_name)} seed={order.customer_id} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide app-text-muted">Customer</p>
                <p className="truncate font-semibold app-text">{order.company_name}</p>
              </div>
              <Icon name="chevronRight" size={18} className="app-text-muted" />
            </Link>

            <div>
              <h3 className="mb-3 text-sm font-bold app-text">
                Items <span className="font-normal app-text-muted">({items.length})</span>
              </h3>
              <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
                <table className="w-full text-left text-sm">
                  <TableHead>
                    <Th className="!px-4">Product</Th>
                    <Th className="!px-4" align="right">Qty</Th>
                    <Th className="!px-4" align="right">Subtotal</Th>
                  </TableHead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.product_id} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                        <td className="px-4 py-3">
                          <p className="font-medium app-text">{item.product_name}</p>
                          <p className="text-xs app-text-muted">
                            {hasDiscount(item) && <span className="mr-1 line-through">{money(item.list_price)}</span>}
                            {money(item.unit_price)} each
                            {item.price_source && item.price_source !== "list" && ` · ${PRICE_SOURCES[item.price_source]?.label}`}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums app-text">×{item.quantity}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums app-text">
                          {money(item.subtotal ?? item.quantity * item.unit_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between border-t px-4 py-3.5" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface-muted)" }}>
                  <span className="text-sm font-semibold app-text-secondary">Order total (excl. VAT)</span>
                  <span className="text-lg font-bold tabular-nums app-text">{money(order.total_amount)}</span>
                </div>
              </div>
            </div>

            {canSeePayments && (
              <PaymentPanel
                order={order}
                version={version}
                canRecord={canRecordPayments}
                canVoid={canVoidPayments}
                onChanged={onPaymentsChanged}
              />
            )}

            {canSeePayments && <ReturnsPanel order={order} version={version} canCreate={canReturn} onChanged={onReturned} />}

            {canSeeHistory && <HistoryPanel entityType="order" entityId={order.id} version={version} />}
          </div>
        )
      )}
    </Drawer>
  );
}

function CreateOrderModal({ open, onClose, onCreated, initialCustomerId }) {
  const toast = useToast();
  const customersResource = useResource(open ? "/customers" : null);
  const productsResource = useActiveProducts(open);
  const customers = toList(customersResource.data);
  const { products } = productsResource;

  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [lines, setLines] = useState([newLine()]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [appliedInitial, setAppliedInitial] = useState(initialCustomerId);
  if (initialCustomerId && initialCustomerId !== appliedInitial) {
    setAppliedInitial(initialCustomerId);
    setCustomerId(initialCustomerId);
  }

  const productById = new Map(products.map((product) => [String(product.id), product]));
  const selectedIds = new Set(lines.map((line) => line.product_id).filter(Boolean));

  const { prices, loading: pricing } = usePrices("/pricing/preview", customerId, lines);
  const unitPriceOf = (product) => prices.get(product.id)?.unit_price ?? Number(product.price);

  const total = lines.reduce((sum, line) => {
    const product = productById.get(line.product_id);
    return sum + (product ? unitPriceOf(product) * (Number(line.quantity) || 0) : 0);
  }, 0);
  const listTotal = lines.reduce((sum, line) => {
    const product = productById.get(line.product_id);
    return sum + (product ? Number(product.price) * (Number(line.quantity) || 0) : 0);
  }, 0);
  const savings = Math.round((listTotal - total) * 100) / 100;
  const units = lines.reduce((sum, line) => sum + (line.product_id ? Number(line.quantity) || 0 : 0), 0);
  const selectedCustomer = customers.find((customer) => String(customer.id) === String(customerId));

  function updateLine(key, changes) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...changes } : line)));
  }

  function reset() {
    setCustomerId("");
    setLines([newLine()]);
    setFormError("");
  }

  function close() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    if (!customerId) return setFormError("Select a customer for this order.");

    const items = lines
      .filter((line) => line.product_id)
      .map((line) => ({ product_id: Number(line.product_id), quantity: Number(line.quantity) }));

    if (items.length === 0) return setFormError("Add at least one product.");
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
      return setFormError("Quantities must be whole numbers of 1 or more.");
    }

    const overStock = lines.find((line) => {
      const product = productById.get(line.product_id);
      return product && Number(line.quantity) > Number(product.stock);
    });
    if (overStock) {
      const product = productById.get(overStock.product_id);
      return setFormError(`Only ${product.stock} units of ${product.name} are in stock.`);
    }

    setSaving(true);
    try {
      const result = await api("/orders", { method: "POST", body: { customer_id: Number(customerId), items } });
      toast.success(`${money(total)} order for ${selectedCustomer?.company_name ?? "customer"} was created.`, {
        title: "Order created",
      });
      reset();
      onCreated(result.data?.orderId);
    } catch (err) {
      setFormError(err.message || "Could not create the order.");
    } finally {
      setSaving(false);
    }
  }

  const loadingData = (customersResource.loading && !customersResource.data) || (productsResource.loading && products.length === 0);

  return (
    <Modal
      open={open}
      onClose={close}
      busy={saving}
      size="xl"
      icon="orders"
      title="Create an order"
      footer={
        <>
          <Button onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="order-form" variant="primary" loading={saving} icon="check" disabled={units === 0 || !customerId}>
            Create order · {money(total)}
          </Button>
        </>
      }
    >
      {loadingData ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            <div className="skeleton h-11" />
            <div className="skeleton h-20" />
            <div className="skeleton h-20" />
          </div>
          <div className="skeleton h-56 rounded-xl" />
        </div>
      ) : (
        <form id="order-form" onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0 space-y-5">
            <InlineAlert>{formError}</InlineAlert>

            <Field label="Customer" required>
              {(id) => (
                <select id={id} value={customerId} onChange={(event) => setCustomerId(event.target.value)} required className="app-input">
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
            {customers.length === 0 && (
              <InlineAlert tone="warning">
                No customers yet.{" "}
                <Link to="/customers?new=1" className="font-semibold underline">
                  Add a customer
                </Link>{" "}
                first.
              </InlineAlert>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium app-text">
                  Products <span style={{ color: "var(--danger)" }}>*</span>
                </p>
                <Button size="sm" variant="ghost" icon="plus" onClick={() => setLines((current) => [...current, newLine()])} disabled={selectedIds.size >= products.length}>
                  Add line
                </Button>
              </div>

              <div className="space-y-2">
                {lines.map((line, index) => {
                  const product = productById.get(line.product_id);
                  const quantity = Number(line.quantity) || 0;
                  const tooMany = product && quantity > Number(product.stock);

                  return (
                    <div
                      key={line.key}
                      className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border p-3 animate-fade-in sm:grid-cols-[1fr_110px_120px_auto] sm:items-center"
                      style={{ borderColor: tooMany ? "var(--danger)" : "var(--border-color)" }}
                    >
                      <select
                        value={line.product_id}
                        onChange={(event) => updateLine(line.key, { product_id: event.target.value })}
                        aria-label={`Product for line ${index + 1}`}
                        className="app-input col-span-2 sm:col-span-1"
                      >
                        <option value="">Select a product...</option>
                        {products.map((option) => {
                          const taken = selectedIds.has(String(option.id)) && String(option.id) !== line.product_id;
                          const outOfStock = Number(option.stock) === 0;
                          return (
                            <option key={option.id} value={option.id} disabled={taken || outOfStock}>
                              {option.name} · {money(option.price)} {outOfStock ? "(out of stock)" : `(${option.stock} in stock)`}
                            </option>
                          );
                        })}
                      </select>

                      <input
                        type="number"
                        min="1"
                        max={product?.stock}
                        step="1"
                        value={line.quantity}
                        onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                        aria-label={`Quantity for line ${index + 1}`}
                        aria-invalid={tooMany}
                        className="app-input text-center tabular-nums"
                      />

                      <p className="text-right text-sm font-semibold tabular-nums app-text sm:pr-1">
                        {product ? money(unitPriceOf(product) * quantity) : "—"}
                      </p>

                      <IconAction
                        icon="trash"
                        label={`Remove line ${index + 1}`}
                        tone="danger"
                        disabled={lines.length === 1}
                        onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                      />

                      {product && <LinePrice line={prices.get(product.id)} />}

                      {tooMany && (
                        <p className="col-span-full text-xs font-medium" style={{ color: "var(--danger)" }}>
                          Only {product.stock} in stock.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {products.length === 0 && (
                <InlineAlert tone="warning">No active products are available to order.</InlineAlert>
              )}
            </div>
          </div>

          <aside className="h-fit rounded-xl border p-5 lg:sticky lg:top-0" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface-muted)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider app-text-muted">Order summary</p>

            <div className="mt-4 flex items-center gap-3">
              {selectedCustomer ? (
                <>
                  <Avatar label={initials(selectedCustomer.company_name)} seed={selectedCustomer.id} size={36} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold app-text">{selectedCustomer.company_name}</p>
                    <p className="truncate text-xs app-text-muted">
                      {selectedCustomer.price_list_name ? `${selectedCustomer.price_list_name} price list, −${Number(selectedCustomer.price_list_discount)}%` : "Catalog prices"}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm app-text-muted">No customer selected</p>
              )}
            </div>

            <dl className="mt-5 space-y-2 border-t pt-4 text-sm" style={{ borderColor: "var(--border-color)" }}>
              <div className="flex justify-between">
                <dt className="app-text-secondary">Products</dt>
                <dd className="font-semibold app-text">{selectedIds.size}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="app-text-secondary">Units</dt>
                <dd className="font-semibold app-text">{units}</dd>
              </div>
              {savings > 0 && (
                <div className="flex justify-between">
                  <dt className="app-text-secondary">Discounts</dt>
                  <dd className="font-semibold tabular-nums" style={{ color: "var(--success)" }}>
                    −{money(savings)}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
              <p className="text-xs app-text-secondary">Total</p>
              <p className={`mt-0.5 text-2xl font-bold tracking-tight tabular-nums app-text ${pricing ? "opacity-60" : ""}`}>{money(total)}</p>
              <p className="mt-2 text-xs app-text-muted">Excluding VAT, with this customer's prices.</p>
            </div>
          </aside>
        </form>
      )}
    </Modal>
  );
}

export default function Orders() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const canWrite = can(user, "orders.write");
  const canFulfil = can(user, "orders.fulfil");

  const { data, loading, error, reload } = useResource("/orders");
  const orders = useMemo(() => toList(data, "orders"), [data]);

  const [search, setSearch] = useState("");
  // The cutoff is computed when a period is chosen, keeping render pure.
  const [period, setPeriod] = useState({ key: "all", cutoff: null });
  const [paymentFilter, setPaymentFilter] = useState(() => (paymentFilters[params.get("payment")] ? params.get("payment") : "all"));
  const [status, setStatus] = useState(() => (STATUSES.includes(params.get("status")) ? params.get("status") : "All"));
  const [updating, setUpdating] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerVersion, setDrawerVersion] = useState(0);

  const statusParam = params.get("status");
  const [appliedStatus, setAppliedStatus] = useState(statusParam);
  if (statusParam !== appliedStatus) {
    setAppliedStatus(statusParam);
    if (STATUSES.includes(statusParam)) setStatus(statusParam);
  }

  const createRequested = params.get("new") === "1" && canWrite;
  const viewId = params.get("view");

  const [lastViewId, setLastViewId] = useState(viewId);
  if (viewId && viewId !== lastViewId) setLastViewId(viewId);

  function updateParams(changes) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  }

  const inPeriod = useMemo(() => {
    if (period.cutoff === null) return orders;
    return orders.filter((order) => new Date(order.created_at).getTime() >= period.cutoff);
  }, [orders, period]);

  const counts = useMemo(() => {
    const result = { All: inPeriod.length };
    for (const name of STATUSES) result[name] = inPeriod.filter((order) => order.status === name).length;
    return result;
  }, [inPeriod]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase().replace(/^#/, "");
    return inPeriod.filter(
      (order) =>
        (status === "All" || order.status === status) &&
        paymentFilters[paymentFilter].match(order.billing) &&
        (!term || String(order.id).includes(term) || order.company_name?.toLowerCase().includes(term))
    );
  }, [inPeriod, status, search, paymentFilter]);

  const table = useTable(filtered, { accessors, initialSort: { key: "date", direction: "desc" } });

  const completedOrders = inPeriod.filter((order) => order.status === "Completed");
  const revenue = completedOrders.reduce((sum, order) => sum + Number(order.total_amount || 0) - Number(order.credited_subtotal || 0), 0);
  const average = completedOrders.length ? revenue / completedOrders.length : 0;

  async function changeStatus(order, nextStatus) {
    const cancelling = nextStatus === "Cancelled";
    const confirmed = await confirm({
      title: cancelling ? `Cancel order #${order.id}?` : `Move order #${order.id} to ${nextStatus}?`,
      message: cancelling
        ? "The order will be cancelled and its reserved stock returned to inventory. This can't be undone."
        : `The order for ${order.company_name} will move from ${order.status} to ${nextStatus}.`,
      confirmLabel: actionLabels[nextStatus].label,
      tone: cancelling ? "danger" : "primary",
      icon: actionLabels[nextStatus].icon,
    });
    if (!confirmed) return;

    setUpdating(order.id);
    try {
      await api(`/orders/${order.id}/status`, { method: "PATCH", body: { status: nextStatus } });
      toast.success(`Order #${order.id} is now ${nextStatus}.`, { title: "Status updated" });
      reload();
      setDrawerVersion((value) => value + 1);
    } catch (err) {
      toast.error(err.message || "Could not update the order.", { title: "Update failed" });
    } finally {
      setUpdating(null);
    }
  }

  function handleExport() {
    exportCsv(
      "orders",
      [
        ["Order", (o) => o.id],
        ["Customer", (o) => o.company_name],
        ["Status", (o) => o.status],
        ["Total (MAD)", (o) => o.total_amount],
        ["Created", (o) => o.created_at],
      ],
      table.sorted
    );
    toast.info(`Exported ${table.sorted.length} orders to CSV.`);
  }

  function closeCreate() {
    setCreateOpen(false);
    if (createRequested) updateParams({ new: null, customer: null });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        actions={
          <>
            <Button icon="download" onClick={handleExport} disabled={filtered.length === 0}>
              Export
            </Button>
            {canWrite && (
              <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>
                Create order
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Completed revenue" value={compactMoney(revenue)} hint={`${periods[period.key].label}, net of returns`} icon="revenue" tone="success" loading={loading && !data} />
        <StatCard label="Average order" value={money(average)} hint="Across completed orders" icon="orders" tone="primary" loading={loading && !data} />
        <StatCard label="Pending" value={number(counts.Pending)} hint="Awaiting review" icon="clock" tone="warning" loading={loading && !data} onClick={() => setStatus("Pending")} />
        <StatCard label="Processing" value={number(counts.Processing)} hint="Being prepared" icon="truck" tone="info" loading={loading && !data} onClick={() => setStatus("Processing")} />
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
            options={["All", ...STATUSES].map((name) => ({ value: name, label: name, count: counts[name] }))}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value);
                table.setPage(1);
              }}
              placeholder="Search order # or customer..."
              className="sm:w-80"
            />
            <select
              value={period.key}
              onChange={(event) => {
                const days = periods[event.target.value].days;
                setPeriod({ key: event.target.value, cutoff: days ? Date.now() - days * 86400000 : null });
                table.setPage(1);
              }}
              aria-label="Filter by date"
              className="app-input h-10 py-0 sm:w-44"
            >
              {Object.entries(periods).map(([value, option]) => (
                <option key={value} value={value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={paymentFilter}
              onChange={(event) => {
                setPaymentFilter(event.target.value);
                table.setPage(1);
              }}
              aria-label="Filter by payment"
              className="app-input h-10 py-0 sm:w-44"
            >
              {Object.entries(paymentFilters).map(([value, option]) => (
                <option key={value} value={value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button size="icon" variant="ghost" icon="refresh" onClick={reload} aria-label="Refresh" title="Refresh" className={`sm:ml-auto ${loading ? "[&_svg]:animate-spin" : ""}`} />
          </div>
        </div>

        {loading && !data ? (
          <TableSkeleton columns={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={orders.length ? "search" : "orders"}
            title={orders.length ? "No orders match these filters" : "No orders yet"}
            description={orders.length ? "Try another status, period, or search term." : "Create your first order to start tracking sales."}
            action={
              orders.length ? (
                <Button
                  onClick={() => {
                    setSearch("");
                    setStatus("All");
                    setPeriod({ key: "all", cutoff: null });
                    setPaymentFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                canWrite && (
                  <Button variant="primary" icon="plus" onClick={() => setCreateOpen(true)}>
                    Create your first order
                  </Button>
                )
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <TableHead>
                <SortHeader label="Order" column="id" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label="Customer" column="customer" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label="Date" column="date" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label="Status" column="status" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label="Total" column="total" sort={table.sort} onSort={table.toggleSort} align="right" />
                <Th align="right">Actions</Th>
              </TableHead>
              <tbody>
                {table.rows.map((order) => {
                  const meta = ORDER_STATUS[order.status];
                  const forward = nextStatuses(order.status).find((next) => next !== "Cancelled");

                  return (
                    <tr
                      key={order.id}
                      onClick={() => updateParams({ view: order.id })}
                      className="cursor-pointer border-t transition-colors hover:bg-[var(--surface-hover)]"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-bold app-text">#{order.id}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar label={initials(order.company_name)} seed={order.customer_id} size={34} rounded="rounded-lg" />
                          <span className="max-w-[170px] truncate font-medium app-text">{order.company_name}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <p className="app-text">{formatDate(order.created_at)}</p>
                        <p className="text-xs app-text-muted">{timeAgo(order.created_at)}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone={meta?.tone} icon={meta?.icon}>
                            {order.status}
                          </Badge>
                          {order.status !== "Cancelled" && (() => {
                            const badge = paymentBadge(order.billing);
                            return (
                              <Badge tone={badge.tone} icon={badge.icon} className="!py-0.5 text-[11px]">
                                {badge.label}
                              </Badge>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums app-text">{money(order.total_amount)}</td>
                      <td className="px-5 py-3.5" onClick={(event) => event.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {canFulfil && forward && (
                            <IconAction
                              icon={actionLabels[forward].icon}
                              label={actionLabels[forward].label}
                              disabled={updating === order.id}
                              onClick={() => changeStatus(order, forward)}
                            />
                          )}
                          <IconAction icon="eye" label="View order" onClick={() => updateParams({ view: order.id })} />
                          <a
                            href={`/orders/${order.id}/invoice`}
                            target="_blank"
                            rel="noopener"
                            aria-label={`Open invoice for order ${order.id}`}
                            title="Open invoice"
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
          <Pagination page={table.page} totalPages={table.totalPages} total={table.total} pageSize={table.pageSize} onPageChange={table.setPage} label="orders" />
        )}
      </Card>

      <OrderDrawer
        orderId={viewId ?? lastViewId}
        version={drawerVersion}
        open={Boolean(viewId)}
        onClose={() => updateParams({ view: null })}
        onChangeStatus={changeStatus}
        canFulfil={canFulfil}
        canSeePayments={can(user, "payments.view")}
        canSeeHistory={can(user, "audit.view")}
        canRecordPayments={can(user, "payments.write")}
        canVoidPayments={can(user, "payments.void")}
        canReturn={can(user, "returns.write")}
        onPaymentsChanged={() => {
          // Refresh the whole drawer: returns need the new balance.
          setDrawerVersion((value) => value + 1);
          reload();
        }}
        onReturned={() => {
          setDrawerVersion((value) => value + 1);
          reload();
        }}
        updating={updating}
        canWrite={canWrite}
      />

      {canWrite && (
        <CreateOrderModal
          open={createOpen || createRequested}
          onClose={closeCreate}
          initialCustomerId={params.get("customer") ?? undefined}
          onCreated={(id) => {
            closeCreate();
            reload();
            if (id) updateParams({ new: null, customer: null, view: id });
          }}
        />
      )}
    </div>
  );
}
