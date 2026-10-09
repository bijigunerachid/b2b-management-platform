import { useCallback, useEffect, useState } from "react";

const API = "http://localhost:5000/api";

const emptyForm = {
name: "",
description: "",
category_id: "",
price: "",
stock: "",
is_active: true,
};

const panelStyle = {
backgroundColor: "var(--surface)",
borderColor: "var(--border-color)",
boxShadow: "var(--card-shadow)",
};

const inputClass =
"app-input w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-500/20";

const textStyle = { color: "var(--text-primary)" };
const mutedStyle = { color: "var(--text-secondary)" };

function isActiveProduct(value) {
return value === true || value === 1 || value === "1";
}

function ProductStat({ label, value, description, icon, color, background }) {
return ( <div
   className="rounded-2xl border p-5 transition duration-200 hover:-translate-y-0.5"
   style={panelStyle}
 > <div className="flex items-start justify-between gap-3"> <div> <p className="text-sm font-medium" style={mutedStyle}>
{label} </p> <p className="mt-3 text-3xl font-bold tracking-tight" style={textStyle}>
{value} </p> <p className="mt-2 text-xs" style={mutedStyle}>
{description} </p> </div>


    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
      style={{ color, backgroundColor: background }}
    >
      {icon}
    </div>
  </div>
</div>


);
}

function Notice({ type, children, onClose }) {
const isError = type === "error";

return (
<div
role={isError ? "alert" : "status"}
className="flex items-start justify-between gap-3 rounded-xl border p-4 text-sm"
style={{
backgroundColor: isError ? "var(--danger-soft)" : "var(--success-soft)",
borderColor: isError ? "var(--danger)" : "var(--success)",
color: isError ? "var(--danger)" : "var(--success)",
}}
> <div className="flex items-start gap-2.5"> <span className="font-bold">{isError ? "!" : "✓"}</span> <span>{children}</span> </div>


  <button
    type="button"
    onClick={onClose}
    aria-label="Dismiss notification"
    className="shrink-0 rounded-md px-1 font-semibold opacity-70 hover:opacity-100"
  >
    ×
  </button>
</div>


);
}

function Field({ label, required = false, children }) {
return ( <div> <label className="mb-1.5 block text-sm font-medium" style={textStyle}>
{label}
{required && <span className="ml-1 text-red-500">*</span>} </label>
{children} </div>
);
}

function EmptyState({ searching, onAdd }) {
return ( <div className="flex flex-col items-center px-5 py-14 text-center">
<div
className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
style={{
backgroundColor: "var(--primary-soft)",
color: "var(--primary)",
}}
> <svg
       width="30"
       height="30"
       viewBox="0 0 24 24"
       fill="none"
       stroke="currentColor"
       strokeWidth="1.7"
       aria-hidden="true"
     > <path d="M3 7h18v13H3z" /> <path d="M3 7l2-4h14l2 4M9 12h6" /> </svg> </div>


  <h3 className="text-base font-semibold" style={textStyle}>
    {searching ? "No matching products" : "No products yet"}
  </h3>

  <p className="mt-2 max-w-sm text-sm" style={mutedStyle}>
    {searching
      ? "Try a different product name or category."
      : "Add your first product to start managing your inventory."}
  </p>

  {!searching && (
    <button
      type="button"
      onClick={onAdd}
      className="mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      style={{ backgroundColor: "var(--primary)" }}
    >
      + Add product
    </button>
  )}
</div>


);
}

export default function Products() {
const [products, setProducts] = useState([]);
const [categories, setCategories] = useState([]);

const [search, setSearch] = useState("");
const [categoryFilter, setCategoryFilter] = useState("");

const [page, setPage] = useState(1);
const pageSize = 10;

const [pagination, setPagination] = useState({
page: 1,
limit: 10,
total: 0,
totalPages: 0,
});

const [showForm, setShowForm] = useState(false);
const [editingId, setEditingId] = useState(null);
const [form, setForm] = useState({ ...emptyForm });

const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [deletingId, setDeletingId] = useState(null);

const [error, setError] = useState("");
const [success, setSuccess] = useState("");

async function request(url, options = {}) {
const response = await fetch(`${API}${url}`, {
...options,
credentials: "include",
headers: {
"Content-Type": "application/json",
...options.headers,
},
});


const result = await response.json().catch(() => ({}));

if (!response.ok || result.success === false) {
  throw new Error(result.message || "Something went wrong.");
}

return result;


}

const loadData = useCallback(async () => {
setLoading(true);
setError("");


try {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
    search: search.trim(),
  });

  if (categoryFilter) {
    params.set("category_id", categoryFilter);
  }

  const [productResult, categoryResult] = await Promise.all([
    request(`/products?${params.toString()}`),
    request("/categories"),
  ]);

  const productList = Array.isArray(productResult.data)
    ? productResult.data
    : Array.isArray(productResult.products)
      ? productResult.products
      : [];

  const categoryList = Array.isArray(categoryResult.data)
    ? categoryResult.data
    : Array.isArray(categoryResult.categories)
      ? categoryResult.categories
      : Array.isArray(categoryResult)
        ? categoryResult
        : [];

  setProducts(productList);
  setCategories(categoryList);

  if (productResult.pagination) {
    setPagination(productResult.pagination);
  } else {
    setPagination({
      page,
      limit: pageSize,
      total: productList.length,
      totalPages: productList.length > 0 ? 1 : 0,
    });
  }
} catch (err) {
  setError(err.message || "Failed to load products.");
  setProducts([]);
  setPagination({
    page,
    limit: pageSize,
    total: 0,
    totalPages: 0,
  });
} finally {
  setLoading(false);
}


}, [page, search, categoryFilter]);

useEffect(() => {
loadData();
}, [loadData]);

function openCreateForm() {
setEditingId(null);
setForm({ ...emptyForm });
setError("");
setSuccess("");
setShowForm(true);
}

function openEditForm(product) {
setEditingId(product.id);


setForm({
  name: product.name ?? "",
  description: product.description ?? "",
  category_id: product.category_id
    ? String(product.category_id)
    : "",
  price: product.price ?? "",
  stock: product.stock ?? product.stock_quantity ?? "",
  is_active:
    product.is_active === undefined
      ? true
      : isActiveProduct(product.is_active),
});

setError("");
setSuccess("");
setShowForm(true);


}

function closeForm() {
if (saving) return;


setShowForm(false);
setEditingId(null);
setForm({ ...emptyForm });


}

function handleFormChange(event) {
const { name, value, type, checked } = event.target;


setForm((previous) => ({
  ...previous,
  [name]: type === "checkbox" ? checked : value,
}));


}

async function handleSubmit(event) {
event.preventDefault();
setSaving(true);
setError("");
setSuccess("");


try {
  if (!form.name.trim()) {
    throw new Error("Product name is required.");
  }

  if (
    form.price === "" ||
    !Number.isFinite(Number(form.price)) ||
    Number(form.price) < 0
  ) {
    throw new Error("Enter a valid price.");
  }

  if (
    form.stock === "" ||
    !Number.isInteger(Number(form.stock)) ||
    Number(form.stock) < 0
  ) {
    throw new Error("Stock must be a non-negative whole number.");
  }

  const wasEditing = editingId !== null;

  const payload = {
    name: form.name.trim(),
    description: form.description.trim(),
    category_id: form.category_id ? Number(form.category_id) : null,
    price: Number(form.price),
    stock: Number(form.stock),
    is_active: Boolean(form.is_active),
  };

  const url = wasEditing ? `/products/${editingId}` : "/products";

  await request(url, {
    method: wasEditing ? "PUT" : "POST",
    body: JSON.stringify(payload),
  });

  setShowForm(false);
  setEditingId(null);
  setForm({ ...emptyForm });

  setSuccess(
    wasEditing
      ? "Product updated successfully."
      : "Product created successfully."
  );

  setPage(1);

  if (page === 1) {
    await loadData();
  }
} catch (err) {
  setError(err.message || "Failed to save product.");
} finally {
  setSaving(false);
}


}

async function handleDelete(product) {
const confirmed = window.confirm(
`Are you sure you want to delete "${product.name}"?`
);


if (!confirmed) return;

setError("");
setSuccess("");
setDeletingId(product.id);

try {
  await request(`/products/${product.id}`, {
    method: "DELETE",
  });

  setSuccess("Product deleted successfully.");

  if (products.length === 1 && page > 1) {
    setPage((previous) => previous - 1);
  } else {
    await loadData();
  }
} catch (err) {
  setError(err.message || "Failed to delete product.");
} finally {
  setDeletingId(null);
}


}

function handleSearchChange(event) {
setSearch(event.target.value);
setPage(1);
}

function handleCategoryChange(event) {
setCategoryFilter(event.target.value);
setPage(1);
}

const lowStockCount = products.filter(
(product) => Number(product.stock ?? product.stock_quantity ?? 0) <= 5
).length;

const activeCount = products.filter((product) =>
isActiveProduct(product.is_active)
).length;

const totalPages = Number(pagination.totalPages) || 0;
const totalProducts = Number(pagination.total) || 0;

const money = (value) =>
new Intl.NumberFormat("fr-MA", {
style: "currency",
currency: "MAD",
minimumFractionDigits: 2,
maximumFractionDigits: 2,
}).format(Number(value) || 0);

const dateLabel = new Intl.DateTimeFormat("en", {
weekday: "long",
day: "numeric",
month: "long",
year: "numeric",
}).format(new Date());

return ( <div className="space-y-7 pb-8">
{/* Page heading */} <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"> <div>
<div
className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]"
style={{ color: "var(--primary)" }}
>
<span
className="h-2 w-2 rounded-full"
style={{ backgroundColor: "var(--primary)" }}
/>
Inventory management </div>


      <h1
        className="text-3xl font-bold tracking-tight sm:text-4xl"
        style={textStyle}
      >
        Products
      </h1>

      <p className="mt-2 text-sm sm:text-base" style={mutedStyle}>
        Manage your catalog, prices, categories, and stock levels.
      </p>

      <p className="mt-2 text-xs" style={mutedStyle}>
        {dateLabel}
      </p>
    </div>

    <button
      type="button"
      onClick={openCreateForm}
      className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:opacity-90"
      style={{ backgroundColor: "var(--primary)" }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      Add product
    </button>
  </div>

  {/* Notifications */}
  {error && (
    <Notice type="error" onClose={() => setError("")}>
      {error}
    </Notice>
  )}

  {success && (
    <Notice type="success" onClose={() => setSuccess("")}>
      {success}
    </Notice>
  )}

  {/* Statistics */}
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
    <ProductStat
      label="Total products"
      value={totalProducts.toLocaleString("en")}
      description="Products matching your filters"
      color="var(--primary)"
      background="var(--primary-soft)"
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M3 7h18v13H3z" />
          <path d="M3 7l2-4h14l2 4M9 12h6" />
        </svg>
      }
    />

    <ProductStat
      label="Active on this page"
      value={activeCount.toLocaleString("en")}
      description="Currently active products"
      color="var(--success)"
      background="var(--success-soft)"
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 3 3 5-6" />
        </svg>
      }
    />

    <ProductStat
      label="Low stock on this page"
      value={lowStockCount.toLocaleString("en")}
      description="Products with stock of 5 or less"
      color="var(--warning)"
      background="var(--warning-soft)"
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="m12 3 10 18H2L12 3z" />
          <path d="M12 9v5m0 3v.01" />
        </svg>
      }
    />
  </div>

  {/* Products directory */}
  <section className="overflow-hidden rounded-2xl border" style={panelStyle}>
    <div
      className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-center lg:justify-between"
      style={{ borderColor: "var(--border-color)" }}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold" style={textStyle}>
            Product directory
          </h2>

          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{
              backgroundColor: "var(--primary-soft)",
              color: "var(--primary)",
            }}
          >
            {totalProducts}
          </span>
        </div>

        <p className="mt-1 text-sm" style={mutedStyle}>
          Search your inventory and manage individual products.
        </p>
      </div>

      <button
        type="button"
        onClick={loadData}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 self-start rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 lg:self-auto"
        style={{
          borderColor: "var(--border-color)",
          color: "var(--text-primary)",
        }}
      >
        <svg
          className={loading ? "animate-spin" : ""}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M20 7v5h-5M4 17v-5h5" />
          <path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" />
        </svg>
        {loading ? "Loading..." : "Refresh"}
      </button>
    </div>

    {/* Search and category filter */}
    <div className="grid grid-cols-1 gap-3 border-b p-5 md:grid-cols-2" style={{ borderColor: "var(--border-color)" }}>
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-secondary)"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>

        <input
          type="search"
          value={search}
          onChange={handleSearchChange}
          placeholder="Search products..."
          aria-label="Search products"
          className={`${inputClass} pl-10`}
        />
      </div>

      <select
        value={categoryFilter}
        onChange={handleCategoryChange}
        aria-label="Filter by category"
        className={inputClass}
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </div>

    {/* Create / edit form */}
    {showForm && (
      <form
        onSubmit={handleSubmit}
        className="m-4 space-y-5 rounded-2xl border p-5 sm:m-5 sm:p-6"
        style={{
          backgroundColor: "var(--surface-muted)",
          borderColor: "var(--border-color)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="mb-1 text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--primary)" }}
            >
              Product details
            </p>

            <h3 className="text-xl font-bold" style={textStyle}>
              {editingId !== null ? "Edit product" : "Create product"}
            </h3>

            <p className="mt-1 text-sm" style={mutedStyle}>
              Complete the fields below and save your changes.
            </p>
          </div>

          <button
            type="button"
            onClick={closeForm}
            disabled={saving}
            className="rounded-lg px-3 py-1.5 text-sm font-medium transition hover:opacity-70 disabled:opacity-50"
            style={mutedStyle}
          >
            Close ×
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Product name" required>
            <input
              name="name"
              value={form.name}
              onChange={handleFormChange}
              required
              maxLength={150}
              placeholder="Enter product name"
              className={inputClass}
            />
          </Field>

          <Field label="Category">
            <select
              name="category_id"
              value={form.category_id}
              onChange={handleFormChange}
              className={inputClass}
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Price (MAD)" required>
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={handleFormChange}
              required
              placeholder="0.00"
              className={inputClass}
            />
          </Field>

          <Field label="Stock quantity" required>
            <input
              name="stock"
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={handleFormChange}
              required
              placeholder="0"
              className={inputClass}
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Description">
              <textarea
                name="description"
                rows={3}
                value={form.description}
                onChange={handleFormChange}
                placeholder="Describe this product..."
                className={`${inputClass} resize-y`}
              />
            </Field>
          </div>

          <label
            className="flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-sm"
            style={{
              borderColor: "var(--border-color)",
              color: "var(--text-primary)",
            }}
          >
            <input
              type="checkbox"
              name="is_active"
              checked={Boolean(form.is_active)}
              onChange={handleFormChange}
              className="h-4 w-4 rounded accent-blue-600"
            />
            <span>
              <span className="block font-semibold">Active product</span>
              <span className="mt-0.5 block text-xs" style={mutedStyle}>
                Mark this product as active.
              </span>
            </span>
          </label>
        </div>

        <div
          className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end"
          style={{ borderColor: "var(--border-color)" }}
        >
          <button
            type="button"
            onClick={closeForm}
            disabled={saving}
            className="rounded-xl border px-5 py-2.5 text-sm font-semibold transition hover:opacity-75 disabled:opacity-50"
            style={{
              borderColor: "var(--border-color)",
              color: "var(--text-primary)",
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: "var(--primary)" }}
          >
            {saving
              ? "Saving..."
              : editingId !== null
                ? "Save changes"
                : "Create product"}
          </button>
        </div>
      </form>
    )}

    {/* Products table */}
    <div className="overflow-x-auto">
      <table className="w-full min-w-[850px] text-left text-sm">
        <thead
          style={{
            backgroundColor: "var(--surface-muted)",
            color: "var(--text-secondary)",
          }}
        >
          <tr>
            <th className="px-5 py-4 font-semibold">Product</th>
            <th className="px-5 py-4 font-semibold">Category</th>
            <th className="px-5 py-4 font-semibold">Price</th>
            <th className="px-5 py-4 font-semibold">Stock</th>
            <th className="px-5 py-4 font-semibold">Status</th>
            <th className="px-5 py-4 text-right font-semibold">Actions</th>
          </tr>
        </thead>

        <tbody>
          {loading && products.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-5 py-12 text-center" style={mutedStyle}>
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                  Loading products...
                </span>
              </td>
            </tr>
          ) : products.length === 0 ? (
            <tr>
              <td colSpan={6}>
                <EmptyState
                  searching={Boolean(search.trim() || categoryFilter)}
                  onAdd={openCreateForm}
                />
              </td>
            </tr>
          ) : (
            products.map((product) => {
              const stock = Number(
                product.stock ?? product.stock_quantity ?? 0
              );

              const active = isActiveProduct(product.is_active);

              const categoryName =
                product.category_name ||
                categories.find(
                  (category) =>
                    String(category.id) === String(product.category_id)
                )?.name ||
                "Uncategorized";

              return (
                <tr
                  key={product.id}
                  className="transition-colors hover:bg-slate-500/[0.04]"
                  style={{ borderTop: "1px solid var(--border-color)" }}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                        style={{
                          backgroundColor: "var(--primary-soft)",
                          color: "var(--primary)",
                        }}
                      >
                        {(product.name || "?").trim().charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <p className="max-w-[240px] truncate font-semibold" style={textStyle}>
                          {product.name}
                        </p>
                        <p className="mt-1 text-xs" style={mutedStyle}>
                          ID: {product.id}
                        </p>
                        {product.description && (
                          <p className="mt-1 max-w-[240px] truncate text-xs" style={mutedStyle}>
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4" style={textStyle}>
                    {categoryName}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 font-semibold" style={textStyle}>
                    {money(product.price)}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className="inline-flex rounded-lg px-2.5 py-1 font-semibold"
                      style={{
                        backgroundColor:
                          stock <= 5
                            ? "var(--warning-soft)"
                            : "var(--surface-muted)",
                        color:
                          stock <= 5
                            ? "var(--warning)"
                            : "var(--text-primary)",
                      }}
                    >
                      {stock}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{
                        backgroundColor: active
                          ? "var(--success-soft)"
                          : "var(--surface-muted)",
                        color: active
                          ? "var(--success)"
                          : "var(--text-secondary)",
                      }}
                    >
                      {active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(product)}
                        className="rounded-lg border px-3 py-2 text-xs font-semibold transition hover:opacity-75"
                        style={{
                          borderColor: "var(--primary)",
                          color: "var(--primary)",
                        }}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(product)}
                        disabled={deletingId === product.id}
                        className="rounded-lg border px-3 py-2 text-xs font-semibold transition hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          borderColor: "var(--danger)",
                          color: "var(--danger)",
                        }}
                      >
                        {deletingId === product.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>

    {/* Pagination */}
    <div
      className="flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
      style={{
        borderColor: "var(--border-color)",
        color: "var(--text-secondary)",
      }}
    >
      <p className="text-sm">
        Showing {products.length} products on this page out of{" "}
        {totalProducts} matching products.
      </p>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <button
          type="button"
          disabled={loading || page <= 1}
          onClick={() => setPage((previous) => Math.max(1, previous - 1))}
          className="rounded-xl border px-3 py-2 text-sm font-medium transition hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: "var(--border-color)",
            color: "var(--text-primary)",
          }}
        >
          Previous
        </button>

        <span className="whitespace-nowrap px-2 text-sm">
          Page {page} of {Math.max(totalPages, 1)}
        </span>

        <button
          type="button"
          disabled={loading || totalPages === 0 || page >= totalPages}
          onClick={() =>
            setPage((previous) => Math.min(totalPages, previous + 1))
          }
          className="rounded-xl border px-3 py-2 text-sm font-medium transition hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            borderColor: "var(--border-color)",
            color: "var(--text-primary)",
          }}
        >
          Next
        </button>
      </div>
    </div>
  </section>
</div>


);
}
