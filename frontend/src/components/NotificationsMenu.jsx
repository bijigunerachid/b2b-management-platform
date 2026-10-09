import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./ui/Icon";
import { Popover, toneStyle } from "./ui/primitives";
import { money, timeAgo, useResource } from "../lib/api";

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
      title: out ? `${product.name} is out of stock` : `${product.name} is running low`,
      body: out ? "Restock to accept new orders." : `Only ${product.stock} units left.`,
      to: `/products?q=${encodeURIComponent(product.name)}`,
    });
  }

  const overdueCount = stats.receivables?.overdueCount ?? 0;
  if (overdueCount > 0) {
    items.push({
      // Re-notify when the overdue amount changes, not on every visit.
      id: `overdue-${overdueCount}-${Math.round(stats.receivables.overdue)}`,
      tone: "danger",
      icon: "wallet",
      title: `${overdueCount} overdue invoice${overdueCount === 1 ? "" : "s"}`,
      body: `${money(stats.receivables.overdue)} past the 30-day payment terms.`,
      to: "/receivables",
    });
  }

  const pending = stats.ordersByStatus?.Pending ?? 0;
  if (pending > 0) {
    items.push({
      id: `pending-${pending}`,
      tone: "primary",
      icon: "clock",
      title: `${pending} order${pending === 1 ? "" : "s"} awaiting processing`,
      body: "Review and move them forward.",
      to: "/orders?status=Pending",
    });
  }

  for (const order of (stats.recentOrders ?? []).slice(0, 3)) {
    items.push({
      id: `order-${order.id}`,
      tone: "success",
      icon: "orders",
      title: `New order #${order.id} from ${order.company_name ?? "a customer"}`,
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
      label="Notifications"
      width={360}
      trigger={({ open, props }) => (
        <button
          type="button"
          {...props}
          onClick={(event) => {
            if (!open) reload();
            props.onClick(event);
          }}
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-[var(--surface-hover)] app-text-secondary"
        >
          <Icon name="bell" size={19} className={unread ? "origin-top animate-[wiggle_1s_ease-in-out_2]" : ""} />
          {unread > 0 && (
            <span
              className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-[var(--surface)]"
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
              <p className="text-sm font-bold app-text">Notifications</p>
              <p className="text-xs app-text-muted">{unread ? `${unread} unread` : "You're all caught up"}</p>
            </div>
            {unread > 0 && (
              <button type="button" onClick={markAllSeen} className="text-xs font-semibold hover:underline" style={{ color: "var(--primary)" }}>
                Mark all read
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
                <p className="text-sm font-semibold app-text">Nothing needs your attention</p>
                <p className="mt-1 text-xs app-text-secondary">Stock levels and orders look healthy.</p>
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
