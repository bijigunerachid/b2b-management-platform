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

import { t } from "../../i18n";
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
    toast.success(`${available.length === 1 ? t("1 product added to your cart") : t("{count} products added to your cart", { count: available.length })}${skipped ? ` (${t("{count} no longer available", { count: skipped })})` : ""}. ${t("Prices are updated when you order.")}`, { title: t("Added to cart") });
    onClose();
    cart.setOpen(true);
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={orderId ? t("Order #{id}", { id: orderId }) : ""}
      description={order ? t("Placed {date}", { date: formatDate(order.created_at, true) }) : t("Loading...")}
      icon="orders"
      footer={
        order && (
          <>
            <Button icon="refresh" onClick={() => reorder(order)} className="me-auto">
              {t("Reorder")}
            </Button>
            <a
              href={`/portal/orders/${order.id}/invoice`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--control-radius)] px-4 text-sm font-semibold shadow-sm transition hover:brightness-110"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-contrast)" }}
            >
              <Icon name="download" size={17} /> {t("Invoice")}
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
                  <Icon name="ban" size={18} /> {t("This order was cancelled.")}
                </p>
              ) : (
                <ol className="flex items-start">
                  {STATUS_FLOW.map((step, index) => {
                    const done = index <= reached;
                    return (
                      <li key={step} className="relative flex flex-1 flex-col items-center text-center">
                        {index < STATUS_FLOW.length - 1 && (
                          <span className="absolute start-1/2 top-4 h-0.5 w-full" style={{ backgroundColor: index < reached ? "var(--success)" : "var(--border-color)" }} />
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
                    <p className="text-xs font-medium uppercase tracking-wide app-text-muted">{t("Balance due")}</p>
                    <p className="text-xl font-bold tabular-nums app-text">{money(order.billing.balance)}</p>
                    <p className="text-xs app-text-secondary">
                      {order.billing.payment_status === "Credited"
                        ? t("Invoice of {amount} fully credited", { amount: money(order.billing.invoice_total) })
                        : order.billing.credited > 0 ? t("of {total} incl. VAT, after {credited} credited", { total: money(order.billing.total_due), credited: money(order.billing.credited) }) : t("of {total} incl. VAT", { total: money(order.billing.total_due) })}
                      {order.billing.balance > 0 && ` · ${t("due {date}", { date: formatDate(order.billing.due_date) })}`}
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
                {order.credit_notes.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t pt-3 text-xs app-text-secondary" style={{ borderColor: "var(--border-color)" }}>
                    {order.credit_notes.map((note) => (
                      <li key={note.id} className="flex justify-between gap-3">
                        <span>
                          <a href={`/portal/credit-notes/${note.id}/print`} target="_blank" rel="noopener" className="font-semibold hover:underline" style={{ color: "var(--primary)" }}>
                            {note.number}
                          </a>
                          {" · "}
                          {note.reason}
                          {note.refund_amount > 0 && `, ${t("{amount} refunded", { amount: money(note.refund_amount) })}`}
                        </span>
                        <span className="font-semibold tabular-nums app-text">−{money(note.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
              <table className="w-full text-start text-sm">
                <TableHead>
                  <Th className="!px-4">{t("Product")}</Th>
                  <Th className="!px-4" align="right">{t("Qty")}</Th>
                  <Th className="!px-4" align="right">{t("Amount")}</Th>
                </TableHead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.product_id} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                      <td className="px-4 py-3">
                        <p className="font-medium app-text">{item.product_name}</p>
                        <p className="text-xs app-text-muted">
                          {Number(item.list_price) > Number(item.unit_price) + 0.004 && <span className="me-1 line-through">{money(item.list_price)}</span>}
                          {t("{price} each", { price: money(item.unit_price) })}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums app-text">×{item.quantity}</td>
                      <td className="px-4 py-3 text-end font-semibold tabular-nums app-text">{money(item.subtotal)}</td>
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
      <PageHeader title={t("Your orders")} />
      {error && <ErrorState message={error} onRetry={reload} />}
      <Card>
        <div className="border-b p-4" style={{ borderColor: "var(--border-color)" }}>
          <SegmentedControl
            label={t("Filter orders")}
            value={filter}
            onChange={(value) => {
              setFilter(value);
              table.setPage(1);
            }}
            options={Object.entries(filters).map(([value, option]) => ({ value, label: t(option.label), count: orders.filter(option.match).length }))}
          />
        </div>
        {loading && !data ? (
          <TableSkeleton columns={5} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="orders" title={t("No orders here")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-start text-sm">
              <TableHead>
                <Th>{t("Order")}</Th>
                <Th>{t("Status")}</Th>
                <Th>{t("Payment")}</Th>
                <Th align="right">{t("Total (TTC)")}</Th>
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
                      <td className="whitespace-nowrap px-5 py-3.5 text-end font-semibold tabular-nums app-text">{money(order.billing.total_due)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && <Pagination page={table.page} totalPages={table.totalPages} total={table.total} pageSize={table.pageSize} onPageChange={table.setPage} label={t("orders")} />}
      </Card>
      <OrderDrawer orderId={viewId ?? lastViewId} open={Boolean(viewId)} onClose={() => setView(null)} />
    </div>
  );
}
