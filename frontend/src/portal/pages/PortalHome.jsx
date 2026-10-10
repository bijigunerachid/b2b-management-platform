import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Icon from "../../components/ui/Icon";
import { Badge, Card, CardHeader, EmptyState, ErrorState, StatCard } from "../../components/ui/primitives";
import { compactMoney, formatDate, money, number, useResource } from "../../lib/api";
import { paymentBadge } from "../../lib/billing";
import { ORDER_STATUS } from "../../lib/orderStatus";

import { t } from "../../i18n";
export default function PortalHome() {
  const { user } = useAuth();
  const { data, error, reload } = useResource("/portal/summary");
  const summary = data?.data;

  if (!summary) {
    return error ? (
      <ErrorState message={error} onRetry={reload} />
    ) : (
      <div className="space-y-6" aria-busy="true">
        <div className="skeleton h-28 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight app-text">{summary.customer.company_name}</h1>
          <p className="mt-1 text-sm app-text-secondary">{t("Signed in as {email}", { email: `${user?.first_name} ${user?.last_name}` })}</p>
        </div>
        <Link
          to="/portal/catalog"
          className="inline-flex h-10 items-center gap-2 self-start rounded-lg px-4 text-sm font-semibold sm:self-auto"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-contrast)" }}
        >
          <Icon name="products" size={17} /> {t("Place an order")}
        </Link>
      </div>

      {summary.overdue > 0 && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)", borderColor: "color-mix(in srgb, var(--danger) 30%, transparent)" }}
        >
          <p className="flex items-center gap-2 text-sm font-medium">
            <Icon name="alert" size={18} /> {summary.overdue_count === 1 ? t("{amount} is past due on 1 invoice.", { amount: money(summary.overdue) }) : t("{amount} is past due across {count} invoices.", { amount: money(summary.overdue), count: summary.overdue_count })}
          </p>
          <Link to="/portal/orders?filter=unpaid" className="text-sm font-semibold underline">
            {t("View invoices")}
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("Open balance")} value={compactMoney(summary.balance)} hint={t("Including VAT")} icon="wallet" tone="primary" />
        <StatCard label={t("Past due")} value={compactMoney(summary.overdue)} hint={summary.overdue ? (summary.overdue_count === 1 ? t("1 invoice") : t("{count} invoices", { count: summary.overdue_count })) : t("Nothing overdue")} icon="alert" tone={summary.overdue ? "danger" : "success"} />
        <StatCard label={t("Orders in progress")} value={number(summary.orders_in_progress)} hint={t("Pending or processing")} icon="truck" tone="info" />
        <StatCard label={t("Quotes to review")} value={number(summary.quotes_awaiting)} hint={t("Waiting for your reply")} icon="fileText" tone="warning" />
      </div>

      <Card>
        <CardHeader
          title={t("Recent orders")}
          actions={
            <Link to="/portal/orders" className="text-sm font-semibold hover:underline" style={{ color: "var(--primary)" }}>
              {t("View all")}
            </Link>
          }
        />
        {summary.recent_orders.length === 0 ? (
          <EmptyState icon="orders" title={t("No orders yet")} />
        ) : (
          <ul>
            {summary.recent_orders.map((order) => {
              const status = ORDER_STATUS[order.status];
              const payment = paymentBadge(order.billing);
              return (
                <li key={order.id} className="border-t first:border-t-0" style={{ borderColor: "var(--border-color)" }}>
                  <Link to={`/portal/orders?view=${order.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-[var(--surface-hover)]">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold app-text">{t("Order #{id}", { id: order.id })}</p>
                      <p className="text-xs app-text-muted">{formatDate(order.created_at)}</p>
                    </div>
                    <Badge tone={status?.tone} icon={status?.icon}>
                      {order.status}
                    </Badge>
                    {order.status !== "Cancelled" && (
                      <Badge tone={payment.tone} icon={payment.icon}>
                        {payment.label}
                      </Badge>
                    )}
                    <span className="w-32 text-end text-sm font-semibold tabular-nums app-text">{money(order.billing.total_due)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
