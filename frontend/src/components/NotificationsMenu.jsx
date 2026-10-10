import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./ui/Icon";
import { Popover, toneStyle } from "./ui/primitives";
import { formatDate, money, timeAgo, useResource } from "../lib/api";

import { t } from "../i18n";
const SEEN_KEY = "b2b-seen-notifications";

function readSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function buildNotifications(stats) {
  if (!stats) return [];

  const items = [];

  for (const product of stats.lowStockProducts ?? []) {
    const out = Number(product.stock) === 0;
    items.push({
      id: `stock-${product.id}-${product.stock}`,
      tone: out ? "danger" : "warning",
      icon: out ? "ban" : "alert",
      title: out ? t("{product} is out of stock", { product: product.name }) : t("{product} is running low", { product: product.name }),
      body: out ? t("Out of stock") : t("Only {count} units left.", { count: product.stock }),
      to: "/inventory",
    });
  }

  const overdueCount = stats.receivables?.overdueCount ?? 0;
  if (overdueCount > 0) {
    items.push({
      // Re-notify when the overdue amount changes, not on every visit.
      id: `overdue-${overdueCount}-${Math.round(stats.receivables.overdue)}`,
      tone: "danger",
      icon: "wallet",
      title: overdueCount === 1 ? t("1 overdue invoice") : t("{count} overdue invoices", { count: overdueCount }),
      body: t("{amount} past the 30-day payment terms.", { amount: money(stats.receivables.overdue) }),
      to: "/receivables",
    });
  }

  for (const quote of stats.quotes?.expiringSoon ?? []) {
    const days = Number(quote.days_left);
    items.push({
      id: `quote-expiring-${quote.id}-${quote.valid_until}`,
      tone: "warning",
      icon: "fileText",
      title: days === 0 ? t("Quote for {customer} expires today", { customer: quote.company_name }) : days === 1 ? t("Quote for {customer} expires tomorrow", { customer: quote.company_name }) : t("Quote for {customer} expires in {count} days", { customer: quote.company_name, count: days }),
      body: t("Valid until {date}", { date: formatDate(`${quote.valid_until}T00:00:00`) }),
      to: `/quotes?view=${quote.id}`,
    });
  }

  const lateDeliveries = stats.purchasing?.lateOrders ?? 0;
  if (lateDeliveries > 0) {
    items.push({
      id: `po-late-${lateDeliveries}`,
      tone: "danger",
      icon: "truck",
      title: lateDeliveries === 1 ? t("1 supplier delivery is overdue") : t("{count} supplier deliveries are overdue", { count: lateDeliveries }),
      body: t("Past the expected delivery date"),
      to: "/purchase-orders?status=late",
    });
  }

  const readyToConvert = stats.quotes?.readyToConvert ?? 0;
  if (readyToConvert > 0) {
    items.push({
      id: `quotes-accepted-${readyToConvert}`,
      tone: "info",
      icon: "orders",
      title: readyToConvert === 1 ? t("1 accepted quote ready to convert") : t("{count} accepted quotes ready to convert", { count: readyToConvert }),
      body: t("Turn them into orders to reserve the stock."),
      to: "/quotes",
    });
  }

  const pending = stats.ordersByStatus?.Pending ?? 0;
  if (pending > 0) {
    items.push({
      id: `pending-${pending}`,
      tone: "primary",
      icon: "clock",
      title: pending === 1 ? t("1 order awaiting processing") : t("{count} orders awaiting processing", { count: pending }),
      body: t("Waiting to be processed"),
      to: "/orders?status=Pending",
    });
  }

  for (const order of (stats.recentOrders ?? []).slice(0, 3)) {
    items.push({
      id: `order-${order.id}`,
      tone: "success",
      icon: "orders",
      title: t("New order #{id} from {customer}", { id: order.id, customer: order.company_name ?? t("a customer") }),
      body: `${money(order.total_amount)} · ${timeAgo(order.created_at)}`,
      to: `/orders?view=${order.id}`,
    });
  }

  return items;
}

export default function NotificationsMenu() {
  const { data, loading, reload } = useResource("/dashboard/stats");
  const [seen, setSeen] = useState(readSeen);

  const notifications = buildNotifications(data?.data);
  const unread = notifications.filter((item) => !seen.has(item.id)).length;

  function markAllSeen() {
    const next = new Set(notifications.map((item) => item.id));
    setSeen(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...next]));
    } catch {
      // Read state is kept for this session only.
    }
  }

  return (
    <Popover
      label={t("Notifications")}
      width={360}
      trigger={({ open, props }) => (
        <button
          type="button"
          {...props}
          onClick={(event) => {
            if (!open) reload();
            props.onClick(event);
          }}
          aria-label={unread ? t("Notifications, {count} unread", { count: unread }) : t("Notifications")}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-[var(--surface-hover)] app-text-secondary"
        >
          <Icon name="bell" size={19} className={unread ? "origin-top animate-[wiggle_1s_ease-in-out_2]" : ""} />
          {unread > 0 && (
            <span
              className="absolute end-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-[var(--surface)]"
              style={{ backgroundColor: "var(--danger)" }}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
            <div>
              <p className="text-sm font-bold app-text">{t("Notifications")}</p>
              <p className="text-xs app-text-muted">{unread ? `${unread} unread` : "No unread notifications"}</p>
            </div>
            {unread > 0 && (
              <button type="button" onClick={markAllSeen} className="text-xs font-semibold hover:underline" style={{ color: "var(--primary)" }}>
                {t("Mark all read")}
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading && !data ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex gap-3">
                    <div className="skeleton h-9 w-9 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3.5 w-3/4" />
                      <div className="skeleton h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={toneStyle("success")}>
                  <Icon name="checkCircle" size={22} />
                </div>
                <p className="text-sm font-semibold app-text">{t("No notifications")}</p>
                <p className="mt-1 text-xs app-text-secondary">{t("Low stock, overdue invoices and pending orders show up here.")}</p>
              </div>
            ) : (
              notifications.map((item) => {
                const isUnread = !seen.has(item.id);
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    onClick={close}
                    className="flex gap-3 border-b px-4 py-3 transition last:border-b-0 hover:bg-[var(--surface-hover)]"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={toneStyle(item.tone)}>
                      <Icon name={item.icon} size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${isUnread ? "font-semibold app-text" : "app-text-secondary"}`}>{item.title}</p>
                      <p className="mt-0.5 text-xs app-text-muted">{item.body}</p>
                    </div>
                    {isUnread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: "var(--primary)" }} />}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}
