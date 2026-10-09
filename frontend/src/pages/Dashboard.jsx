
import { useEffect, useState } from "react";

const API_URL = "http://localhost:5000/api/dashboard/stats";

const money = (value) =>
  new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
  }).format(Number(value) || 0);

const number = (value) =>
  new Intl.NumberFormat("fr-MA").format(Number(value) || 0);

const statusStyles = {
  Pending: {
    background: "var(--warning-soft)",
    color: "var(--warning)",
    label: "Pending",
  },
  Processing: {
    background: "var(--primary-soft)",
    color: "var(--primary)",
    label: "Processing",
  },
  Completed: {
    background: "var(--success-soft)",
    color: "var(--success)",
    label: "Completed",
  },
  Cancelled: {
    background: "var(--danger-soft)",
    color: "var(--danger)",
    label: "Cancelled",
  },
};

function StatCard({ title, value, description, icon, accent }) {
  return (
    <article
      className="rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-6"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border-color)",
        boxShadow: "var(--card-shadow)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-sm font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            {title}
          </p>

          <p
            className="mt-3 break-words text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ color: "var(--text-primary)" }}
          >
            {value}
          </p>
        </div>

        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{
            backgroundColor: accent,
            color: "var(--primary)",
          }}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>

      <p
        className="mt-4 border-t pt-3 text-xs leading-5"
        style={{
          borderColor: "var(--border-color)",
          color: "var(--text-secondary)",
        }}
      >
        {description}
      </p>
    </article>
  );
}

function SectionHeader({ title, description, count }) {
  return (
    <div
      className="flex flex-col gap-2 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
      style={{ borderColor: "var(--border-color)" }}
    >
      <div>
        <h2
          className="text-base font-bold sm:text-lg"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h2>

        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          {description}
        </p>
      </div>

      {count !== undefined && (
        <span
          className="w-fit rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            backgroundColor: "var(--primary-soft)",
            color: "var(--primary)",
          }}
        >
          {count} items
        </span>
      )}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="px-6 py-12 text-center">
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
        style={{
          backgroundColor: "var(--surface-muted)",
          color: "var(--text-secondary)",
        }}
        aria-hidden="true"
      >
        ✓
      </div>

      <p
        className="mt-3 text-sm font-medium"
        style={{ color: "var(--text-primary)" }}
      >
        {message}
      </p>
    </div>
  );
}

function TableHeader({ children }) {
  return (
    <th
      className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide sm:px-6"
      style={{
        backgroundColor: "var(--surface-muted)",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </th>
  );
}

function TableCell({ children, className = "" }) {
  return (
    <td
      className={`px-5 py-4 text-sm sm:px-6 ${className}`}
      style={{ color: "var(--text-primary)" }}
    >
      {children}
    </td>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  async function loadStats() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL, {
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Unable to load dashboard."
        );
      }

      setStats(result.data ?? result);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  const today = new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const cardBase = {
    backgroundColor: "var(--surface)",
    borderColor: "var(--border-color)",
    boxShadow: "var(--card-shadow)",
  };

  if (loading && !stats) {
    return (
      <div className="space-y-6" aria-live="polite">
        <div>
          <div
            className="h-8 w-52 animate-pulse rounded-lg"
            style={{ backgroundColor: "var(--border-color)" }}
          />
          <div
            className="mt-3 h-4 w-72 max-w-full animate-pulse rounded"
            style={{ backgroundColor: "var(--border-color)" }}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-2xl border"
              style={cardBase}
            />
          ))}
        </div>

        <p
          className="text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Loading dashboard statistics...
        </p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-5">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Dashboard
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Your business overview
          </p>
        </div>

        <div
          className="rounded-2xl border p-5"
          style={{
            backgroundColor: "var(--danger-soft)",
            borderColor: "var(--danger)",
            color: "var(--danger)",
          }}
          role="alert"
        >
          <p className="font-semibold">
            Unable to load dashboard
          </p>
          <p className="mt-1 text-sm">
            {error || "Dashboard data is unavailable."}
          </p>
        </div>

        <button
          type="button"
          onClick={loadStats}
          className="app-primary-button"
        >
          Try again
        </button>
      </div>
    );
  }

  const cards = [
    {
      title: "Total Customers",
      value: number(stats.totalCustomers),
      description: "Registered business customers",
      icon: "♙",
      accent: "var(--primary-soft)",
    },
    {
      title: "Total Products",
      value: number(stats.totalProducts),
      description: "Products in your inventory",
      icon: "▤",
      accent: "var(--primary-soft)",
    },
    {
      title: "Total Orders",
      value: number(stats.totalOrders),
      description: "Orders recorded in the database",
      icon: "☷",
      accent: "var(--primary-soft)",
    },
    {
      title: "Revenue",
      value: money(stats.totalRevenue),
      description: "Completed orders only",
      icon: "↗",
      accent: "var(--success-soft)",
    },
  ];

  const lowStockProducts = stats.lowStockProducts || [];
  const recentOrders = stats.recentOrders || [];

  return (
    <div className="space-y-7 sm:space-y-8">
      {/* Welcome section */}
      <section
        className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
        style={{
          background:
            "linear-gradient(120deg, #1d4ed8 0%, #2563eb 60%, #3b82f6 100%)",
          color: "#ffffff",
        }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full"
          style={{ backgroundColor: "rgb(255 255 255 / 8%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 right-32 h-48 w-48 rounded-full"
          style={{ backgroundColor: "rgb(255 255 255 / 7%)" }}
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-100">
              BUSINESS OVERVIEW
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome to your dashboard
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100">
              Monitor your customers, inventory, orders, and business revenue
              from one place.
            </p>

            <p className="mt-4 text-sm font-medium text-white/90">
              {today}
            </p>
          </div>

          <button
            type="button"
            onClick={loadStats}
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/20 disabled:cursor-wait disabled:opacity-70"
            style={{
              backgroundColor: "rgb(255 255 255 / 10%)",
              borderColor: "rgb(255 255 255 / 30%)",
              color: "#ffffff",
            }}
          >
            <span aria-hidden="true">{loading ? "◌" : "↻"}</span>
            {loading ? "Refreshing..." : "Refresh statistics"}
          </button>
        </div>
      </section>

      {/* Refresh error while retaining existing statistics */}
      {error && (
        <div
          className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{
            backgroundColor: "var(--danger-soft)",
            borderColor: "var(--danger)",
            color: "var(--danger)",
          }}
          role="alert"
        >
          <p className="text-sm">{error} Showing the last loaded data.</p>
          <button
            type="button"
            onClick={loadStats}
            className="text-sm font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI cards */}
      <section aria-label="Business statistics">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2
            className="text-lg font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Key metrics
          </h2>

          {lastUpdated && (
            <p
              className="text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>
      </section>

      {/* Low-stock section */}
      <section
        className="overflow-hidden rounded-2xl border"
        style={cardBase}
      >
        <SectionHeader
          title="Low-stock alerts"
          description="Active products with five or fewer units remaining."
          count={lowStockProducts.length}
        />

        {lowStockProducts.length === 0 ? (
          <EmptyState message="No low-stock products found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <TableHeader>Product</TableHeader>
                  <TableHeader>Stock remaining</TableHeader>
                </tr>
              </thead>

              <tbody>
                {lowStockProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="border-t transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <TableCell>
                      <span className="font-semibold">
                        {product.name}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span
                        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
                        style={{
                          backgroundColor: "var(--danger-soft)",
                          color: "var(--danger)",
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: "var(--danger)" }}
                          aria-hidden="true"
                        />
                        {product.stock} left
                      </span>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent orders section */}
      <section
        className="overflow-hidden rounded-2xl border"
        style={cardBase}
      >
        <SectionHeader
          title="Recent orders"
          description="Your five most recently created orders."
          count={recentOrders.length}
        />

        {recentOrders.length === 0 ? (
          <EmptyState message="No orders recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <TableHeader>Order</TableHeader>
                  <TableHeader>Customer</TableHeader>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Total</TableHeader>
                  <TableHeader>Status</TableHeader>
                </tr>
              </thead>

              <tbody>
                {recentOrders.map((order) => {
                  const status =
                    statusStyles[order.status] || {
                      background: "var(--surface-muted)",
                      color: "var(--text-secondary)",
                      label: order.status || "Unknown",
                    };

                  return (
                    <tr
                      key={order.id}
                      className="border-t transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      <TableCell>
                        <span
                          className="font-bold"
                          style={{ color: "var(--primary)" }}
                        >
                          #{order.id}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="block min-w-32 font-medium">
                          {order.company_name || "Unknown customer"}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="whitespace-nowrap">
                          {order.created_at
                            ? new Date(order.created_at).toLocaleDateString(
                                "fr-MA"
                              )
                            : "—"}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="whitespace-nowrap font-semibold">
                          {money(order.total_amount)}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span
                          className="inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold"
                          style={{
                            backgroundColor: status.background,
                            color: status.color,
                          }}
                        >
                          {status.label}
                        </span>
                      </TableCell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer
        className="pb-2 text-center text-xs"
        style={{ color: "var(--text-secondary)" }}
      >
        B2B Management Platform · Business overview
      </footer>
    </div>
  );
}