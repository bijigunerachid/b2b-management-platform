
import { useEffect, useMemo, useState } from "react";

const API = "http://localhost:5000/api";

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
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result[key])) return result[key];
  return [];
}

function getOrderItems(result) {
  if (Array.isArray(result.items)) return result.items;
  if (Array.isArray(result.order_items)) return result.order_items;
  if (result.data && Array.isArray(result.data.items)) {
    return result.data.items;
  }
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

function getStatusClass(status) {
  const classes = {
    Pending: "bg-amber-100 text-amber-800",
    Processing: "bg-blue-100 text-blue-800",
    Completed: "bg-green-100 text-green-800",
    Cancelled: "bg-red-100 text-red-800",
  };

  return classes[status] || "bg-slate-100 text-slate-700";
}

function getAllowedNextStatuses(status) {
  if (status === "Pending") return ["Processing", "Cancelled"];
  if (status === "Processing") return ["Completed", "Cancelled"];
  return [];
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
        String(order.id).includes(term) ||
        String(customerName).toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "All" || order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  function getCustomerName(order) {
    if (order.company_name || order.customer_name) {
      return order.company_name || order.customer_name;
    }

    const customer = customers.find(
      (item) => Number(item.id) === Number(order.customer_id)
    );

    return customer?.company_name || "Unknown customer";
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

    try {
      const result = await apiRequest(`/orders/${order.id}`);
      const details = result.data ?? result.order ?? result;

      setSelectedOrder((previous) => ({
        ...previous,
        ...details,
      }));

      setOrderItems(getOrderItems(details));
    } catch (err) {
      setError(err.message || "Could not load order details.");
    } finally {
      setDetailsLoading(false);
    }
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
        itemIndex === index
          ? { ...item, [field]: value }
          : item
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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Order Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create orders, inspect order items, and manage order statuses.
          </p>
        </div>

        <button
          onClick={() => {
            setError("");
            setSuccess("");
            setShowCreateForm(true);
          }}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700"
        >
          + Create Order
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"
        >
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="All Orders" value={orders.length} />
        <StatCard
          title="Pending"
          value={orders.filter((order) => order.status === "Pending").length}
        />
        <StatCard
          title="Completed"
          value={orders.filter((order) => order.status === "Completed").length}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by order ID or customer..."
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 sm:flex-1"
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
        >
          <option value="All">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="Processing">Processing</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <p className="p-8 text-center text-slate-500">Loading orders...</p>
        ) : filteredOrders.length === 0 ? (
          <p className="p-8 text-center text-slate-500">No orders found.</p>
        ) : (
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-5 py-4 font-semibold">Order</th>
                <th className="px-5 py-4 font-semibold">Customer</th>
                <th className="px-5 py-4 font-semibold">Date</th>
                <th className="px-5 py-4 font-semibold">Total</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4 font-semibold text-slate-800">
                    #{order.id}
                  </td>

                  <td className="px-5 py-4 text-slate-700">
                    {getCustomerName(order)}
                  </td>

                  <td className="px-5 py-4 text-slate-600">
                    {formatDate(order.created_at)}
                  </td>

                  <td className="px-5 py-4 font-semibold text-slate-800">
                    {money(order.total_amount)}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(order.status)}`}
                    >
                      {order.status}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openOrderDetails(order)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Details
                      </button>

                      {getAllowedNextStatuses(order.status).length > 0 && (
                        <select
                          aria-label={`Change status for order ${order.id}`}
                          value=""
                          disabled={updatingId === order.id}
                          onChange={(event) => {
                            if (event.target.value) {
                              changeOrderStatus(order, event.target.value);
                            }
                          }}
                          className="max-w-36 rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-50"
                        >
                          <option value="">
                            {updatingId === order.id ? "Saving..." : "Update"}
                          </option>
                          {getAllowedNextStatuses(order.status).map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-sm text-slate-500">
        Showing {filteredOrders.length} of {orders.length} orders.
      </p>

      {showCreateForm && (
        <Modal
          title="Create Order"
          onClose={() => setShowCreateForm(false)}
        >
          <form onSubmit={createOrder} className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Customer *
              </label>
              <select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Order items</h3>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                >
                  + Add item
                </button>
              </div>

              {newItems.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_100px_auto]"
                >
                  <select
                    value={item.product_id}
                    onChange={(event) =>
                      updateItemRow(index, "product_id", event.target.value)
                    }
                    required
                    className="min-w-0 rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="">Select a product</option>
                    {products
                      .filter((product) => Boolean(product.is_active))
                      .map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} — {money(product.price)} (stock:{" "}
                          {product.stock})
                        </option>
                      ))}
                  </select>

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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />

                  <button
                    type="button"
                    disabled={newItems.length === 1}
                    onClick={() => removeItemRow(index)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-30"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Estimated total (the server recalculates this securely)
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {money(estimatedTotal)}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Order"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {selectedOrder && (
        <Modal
          title={`Order #${selectedOrder.id} Details`}
          onClose={() => {
            setSelectedOrder(null);
            setOrderItems([]);
          }}
        >
          <div className="space-y-5">
            <div className="grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">
                  Customer
                </p>
                <p className="mt-1 font-semibold text-slate-800">
                  {getCustomerName(selectedOrder)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-slate-500">
                  Order date
                </p>
                <p className="mt-1 font-semibold text-slate-800">
                  {formatDate(selectedOrder.created_at)}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-slate-500">
                  Status
                </p>
                <span
                  className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(selectedOrder.status)}`}
                >
                  {selectedOrder.status}
                </span>
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-slate-500">
                  Order total
                </p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {money(selectedOrder.total_amount)}
                </p>
              </div>
            </div>

            <h3 className="font-semibold text-slate-800">Products ordered</h3>

            {detailsLoading ? (
              <p className="py-6 text-center text-slate-500">
                Loading order items...
              </p>
            ) : orderItems.length === 0 ? (
              <p className="rounded-lg border border-slate-200 p-5 text-center text-sm text-slate-500">
                No order items were returned. Check that GET /api/orders/:id
                includes an items array.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-3">Product</th>
                      <th className="px-3 py-3">Qty</th>
                      <th className="px-3 py-3">Unit price</th>
                      <th className="px-3 py-3">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orderItems.map((item, index) => {
                      const quantity = Number(item.quantity || 0);
                      const unitPrice = Number(
                        item.unit_price ?? item.price ?? 0
                      );

                      return (
                        <tr key={item.id ?? `${item.product_id}-${index}`}>
                          <td className="px-3 py-3 font-medium text-slate-800">
                            {getProductName(item)}
                          </td>
                          <td className="px-3 py-3">{quantity}</td>
                          <td className="px-3 py-3">
                            {money(unitPrice)}
                          </td>
                          <td className="px-3 py-3 font-semibold">
                            {money(quantity * unitPrice)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {getAllowedNextStatuses(selectedOrder.status).length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                {getAllowedNextStatuses(selectedOrder.status).map((status) => (
                  <button
                    key={status}
                    disabled={updatingId === selectedOrder.id}
                    onClick={() => changeOrderStatus(selectedOrder, status)}
                    className={`rounded-lg px-4 py-2 font-semibold disabled:opacity-50 ${
                      status === "Cancelled"
                        ? "border border-red-200 text-red-700 hover:bg-red-50"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {status === "Cancelled"
                      ? "Cancel Order"
                      : `Mark ${status}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
      <div className="my-8 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg px-3 py-1 text-xl text-slate-500 hover:bg-slate-100"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}