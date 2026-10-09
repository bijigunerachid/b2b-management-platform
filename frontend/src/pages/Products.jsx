
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
  const [form, setForm] = useState(emptyForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    setForm(emptyForm);
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
          : Boolean(product.is_active),
    });

    setError("");
    setSuccess("");
    setShowForm(true);
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

      if (form.price === "" || Number(form.price) < 0) {
        throw new Error("Enter a valid price.");
      }

      if (
        form.stock === "" ||
        !Number.isInteger(Number(form.stock)) ||
        Number(form.stock) < 0
      ) {
        throw new Error("Stock must be a non-negative whole number.");
      }

      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        category_id: form.category_id
          ? Number(form.category_id)
          : null,
        price: Number(form.price),
        stock: Number(form.stock),
        is_active: Boolean(form.is_active),
      };

      const url = editingId
        ? `/products/${editingId}`
        : "/products";

      await request(url, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      setSuccess(
        editingId
          ? "Product updated successfully."
          : "Product created successfully."
      );

      // Return to the first page so a newly created product is visible.
      setPage(1);

      // The effect reloads data when page changes. If already on page 1,
      // explicitly reload because the page value will not change.
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

    try {
      await request(`/products/${product.id}`, {
        method: "DELETE",
      });

      setSuccess("Product deleted successfully.");

      // Reload the previous page if deleting its only product.
      if (products.length === 1 && page > 1) {
        setPage((previous) => previous - 1);
      } else {
        await loadData();
      }
    } catch (err) {
      setError(err.message || "Failed to delete product.");
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

  const activeCount = products.filter(
    (product) =>
      product.is_active === true ||
      product.is_active === 1 ||
      product.is_active === "1"
  ).length;

  const totalPages = Number(pagination.totalPages) || 0;
  const totalProducts = Number(pagination.total) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Products
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your products, prices, categories, and stock.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700"
        >
          + Add Product
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total Products</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {totalProducts}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Active on This Page</p>
          <p className="mt-2 text-2xl font-bold text-green-600">
            {activeCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Low Stock on This Page</p>
          <p className="mt-2 text-2xl font-bold text-orange-600">
            {lowStockCount}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-5 flex flex-col gap-3 md:flex-row">
          <input
            type="search"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search products..."
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <select
            value={categoryFilter}
            onChange={handleCategoryChange}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 outline-none focus:border-blue-500"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? "Edit Product" : "Create Product"}
              </h2>

              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="product-name"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Product Name *
                </label>
                <input
                  id="product-name"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  required
                  maxLength={150}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="product-category"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Category
                </label>
                <select
                  id="product-category"
                  name="category_id"
                  value={form.category_id}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="product-price"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Price *
                </label>
                <input
                  id="product-price"
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={handleFormChange}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="product-stock"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Stock *
                </label>
                <input
                  id="product-stock"
                  name="stock"
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={handleFormChange}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="product-description"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Description
                </label>
                <textarea
                  id="product-description"
                  name="description"
                  rows={3}
                  value={form.description}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={Boolean(form.is_active)}
                  onChange={handleFormChange}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Active product
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Product"
                    : "Create Product"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Stock</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No products found.
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const stock = Number(
                    product.stock ?? product.stock_quantity ?? 0
                  );

                  const isActive =
                    product.is_active === true ||
                    product.is_active === 1 ||
                    product.is_active === "1";

                  return (
                    <tr
                      key={product.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-900">
                          {product.name}
                        </p>
                        {product.description && (
                          <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                            {product.description}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {product.category_name ||
                          categories.find(
                            (category) =>
                              String(category.id) ===
                              String(product.category_id)
                          )?.name ||
                          "—"}
                      </td>

                      <td className="px-4 py-4 font-medium text-slate-800">
                        {Number(product.price ?? 0).toFixed(2)}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={
                            stock <= 5
                              ? "font-semibold text-orange-600"
                              : "text-slate-700"
                          }
                        >
                          {stock}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(product)}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(product)}
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Delete
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

        <div className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-slate-500">
            Showing {products.length} products on this page out of{" "}
            {totalProducts} matching products.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="px-2 text-sm text-slate-600">
              Page {page} of {Math.max(totalPages, 1)}
            </span>

            <button
              type="button"
              disabled={
                loading ||
                totalPages === 0 ||
                page >= totalPages
              }
              onClick={() =>
                setPage((previous) =>
                  Math.min(totalPages, previous + 1)
                )
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}