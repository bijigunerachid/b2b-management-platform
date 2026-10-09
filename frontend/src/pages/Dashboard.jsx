import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/ui/Icon";
import Button from "../components/ui/Button";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  SegmentedControl,
  StatCard,
} from "../components/ui/primitives";
import { can, compactMoney, money, number, timeAgo, useResource } from "../lib/api";
import { ORDER_STATUS } from "../lib/orderStatus";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Rounds `value` up to a 1/2/2.5/5 × 10ⁿ step so axis ticks read cleanly. */
function niceMax(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value);
  return step * magnitude;
}

function monthLabel(key, style = "short") {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en", { month: style });
}

/* ---------- Monthly bar chart ---------- */

function MonthlyChart({ months }) {
  const [measure, setMeasure] = useState("revenue");
  const [hovered, setHovered] = useState(null);

  const values = months.map((month) => month[measure]);
  const max = niceMax(Math.max(...values, 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => fraction * max);
  const format = measure === "revenue" ? compactMoney : number;
  const total = values.reduce((sum, value) => sum + value, 0);

  const current = months[months.length - 1]?.[measure] ?? 0;
  const previous = months[months.length - 2]?.[measure] ?? 0;
  const change = previous > 0 ? ((current - previous) / previous) * 100 : null;

  return (
    <Card className="flex flex-col">
      <CardHeader
        title={measure === "revenue" ? "Completed revenue" : "Orders placed"}
        description="Last six months"
        actions={
          <SegmentedControl
            label="Chart measure"
            value={measure}
            onChange={setMeasure}
            options={[
              { value: "revenue", label: "Revenue" },
              { value: "orders", label: "Orders" },
            ]}
          />
        }
      />

      <div className="flex flex-wrap items-end gap-x-6 gap-y-2 px-5 pt-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide app-text-muted">Six-month total</p>
          <p className="mt-1 text-2xl font-bold tracking-tight app-text">
            {measure === "revenue" ? money(total) : number(total)}
          </p>
        </div>
        {change !== null && (
          <Badge tone={change >= 0 ? "success" : "danger"} icon={change >= 0 ? "sortUp" : "sortDown"} className="mb-1">
            {Math.abs(change).toFixed(0)}% vs last month
          </Badge>
        )}
      </div>

      <div className="relative flex-1 px-5 pb-5 pt-6">
        <div className="relative h-[240px] pl-14">
          {/* Gridlines + y-axis labels */}
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute left-14 right-0 border-t"
              style={{
                bottom: `${(tick / max) * 100}%`,
                borderColor: tick === 0 ? "var(--border-strong)" : "var(--chart-grid)",
                borderStyle: tick === 0 ? "solid" : "dashed",
              }}
            >
              <span className="absolute -left-14 -translate-y-1/2 pr-2 text-right text-[11px] tabular-nums app-text-muted" style={{ width: 52 }}>
                {format(tick)}
              </span>
            </div>
          ))}

          {/* Bars */}
          <div className="relative flex h-full items-end gap-2 sm:gap-4">
            {months.map((month, index) => {
              const value = month[measure];
              const height = (value / max) * 100;
              const isHovered = hovered === index;
              const isLatest = index === months.length - 1;

              return (
                <div
                  key={month.month}
                  className="group relative flex h-full flex-1 cursor-default items-end justify-center"
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(index)}
                  onBlur={() => setHovered(null)}
                  tabIndex={0}
                  aria-label={`${monthLabel(month.month, "long")}: ${money(month.revenue)} revenue, ${month.orders} orders`}
                >
                  {isHovered && (
                    <div className="absolute inset-x-0 bottom-0 top-0 rounded-lg" style={{ backgroundColor: "var(--surface-hover)", opacity: 0.6 }} />
                  )}

                  <div
                    className="relative w-full max-w-12 rounded-t-[4px] transition-all duration-500 ease-out"
                    style={{
                      height: `${Math.max(height, value > 0 ? 1.5 : 0)}%`,
                      backgroundColor: "var(--primary)",
                      opacity: hovered === null ? (isLatest ? 1 : 0.78) : isHovered ? 1 : 0.45,
                    }}
                  />

                  {isHovered && (
                    <div
                      className="pointer-events-none absolute z-10 w-max min-w-36 rounded-lg border px-3 py-2 text-xs shadow-lg animate-fade-in"
                      style={{
                        bottom: `calc(${Math.max(height, 4)}% + 10px)`,
                        backgroundColor: "var(--surface)",
                        borderColor: "var(--border-color)",
                        boxShadow: "var(--pop-shadow)",
                      }}
                    >
                      <p className="font-semibold app-text">
                        {monthLabel(month.month, "long")} {month.month.slice(0, 4)}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-4">
                        <span className="app-text-secondary">Revenue</span>
                        <span className="font-semibold tabular-nums app-text">{money(month.revenue)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-4">
                        <span className="app-text-secondary">Orders</span>
                        <span className="font-semibold tabular-nums app-text">{month.orders}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* X-axis labels */}
        <div className="mt-2 flex gap-2 pl-14 sm:gap-4">
          {months.map((month, index) => (
            <span
              key={month.month}
              className={`flex-1 text-center text-xs ${index === months.length - 1 ? "font-semibold app-text" : "app-text-muted"}`}
            >
              {monthLabel(month.month)}
            </span>
          ))}
        </div>

        {/* Accessible data table */}
        <table className="sr-only">
          <caption>Monthly completed revenue and orders</caption>
          <thead>
            <tr>
              <th>Month</th>
              <th>Revenue</th>
              <th>Orders</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month.month}>
                <td>{month.month}</td>
                <td>{money(month.revenue)}</td>
                <td>{month.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- Order status breakdown ---------- */

function StatusBreakdown({ counts }) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <Card>
      <CardHeader title="Orders by status" description={`${number(total)} orders in total`} />
      <div className="space-y-4 p-5">
        {total === 0 ? (
          <p className="py-8 text-center text-sm app-text-secondary">No orders yet.</p>
        ) : (
          Object.entries(ORDER_STATUS).map(([status, meta]) => {
            const count = counts[status] ?? 0;
            const share = total ? (count / total) * 100 : 0;

            return (
              <Link
                key={status}
                to={`/orders?status=${status}`}
                className="group block rounded-lg outline-none"
              >
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-medium app-text">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: meta.soft, color: meta.color }}>
                      <Icon name={meta.icon} size={14} strokeWidth={2} />
                    </span>
                    <span className="group-hover:underline">{status}</span>
                  </span>
                  <span className="tabular-nums app-text-secondary">
                    <span className="font-semibold app-text">{count}</span> · {share.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-muted)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${share}%`, backgroundColor: meta.color }}
                  />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </Card>
  );
}

/* ---------- Top products ---------- */

function TopProducts({ products }) {
  const max = Math.max(...products.map((product) => product.quantity), 1);

  return (
    <Card>
      <CardHeader title="Top products" description="By units sold, excluding cancelled orders" />
      {products.length === 0 ? (
        <EmptyState icon="products" title="No sales yet" description="Best sellers will appear once orders come in." />
      ) : (
        <ol className="space-y-4 p-5">
          {products.map((product, index) => (
            <li key={product.id} className="flex items-center gap-3">
              <span className="w-5 text-center text-sm font-bold tabular-nums app-text-muted">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium app-text">{product.name}</span>
                  <span className="shrink-0 text-xs tabular-nums app-text-secondary">
                    <span className="font-semibold app-text">{number(product.quantity)}</span> units · {compactMoney(product.revenue)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-muted)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${(product.quantity / max) * 100}%`, backgroundColor: "var(--primary)" }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/* ---------- Page ---------- */

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="skeleton h-40 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="skeleton h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="skeleton h-96 rounded-2xl xl:col-span-2" />
        <div className="skeleton h-96 rounded-2xl" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useResource("/dashboard/stats");
  const stats = data?.data;

  if (!stats) {
    return error ? <ErrorState message={error} onRetry={reload} /> : <DashboardSkeleton />;
  }

  const counts = stats.ordersByStatus ?? {};
  const completed = counts.Completed ?? 0;
  const pending = counts.Pending ?? 0;
  const averageOrder = completed ? stats.totalRevenue / completed : 0;
  const lowStock = stats.lowStockProducts ?? [];
  const recentOrders = stats.recentOrders ?? [];

  const today = new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-2xl p-6 text-white sm:p-8"
        style={{ background: "linear-gradient(120deg, #1e40af 0%, #2563eb 55%, #7c3aed 100%)" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.1]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
            maskImage: "linear-gradient(90deg, transparent, black 70%)",
          }}
        />
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-white/75">{today}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting()}, {user?.first_name || "there"} 👋
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
              {pending > 0
                ? `You have ${pending} pending order${pending === 1 ? "" : "s"} and ${lowStock.length} low-stock alert${lowStock.length === 1 ? "" : "s"} to review.`
                : "Everything is on track. Here's how your business is performing."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {can(user, "orders.write") && (
              <button
                type="button"
                onClick={() => navigate("/orders?new=1")}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <Icon name="plus" size={17} /> New order
              </button>
            )}
            {can(user, "customers.write") && (
              <button
                type="button"
                onClick={() => navigate("/customers?new=1")}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-semibold ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25"
              >
                <Icon name="userPlus" size={17} /> Add customer
              </button>
            )}
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              aria-label="Refresh dashboard"
              title="Refresh"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30 transition hover:bg-white/25 disabled:opacity-60"
            >
              <Icon name="refresh" size={17} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </section>

      {error && <ErrorState message={`${error} Showing the last loaded data.`} onRetry={reload} />}

      {/* KPIs */}
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={compactMoney(stats.totalRevenue)}
          hint={`${money(averageOrder)} average per completed order`}
          icon="revenue"
          tone="success"
          onClick={() => navigate("/orders?status=Completed")}
        />
        <StatCard
          label="Orders"
          value={number(stats.totalOrders)}
          hint={`${pending} pending · ${counts.Processing ?? 0} processing`}
          icon="orders"
          tone="primary"
          onClick={() => navigate("/orders")}
        />
        <StatCard
          label="Customers"
          value={number(stats.totalCustomers)}
          hint="Registered business accounts"
          icon="customers"
          tone="info"
          onClick={() => navigate("/customers")}
        />
        <StatCard
          label="Products"
          value={number(stats.totalProducts)}
          hint={lowStock.length ? `${lowStock.length} running low on stock` : "All stock levels healthy"}
          icon="products"
          tone={lowStock.length ? "warning" : "primary"}
          onClick={() => navigate("/products")}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MonthlyChart months={stats.monthlyRevenue ?? []} />
        </div>
        <StatusBreakdown counts={counts} />
      </div>

      {/* Activity */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recent orders"
            description="The latest activity across your accounts"
            actions={
              <Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => navigate("/orders")}>
                View all
              </Button>
            }
          />
          {recentOrders.length === 0 ? (
            <EmptyState icon="orders" title="No orders yet" description="New orders will show up here." />
          ) : (
            <ul>
              {recentOrders.map((order) => {
                const meta = ORDER_STATUS[order.status];
                return (
                  <li key={order.id} className="border-t first:border-t-0" style={{ borderColor: "var(--border-color)" }}>
                    <Link
                      to={`/orders?view=${order.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-[var(--surface-hover)]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: meta?.soft, color: meta?.color }}>
                        <Icon name={meta?.icon ?? "orders"} size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold app-text">{order.company_name || "Unknown customer"}</p>
                        <p className="text-xs app-text-muted">
                          Order #{order.id} · {timeAgo(order.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums app-text">{money(order.total_amount)}</p>
                        <Badge tone={meta?.tone} className="mt-1 !px-2 !py-0.5 text-[11px]">
                          {order.status}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title={
              <>
                Low-stock alerts
                {lowStock.length > 0 && <Badge tone="warning">{lowStock.length}</Badge>}
              </>
            }
            description="Active products with 5 or fewer units"
          />
          {lowStock.length === 0 ? (
            <EmptyState icon="checkCircle" title="Stock looks healthy" description="No active products are running low." />
          ) : (
            <ul className="space-y-3 p-5">
              {lowStock.map((product) => {
                const stock = Number(product.stock);
                const tone = stock === 0 ? "danger" : "warning";
                return (
                  <li key={product.id}>
                    <Link to={`/products?q=${encodeURIComponent(product.name)}`} className="group block">
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium app-text group-hover:underline">{product.name}</span>
                        <Badge tone={tone} icon={stock === 0 ? "ban" : "alert"}>
                          {stock === 0 ? "Out of stock" : `${stock} left`}
                        </Badge>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-muted)" }}>
                        <div className="h-full rounded-full" style={{ width: `${(stock / 5) * 100}%`, backgroundColor: `var(--${tone})` }} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <TopProducts products={stats.topProducts ?? []} />
    </div>
  );
}
