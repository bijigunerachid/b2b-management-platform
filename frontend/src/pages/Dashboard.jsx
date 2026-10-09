
import { useEffect, useState } from "react";

const API_URL = "http://localhost:5000/api/dashboard/stats";

const money = (value) =>
  new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
  }).format(Number(value) || 0);

const statusStyles = {
  Pending: "bg-amber-100 text-amber-800",
  Processing: "bg-blue-100 text-blue-800",
  Completed: "bg-green-100 text-green-800",
  Cancelled: "bg-red-100 text-red-800",
};

function StatCard({ title, value, description }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-bold text-slate-900">
        {value}
      </p>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    } catch (err) {
      setError(err.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-slate-500">
        Loading dashboard statistics...
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">
          Dashboard
        </h1>

        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error || "Dashboard data is unavailable."}
        </div>

        <button
          onClick={loadStats}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    );
  }

  const cards = [
    {
      title: "Total Customers",
      value: stats.totalCustomers ?? 0,
      description: "Registered business customers",
    },
    {
      title: "Total Products",
      value: stats.totalProducts ?? 0,
      description: "Products in your inventory",
    },
    {
      title: "Total Orders",
      value: stats.totalOrders ?? 0,
      description: "Orders recorded in the database",
    },
    {
      title: "Revenue",
      value: money(stats.totalRevenue),
      description: "Completed orders only",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Overview of your business operations.
          </p>
        </div>

        <button
          onClick={loadStats}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Refresh statistics
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-800">
            Low-stock alerts
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Active products with five or fewer units remaining.
          </p>
        </div>

        {!stats.lowStockProducts?.length ? (
          <p className="p-5 text-sm text-slate-500">
            No low-stock products found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Stock remaining</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {stats.lowStockProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="px-5 py-3 font-medium text-slate-800">
                      {product.name}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                        {product.stock} left
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-800">
            Recent orders
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Your five most recently created orders.
          </p>
        </div>

        {!stats.recentOrders?.length ? (
          <p className="p-5 text-sm text-slate-500">
            No orders recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {stats.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-5 py-3 font-semibold">
                      #{order.id}
                    </td>
                    <td className="px-5 py-3">
                      {order.company_name || "Unknown customer"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      {order.created_at
                        ? new Date(order.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      {money(order.total_amount)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          statusStyles[order.status] ||
                          "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}