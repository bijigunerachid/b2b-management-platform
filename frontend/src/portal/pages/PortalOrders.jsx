import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import { Drawer } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/feedback";
import { Badge, Card, EmptyState, ErrorState, InlineAlert, PageHeader, Pagination, SegmentedControl, TableHead, TableSkeleton, Th } from "../../components/ui/primitives";
import { formatDate, money, toList, useResource } from "../../lib/api";
import { paymentBadge } from "../../lib/billing";
import { ORDER_STATUS, STATUS_FLOW } from "../../lib/orderStatus";
import useTable from "../../lib/useTable";
import { useCart } from "../CartContext";

const filters = {
  all: { label: "All", match: () => true },
  progress: { label: "In progress", match: (o) => o.status === "Pending" || o.status === "Processing" },
  unpaid: { label: "To pay", match: (o) => o.status !== "Cancelled" && o.billing.balance > 0 },
  completed: { label: "Completed", match: (o) => o.status === "Completed" },
};

function OrderDrawer({ orderId, open, onClose }) {
  const cart = useCart();
  const toast = useToast();
  const { data, loading, error } = useResource(orderId ? `/portal/orders/${orderId}` : null);
  const order = data?.data;
  const cancelled = order?.status === "Cancelled";
  const reached = order ? STATUS_FLOW.indexOf(order.status) : -1;

  // Pass the order in: the React Compiler memoizes this function and would
  // otherwise read order.items while the order is still loading.
  function reorder(current) {
    const available = current.items.filter((item) => item.product_active);
    available.forEach((item) => cart.add({ id: item.product_id, name: item.product_name, price: item.unit_price }, item.quantity));
    const skipped = current.items.length - available.length;
    toast.success(`${available.length} product${available.length === 1 ? "" : "s"} added to your cart${skipped ? ` (${skipped} no longer available)` : ""}. Prices are updated when you order.`, { title: "Added to cart" });
    onClose();
    cart.setOpen(true);
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={orderId ? `Order #${orderId}` : ""}
      description={order ? `Placed ${formatDate(order.created_at, true)}` : "Loading..."}
      icon="orders"
      footer={
        order && (
          <>
            <Button icon="refresh" onClick={() => reorder(order)} className="mr-auto">
              Reorder
            </Button>
            <a
              href={`/portal/orders/${order.id}/invoice`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--control-radius)] px-4 text-sm font-semibold shadow-sm transition hover:brightness-110"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-contrast)" }}
            >
              <Icon name="download" size={17} /> Invoice
            </a>
          </>
        )
      }
    >
      {error ? (
        <InlineAlert>{error}</InlineAlert>
      ) : loading && !order ? (
        <div className="space-y-3">
          <div className="skeleton h-20 rounded-xl" />
          <div className="skeleton h-48 rounded-xl" />
        </div>
      ) : (
        order && (
          <div className="space-y-6">
            <div className="rounded-xl border p-5" style={{ borderColor: "var(--border-color)" }}>
              {cancelled ? (
                <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--danger)" }}>
                  <Icon name="ban" size={18} /> This order was cancelled.
                </p>
              ) : (
                <ol className="flex items-start">
                  {STATUS_FLOW.map((step, index) => {
                    const done = index <= reached;
                    return (
                      <li key={step} className="relative flex flex-1 flex-col items-center text-center">
                        {index < STATUS_FLOW.length - 1 && (
                          <span className="absolute left-1/2 top-4 h-0.5 w-full" style={{ backgroundColor: index < reached ? "var(--success)" : "var(--border-color)" }} />
                        )}
                        <span
                          className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2"
                          style={done ? { borderColor: "var(--success)", backgroundColor: "var(--success-soft)", color: "var(--success)" } : { borderColor: "var(--border-color)", backgroundColor: "var(--surface)", color: "var(--text-muted)" }}
                        >
                          <Icon name={done ? "check" : ORDER_STATUS[step].icon} size={15} strokeWidth={2.2} />
                        </span>
                        <span className={`mt-2 text-xs font-semibold ${done ? "app-text" : "app-text-muted"}`}>
                          {step === "Pending" ? "Received" : step === "Processing" ? "Preparing" : "Delivered"}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {!cancelled && (
              <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-color)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide app-text-muted">Balance due</p>
                    <p className="text-xl font-bold tabular-nums app-text">{money(order.billing.balance)}</p>
                    <p className="text-xs app-text-secondary">
                      of {money(order.billing.total_due)} incl. VAT
                      {order.billing.balance > 0 && ` · due ${formatDate(order.billing.due_date)}`}
                    </p>
                  </div>
                  <Badge tone={paymentBadge(order.billing).tone} icon={paymentBadge(order.billing).icon}>
                    {paymentBadge(order.billing).label}
                  </Badge>
                </div>
                {order.payments.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t pt-3 text-xs app-text-secondary" style={{ borderColor: "var(--border-color)" }}>
                    {order.payments.map((payment) => (
                      <li key={payment.id} className="flex justify-between gap-3">
                        <span>
                          {formatDate(`${payment.paid_at}T00:00:00`)} · {payment.method}
                        </span>
                        <span className="font-semibold tabular-nums app-text">{money(payment.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
              <table className="w-full text-left text-sm">
                <TableHead>
                  <Th className="!px-4">Product</Th>
                  <Th className="!px-4" align="right">Qty</Th>
                  <Th className="!px-4" align="right">Amount</Th>
                </TableHead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.product_id} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                      <td className="px-4 py-3">
                        <p className="font-medium app-text">{item.product_name}</p>
                        <p className="text-xs app-text-muted">{money(item.unit_price)} each</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums app-text">×{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums app-text">{money(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </Drawer>
  );
}

export default function PortalOrders() {
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useResource("/portal/orders");
  const orders = useMemo(() => toList(data), [data]);
  const [filter, setFilter] = useState(() => (filters[params.get("filter")] ? params.get("filter") : "all"));

  const viewId = params.get("view");
  const [lastViewId, setLastViewId] = useState(viewId);
  if (viewId && viewId !== lastViewId) setLastViewId(viewId);

  const filtered = useMemo(() => orders.filter(filters[filter].match), [orders, filter]);
  const table = useTable(filtered, { accessors: { date: (o) => new Date(o.created_at).getTime() }, initialSort: { key: "date", direction: "desc" } });

  function setView(id) {
    const next = new URLSearchParams(params);
    if (id === null) next.delete("view");
    else next.set("view", id);
    setParams(next, { replace: true });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Your orders" />
      {error && <ErrorState message={error} onRetry={reload} />}
      <Card>
        <div className="border-b p-4" style={{ borderColor: "var(--border-color)" }}>
          <SegmentedControl
            label="Filter orders"
            value={filter}
            onChange={(value) => {
              setFilter(value);
              table.setPage(1);
            }}
            options={Object.entries(filters).map(([value, option]) => ({ value, label: option.label, count: orders.filter(option.match).length }))}
          />
        </div>
        {loading && !data ? (
          <TableSkeleton columns={5} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="orders" title="No orders here" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <TableHead>
                <Th>Order</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th align="right">Total (TTC)</Th>
              </TableHead>
              <tbody>
                {table.rows.map((order) => {
                  const status = ORDER_STATUS[order.status];
                  const payment = paymentBadge(order.billing);
                  return (
                    <tr key={order.id} onClick={() => setView(order.id)} className="cursor-pointer border-t transition-colors hover:bg-[var(--surface-hover)]" style={{ borderColor: "var(--border-color)" }}>
                      <td className="px-5 py-3.5">
                        <p className="font-bold app-text">#{order.id}</p>
                        <p className="text-xs app-text-muted">
                          {formatDate(order.created_at)} · {order.item_count} product{order.item_count === 1 ? "" : "s"}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={status?.tone} icon={status?.icon}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        {order.status === "Cancelled" ? (
                          <span className="app-text-muted">—</span>
                        ) : (
                          <Badge tone={payment.tone} icon={payment.icon}>
                            {payment.label}
                          </Badge>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums app-text">{money(order.billing.total_due)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && <Pagination page={table.page} totalPages={table.totalPages} total={table.total} pageSize={table.pageSize} onPageChange={table.setPage} label="orders" />}
      </Card>
      <OrderDrawer orderId={viewId ?? lastViewId} open={Boolean(viewId)} onClose={() => setView(null)} />
    </div>
  );
}
