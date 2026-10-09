
import { useEffect, useMemo, useState } from "react";

const API = "http://localhost:5000/api";

const STATUSES = ["Pending", "Processing", "Completed", "Cancelled"];

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(result.message || "The request failed.");
  }

  return result;
}

function getList(result, key) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.[key])) return result[key];
  return [];
}

function getOrderItems(result) {
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.order_items)) return result.order_items;
  if (Array.isArray(result?.data?.items)) return result.data.items;
  if (Array.isArray(result?.order?.items)) return result.order.items;
  return [];
}

function money(value) {
  return Number(value || 0).toLocaleString("fr-MA", {
    style: "currency",
    currency: "MAD",
  });
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("fr-MA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function isActive(product) {
  return (
    product?.is_active === true ||
    product?.is_active === 1 ||
    product?.is_active === "1"
  );
}

function getStatusStyle(status) {
  const styles = {
    Pending:
      "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20",
    Processing:
      "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20",
    Completed:
      "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20",
    Cancelled:
      "bg-red-50 text-red-700 ring-red-200 dark:bg-red-400/10 dark:text-red-300 dark:ring-red-400/20",
  };

  return (
    styles[status] ||
    "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600"
  );
}

function getAllowedNextStatuses(status) {
  if (status === "Pending") return ["Processing", "Cancelled"];
  if (status === "Processing") return ["Completed", "Cancelled"];
  return [];
}

function getCustomerLabel(customer) {
  return (
    customer?.company_name ||
    customer?.customer_name ||
    customer?.contact_name ||
    `Customer #${customer?.id ?? "?"}`
  );
}

function Icon({ name, className = "h-5 w-5" }) {
  const common = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };

  const paths = {
    orders: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    pending: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    completed: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m16 16 4 4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    refresh: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3" />
      </>
    ),
    close: <path d="m18 6-12 12M6 6l12 12" />,
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6" />
        <path d="M10 10v6M14 10v6" />
      </>
    ),
  };

  return <svg {...common}>{paths[name] || paths.orders}</svg>;
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [newItems, setNewItems] = useState([
    { product_id: "", quantity: "1" },
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadOrders() {
    const result = await apiRequest("/orders");
    setOrders(getList(result, "orders"));
  }

  async function loadPageData() {
    setLoading(true);
    setError("");

    try {
      const [orderResult, customerResult, productResult] =
        await Promise.all([
          apiRequest("/orders"),
          apiRequest("/customers"),
          apiRequest("/products"),
        ]);

      setOrders(getList(orderResult, "orders"));
      setCustomers(getList(customerResult, "customers"));
      setProducts(getList(productResult, "products"));
    } catch (err) {
      setError(err.message || "Could not load order data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPageData();
  }, []);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orders.filter((order) => {
      const customerName =
        order.company_name ||
        order.customer_name ||
        order.contact_name ||
        "";

      const matchesSearch =
        String(order.id ?? "").toLowerCase().includes(term) ||
        String(customerName).toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "All" || order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const pendingCount = orders.filter(
    (order) => order.status === "Pending"
  ).length;

  const completedCount = orders.filter(
    (order) => order.status === "Completed"
  ).length;

  function getCustomerName(order) {
    if (order.company_name || order.customer_name || order.contact_name) {
      return (
        order.company_name ||
        order.customer_name ||
        order.contact_name
      );
    }

    const customer = customers.find(
      (item) => Number(item.id) === Number(order.customer_id)
    );

    return getCustomerLabel(customer);
  }

  function getProductName(item) {
    if (item.product_name || item.name) {
      return item.product_name || item.name;
    }

    const product = products.find(
      (entry) => Number(entry.id) === Number(item.product_id)
    );

    return product?.name || `Product #${item.product_id}`;
  }

  async function openOrderDetails(order) {
    setSelectedOrder(order);
    setOrderItems([]);
    setDetailsLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await apiRequest(`/orders/${order.id}`);
      const details = result.data ?? result.order ?? result;

      setSelectedOrder((previous) => ({
        ...(previous || order),
        ...details,
      }));

      setOrderItems(getOrderItems(details));
    } catch (err) {
      setError(err.message || "Could not load order details.");
    } finally {
      setDetailsLoading(false);
    }
  }

  function closeOrderDetails() {
    setSelectedOrder(null);
    setOrderItems([]);
    setDetailsLoading(false);
  }

  function openCreateForm() {
    setError("");
    setSuccess("");
    setShowCreateForm(true);
  }

  function closeCreateForm() {
    if (saving) return;
    setShowCreateForm(false);
  }

  function addItemRow() {
    setNewItems((previous) => [
      ...previous,
      { product_id: "", quantity: "1" },
    ]);
  }

  function removeItemRow(index) {
    setNewItems((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function updateItemRow(index, field, value) {
    setNewItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  }

  const estimatedTotal = newItems.reduce((total, item) => {
    const product = products.find(
      (entry) => Number(entry.id) === Number(item.product_id)
    );

    return total + Number(product?.price || 0) * Number(item.quantity || 0);
  }, 0);

  async function createOrder(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!customerId) {
      setError("Please select a customer.");
      return;
    }

    const items = newItems.map((item) => ({
      product_id: Number(item.product_id),
      quantity: Number(item.quantity),
    }));

    if (
      items.some(
        (item) =>
          !Number.isInteger(item.product_id) ||
          item.product_id <= 0 ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0
      )
    ) {
      setError("Select a product and enter a positive whole quantity.");
      return;
    }

    const uniqueProductIds = new Set(items.map((item) => item.product_id));

    if (uniqueProductIds.size !== items.length) {
      setError("Each product must appear only once in an order.");
      return;
    }

    setSaving(true);

    try {
      await apiRequest("/orders", {
        method: "POST",
        body: JSON.stringify({
          customer_id: Number(customerId),
          items,
        }),
      });

      setShowCreateForm(false);
      setCustomerId("");
      setNewItems([{ product_id: "", quantity: "1" }]);
      setSuccess("Order created successfully.");

      await loadPageData();
    } catch (err) {
      setError(err.message || "Could not create the order.");
    } finally {
      setSaving(false);
    }
  }

  async function changeOrderStatus(order, nextStatus) {
    if (!getAllowedNextStatuses(order.status).includes(nextStatus)) {
      setError("This status transition is not allowed.");
      return;
    }

    const confirmed = window.confirm(
      `Change order #${order.id} from ${order.status} to ${nextStatus}?`
    );

    if (!confirmed) return;

    setUpdatingId(order.id);
    setError("");
    setSuccess("");

    try {
      await apiRequest(`/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });

      setSuccess(`Order #${order.id} is now ${nextStatus}.`);

      await loadOrders();

      if (selectedOrder?.id === order.id) {
        const result = await apiRequest(`/orders/${order.id}`);
        const details = result.data ?? result.order ?? result;

        setSelectedOrder(details);
        setOrderItems(getOrderItems(details));
      }
    } catch (err) {
      setError(err.message || "Could not update order status.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm app-text-secondary">
            <span>Management</span>
            <span>/</span>
            <span className="app-text">Orders</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight app-text sm:text-3xl">
            Order Management
          </h1>

          <p className="mt-2 text-sm app-text-secondary">
            Create orders, review purchased products, and track order progress.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadPageData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border app-border app-surface px-4 py-2.5 text-sm font-semibold app-text transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon
              name="refresh"
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-hover)]"
          >
            <Icon name="plus" className="h-4 w-4" />
            Create Order
          </button>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          <span className="font-bold">!</span>
          <p className="min-w-0 flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
            className="rounded-md px-2 py-1 hover:bg-red-100 dark:hover:bg-red-900/50"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <span className="font-bold">✓</span>
          <p className="min-w-0 flex-1">{success}</p>
          <button
            type="button"
            onClick={() => setSuccess("")}
            aria-label="Dismiss success message"
            className="rounded-md px-2 py-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
          >
            ×
          </button>
        </div>
      )}

      {/* Statistics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="All orders"
          value={orders.length}
          description="Orders recorded in the system"
          icon="orders"
          iconStyle="bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300"
        />

        <StatCard
          title="Pending orders"
          value={pendingCount}
          description="Waiting for processing"
          icon="pending"
          iconStyle="bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300"
        />

        <StatCard
          title="Completed orders"
          value={completedCount}
          description="Successfully completed"
          icon="completed"
          iconStyle="bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
        />
      </div>

      {/* Search and filters */}
      <section className="app-surface rounded-2xl border app-border p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="font-semibold app-text">All orders</h2>
          <p className="mt-1 text-sm app-text-secondary">
            Search orders or filter them by their current status.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 app-text-secondary"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by order ID or customer..."
              aria-label="Search orders"
              className="app-input w-full pl-11"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter orders by status"
            className="app-input w-full"
          >
            <option value="All">All statuses</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm app-text-secondary">
          <p>
            Showing{" "}
            <span className="font-semibold app-text">
              {filteredOrders.length}
            </span>{" "}
            of {orders.length} orders
          </p>

          {(search || statusFilter !== "All") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("All");
              }}
              className="font-semibold text-[var(--primary)] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {/* Orders table */}
      <section className="overflow-hidden rounded-2xl border app-border app-surface">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 app-text-secondary">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border-color)] border-t-[var(--primary)]" />
            <p className="text-sm">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl app-muted app-text-secondary">
              <Icon name="orders" className="h-7 w-7" />
            </div>
            <h3 className="font-semibold app-text">No orders found</h3>
            <p className="mt-1 max-w-sm text-sm app-text-secondary">
              {orders.length === 0
                ? "There are no orders yet. Create your first order to get started."
                : "Try changing your search or selecting a different status."}
            </p>
            {orders.length === 0 && (
              <button
                type="button"
                onClick={openCreateForm}
                className="mt-4 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)]"
              >
                Create your first order
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="app-muted">
                <tr className="app-text-secondary">
                  <th className="px-5 py-4 font-semibold">Order</th>
                  <th className="px-5 py-4 font-semibold">Customer</th>
                  <th className="px-5 py-4 font-semibold">Order date</th>
                  <th className="px-5 py-4 font-semibold">Total</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-t app-border transition hover:bg-[var(--surface-muted)]"
                  >
                    <td className="px-5 py-4">
                      <span className="font-bold app-text">
                        #{order.id}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium app-text">
                        {getCustomerName(order)}
                      </div>
                      <div className="mt-1 text-xs app-text-secondary">
                        Customer order
                      </div>
                    </td>

                    <td className="px-5 py-4 app-text-secondary">
                      {formatDate(order.created_at)}
                    </td>

                    <td className="px-5 py-4">
                      <span className="font-semibold app-text">
                        {money(order.total_amount)}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={order.status} />
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openOrderDetails(order)}
                          className="inline-flex items-center gap-1.5 rounded-lg border app-border px-3 py-2 text-xs font-semibold app-text transition hover:opacity-75"
                        >
                          <Icon name="eye" className="h-4 w-4" />
                          Details
                        </button>

                        {getAllowedNextStatuses(order.status).length > 0 && (
                          <select
                            aria-label={`Change status for order ${order.id}`}
                            value=""
                            disabled={updatingId === order.id}
                            onChange={(event) => {
                              const nextStatus = event.target.value;
                              if (nextStatus) {
                                changeOrderStatus(order, nextStatus);
                              }
                            }}
                            className="app-input max-w-36 py-2 text-xs disabled:opacity-50"
                          >
                            <option value="">
                              {updatingId === order.id ? "Saving..." : "Update"}
                            </option>
                            {getAllowedNextStatuses(order.status).map(
                              (status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              )
                            )}
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Create order modal */}
      {showCreateForm && (
        <Modal title="Create a new order" onClose={closeCreateForm}>
          <form onSubmit={createOrder} className="space-y-6">
            <div>
              <FieldLabel>Customer *</FieldLabel>
              <select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                required
                className="app-input w-full"
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {getCustomerLabel(customer)}
                  </option>
                ))}
              </select>
              {customers.length === 0 && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                  No customers are available. Add a customer before creating an order.
                </p>
              )}
            </div>

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold app-text">Order items</h3>
                  <p className="mt-1 text-xs app-text-secondary">
                    Choose products and enter whole-number quantities.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addItemRow}
                  className="inline-flex items-center gap-1.5 rounded-lg border app-border px-3 py-2 text-sm font-semibold app-text transition hover:opacity-75"
                >
                  <Icon name="plus" className="h-4 w-4" />
                  Add item
                </button>
              </div>

              <div className="space-y-3">
                {newItems.map((item, index) => {
                  const selectedProduct = products.find(
                    (product) =>
                      Number(product.id) === Number(item.product_id)
                  );

                  return (
                    <div
                      key={index}
                      className="grid grid-cols-1 gap-3 rounded-xl border app-border p-3 sm:grid-cols-[minmax(0,1fr)_110px_auto]"
                    >
                      <div className="min-w-0">
                        <FieldLabel>Product {index + 1} *</FieldLabel>
                        <select
                          value={item.product_id}
                          onChange={(event) =>
                            updateItemRow(
                              index,
                              "product_id",
                              event.target.value
                            )
                          }
                          required
                          className="app-input w-full"
                        >
                          <option value="">Select a product</option>
                          {products.filter(isActive).map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} — {money(product.price)} (stock:{" "}
                              {product.stock ?? "—"})
                            </option>
                          ))}
                        </select>
                        {selectedProduct && (
                          <p className="mt-1.5 text-xs app-text-secondary">
                            Unit price: {money(selectedProduct.price)}
                          </p>
                        )}
                      </div>

                      <div>
                        <FieldLabel>Quantity *</FieldLabel>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          required
                          value={item.quantity}
                          onChange={(event) =>
                            updateItemRow(index, "quantity", event.target.value)
                          }
                          aria-label={`Quantity for item ${index + 1}`}
                          className="app-input w-full"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          disabled={newItems.length === 1}
                          onClick={() => removeItemRow(index)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30 dark:text-red-300 dark:hover:bg-red-950/40 sm:w-auto"
                        >
                          <Icon name="trash" className="h-4 w-4" />
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {products.filter(isActive).length === 0 && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  No active products are available to add to this order.
                </p>
              )}
            </div>

            <div className="rounded-xl border app-border app-muted p-4">
              <p className="text-sm app-text-secondary">
                Estimated total
              </p>
              <p className="mt-1 text-2xl font-bold app-text">
                {money(estimatedTotal)}
              </p>
              <p className="mt-2 text-xs app-text-secondary">
                The server must recalculate the final total before saving.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t app-border pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCreateForm}
                disabled={saving}
                className="rounded-xl border app-border px-4 py-2.5 text-sm font-semibold app-text transition hover:opacity-75 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  saving ||
                  customers.length === 0 ||
                  products.filter(isActive).length === 0
                }
                className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Creating order..." : "Create order"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Order details modal */}
      {selectedOrder && (
        <Modal
          title={`Order #${selectedOrder.id}`}
          subtitle="Order information and purchased products"
          onClose={closeOrderDetails}
        >
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailCard
                label="Customer"
                value={getCustomerName(selectedOrder)}
              />
              <DetailCard
                label="Order date"
                value={formatDate(selectedOrder.created_at)}
              />
              <div className="rounded-xl border app-border p-4">
                <p className="text-xs font-medium uppercase tracking-wide app-text-secondary">
                  Status
                </p>
                <div className="mt-2">
                  <StatusBadge status={selectedOrder.status} />
                </div>
              </div>
              <DetailCard
                label="Order total"
                value={money(selectedOrder.total_amount)}
                emphasized
              />
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold app-text">Products ordered</h3>
                  <p className="mt-1 text-sm app-text-secondary">
                    {orderItems.length}{" "}
                    {orderItems.length === 1 ? "item" : "items"}
                  </p>
                </div>
              </div>

              {detailsLoading ? (
                <div className="flex items-center justify-center gap-3 rounded-xl border app-border p-8 app-text-secondary">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border-color)] border-t-[var(--primary)]" />
                  <span className="text-sm">Loading order items...</span>
                </div>
              ) : orderItems.length === 0 ? (
                <div className="rounded-xl border app-border p-6 text-center">
                  <p className="text-sm font-medium app-text">
                    No order items were returned.
                  </p>
                  <p className="mt-1 text-xs app-text-secondary">
                    Check that GET /api/orders/:id returns an items or order_items array.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border app-border">
                  <table className="w-full min-w-[440px] text-left text-sm">
                    <thead className="app-muted">
                      <tr className="app-text-secondary">
                        <th className="px-4 py-3 font-semibold">Product</th>
                        <th className="px-4 py-3 font-semibold">Qty</th>
                        <th className="px-4 py-3 font-semibold">Unit price</th>
                        <th className="px-4 py-3 text-right font-semibold">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map((item, index) => {
                        const quantity = Number(item.quantity || 0);
                        const unitPrice = Number(
                          item.unit_price ?? item.price ?? 0
                        );

                        return (
                          <tr
                            key={item.id ?? `${item.product_id}-${index}`}
                            className="border-t app-border"
                          >
                            <td className="px-4 py-3 font-medium app-text">
                              {getProductName(item)}
                            </td>
                            <td className="px-4 py-3 app-text-secondary">
                              {quantity}
                            </td>
                            <td className="px-4 py-3 app-text-secondary">
                              {money(unitPrice)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold app-text">
                              {money(quantity * unitPrice)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {getAllowedNextStatuses(selectedOrder.status).length > 0 && (
              <div className="flex flex-col-reverse gap-3 border-t app-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs app-text-secondary">
                  Changing status may affect order processing and stock.
                </p>

                <div className="flex flex-wrap gap-2">
                  {getAllowedNextStatuses(selectedOrder.status).map(
                    (status) => (
                      <button
                        type="button"
                        key={status}
                        disabled={updatingId === selectedOrder.id}
                        onClick={() =>
                          changeOrderStatus(selectedOrder, status)
                        }
                        className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          status === "Cancelled"
                            ? "border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                            : "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
                        }`}
                      >
                        {updatingId === selectedOrder.id
                          ? "Saving..."
                          : status === "Cancelled"
                            ? "Cancel order"
                            : `Mark ${status}`}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCard({ title, value, description, icon, iconStyle }) {
  return (
    <div className="app-surface rounded-2xl border app-border p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium app-text-secondary">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight app-text">
            {value}
          </p>
          <p className="mt-2 text-xs app-text-secondary">{description}</p>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconStyle}`}
        >
          <Icon name={icon} className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusStyle(
        status
      )}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status || "Unknown"}
    </span>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="mb-1.5 block text-sm font-medium app-text">
      {children}
    </label>
  );
}

function DetailCard({ label, value, emphasized = false }) {
  return (
    <div className="rounded-xl border app-border p-4">
      <p className="text-xs font-medium uppercase tracking-wide app-text-secondary">
        {label}
      </p>
      <p
        className={`mt-2 break-words ${
          emphasized
            ? "text-lg font-bold app-text"
            : "text-sm font-semibold app-text"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="my-3 w-full max-w-3xl overflow-hidden rounded-2xl border app-border app-surface shadow-2xl sm:my-8"
      >
        <header className="flex items-start justify-between gap-4 border-b app-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-bold app-text sm:text-xl">{title}</h2>
            {subtitle && (
              <p className="mt-1 text-sm app-text-secondary">{subtitle}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border app-border app-text-secondary transition hover:opacity-75"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[calc(100dvh-130px)] overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
      </section>
    </div>
  );
}