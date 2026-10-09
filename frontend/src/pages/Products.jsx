import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { Modal } from "../components/ui/Modal";
import { useConfirm, useToast } from "../components/ui/feedback";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Field,
  IconAction,
  InlineAlert,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedControl,
  SortHeader,
  StatCard,
  Switch,
  TableHead,
  TableSkeleton,
  Th,
} from "../components/ui/primitives";
import { api, can, exportCsv, initials, isActiveFlag, money, number, toList, useResource } from "../lib/api";
import { StockAdjustModal, StockHistoryDrawer } from "../components/StockHistory";

const PAGE_SIZE = 10;
const LOW_STOCK = 5;

const emptyForm = {
  name: "",
  description: "",
  category_id: "",
  price: "",
  stock: "",
  reorder_point: "5",
  average_cost: "",
  supplier_id: "",
  is_active: true,
};

const sortKeys = { name: "name", category: "category", price: "price", stock: "stock" };

function StockMeter({ stock, reorderPoint = 5, onOrder = 0 }) {
  const low = reorderPoint > 0 && stock <= reorderPoint;
  const tone = stock === 0 ? "danger" : low ? "warning" : "success";
  const width = Math.min(100, (stock / Math.max(reorderPoint * 3, 1)) * 100);

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="w-10 text-right font-semibold tabular-nums app-text">{stock}</span>
        <div className="h-1.5 w-20 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-muted)" }} title={`Reorder point: ${reorderPoint}`}>
          <div className="h-full rounded-full" style={{ width: `${Math.max(width, stock > 0 ? 4 : 0)}%`, backgroundColor: `var(--${tone})` }} />
        </div>
        {(stock === 0 || low) && (
          <Badge tone={tone} className="!px-2 !py-0.5 text-[11px]">
            {stock === 0 ? "Out" : "Low"}
          </Badge>
        )}
      </div>
      {onOrder > 0 && (
        <p className="mt-0.5 pl-[52px] text-[11px] font-medium" style={{ color: "var(--primary)" }}>
          +{onOrder} on order
        </p>
      )}
    </div>
  );
}

export default function Products() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();

  const canWrite = can(user, "products.write");
  const canDelete = can(user, "products.delete");

  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [categoryId, setCategoryId] = useState(() => params.get("category") ?? "");
  const [supplierFilter, setSupplierFilter] = useState(() => params.get("supplier") ?? "");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState({ key: null, direction: "asc" });
  const [page, setPage] = useState(1);

  const qParam = params.get("q");
  const [appliedQ, setAppliedQ] = useState(qParam);
  if (qParam !== null && qParam !== appliedQ) {
    setAppliedQ(qParam);
    setSearch(qParam);
    setDebouncedSearch(qParam);
    setPage(1);
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useMemo(() => {
    const next = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (debouncedSearch.trim()) next.set("search", debouncedSearch.trim());
    if (categoryId) next.set("category_id", categoryId);
    if (supplierFilter) next.set("supplier_id", supplierFilter);
    if (status === "active" || status === "inactive") next.set("status", status);
    if (status === "low") next.set("stock", "low");
    if (sort.key) {
      next.set("sort", sortKeys[sort.key]);
      next.set("order", sort.direction);
    }
    return next.toString();
  }, [page, debouncedSearch, categoryId, supplierFilter, status, sort]);

  const productsResource = useResource(`/products?${query}`);
  const categoriesResource = useResource("/categories");
  const suppliersResource = useResource("/suppliers");
  const suppliers = toList(suppliersResource.data).filter((supplier) => supplier.is_active);
  const [historyFor, setHistoryFor] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const canAdjust = can(user, "inventory.adjust");
  const lowResource = useResource("/products?stock=low&limit=1");
  const inactiveResource = useResource("/products?status=inactive&limit=1");
  const allResource = useResource("/products?limit=1");

  const products = toList(productsResource.data, "products");
  const categories = toList(categoriesResource.data, "categories");
  const pagination = productsResource.data?.pagination ?? { total: 0, totalPages: 1 };

  function reloadAll() {
    productsResource.reload();
    lowResource.reload();
    inactiveResource.reload();
    allResource.reload();
  }

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const createRequested = params.get("new") === "1" && canWrite;
  const isEditing = editing !== null && !createRequested;

  function clearNewParam() {
    if (!createRequested) return;
    const next = new URLSearchParams(params);
    next.delete("new");
    setParams(next, { replace: true });
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(product) {
    setEditing(product);
    setForm({
      name: product.name ?? "",
      description: product.description ?? "",
      category_id: product.category_id ? String(product.category_id) : "",
      price: String(product.price ?? ""),
      stock: String(product.stock ?? ""),
      reorder_point: String(product.reorder_point ?? 5),
      average_cost: product.average_cost === null || product.average_cost === undefined ? "" : String(Number(product.average_cost)),
      supplier_id: product.supplier_id ? String(product.supplier_id) : "",
      is_active: isActiveFlag(product.is_active),
    });
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    clearNewParam();
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const price = Number(form.price);
    const stock = Number(form.stock);

    if (!Number.isFinite(price) || price < 0) return setFormError("Enter a valid, non-negative price.");
    if (!isEditing && (!Number.isInteger(stock) || stock < 0)) return setFormError("Stock must be a whole number of 0 or more.");
    const reorderPoint = Number(form.reorder_point);
    if (!Number.isInteger(reorderPoint) || reorderPoint < 0) return setFormError("Reorder point must be a whole number of 0 or more.");
    if (!form.category_id) return setFormError("Choose a category for this product.");
    const averageCost = form.average_cost === "" ? undefined : Number(form.average_cost);
    if (averageCost !== undefined && (!Number.isFinite(averageCost) || averageCost < 0)) return setFormError("Unit cost must be 0 or more.");

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category_id: Number(form.category_id),
      price,
      // Stock is only set on creation; later changes are ledger adjustments.
      ...(isEditing ? {} : { stock }),
      reorder_point: reorderPoint,
      ...(averageCost === undefined ? {} : { average_cost: Math.round(averageCost * 100) / 100 }),
      supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      is_active: Boolean(form.is_active),
    };

    try {
      await api(isEditing ? `/products/${editing.id}` : "/products", {
        method: isEditing ? "PUT" : "POST",
        body: payload,
      });
      setFormOpen(false);
      clearNewParam();
      toast.success(`${payload.name} was ${isEditing ? "updated" : "added to your catalog"}.`, {
        title: isEditing ? "Product updated" : "Product created",
      });
      reloadAll();
    } catch (err) {
      setFormError(err.message || "Unable to save product.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(product, nextActive) {
    setTogglingId(product.id);
    try {
      await api(`/products/${product.id}`, {
        method: "PUT",
        body: {
          name: product.name,
          description: product.description ?? "",
          category_id: Number(product.category_id),
          price: Number(product.price),
          is_active: nextActive,
        },
      });
      toast.success(`${product.name} is now ${nextActive ? "active" : "inactive"}.`);
      reloadAll();
    } catch (err) {
      toast.error(err.message || "Unable to update product.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(product) {
    const confirmed = await confirm({
      title: `Delete ${product.name}?`,
      message: "This permanently removes the product. Products used in orders can't be deleted, so deactivate them instead.",
      confirmLabel: "Delete product",
    });
    if (!confirmed) return;

    try {
      await api(`/products/${product.id}`, { method: "DELETE" });
      toast.success(`${product.name} was deleted.`);
      if (products.length === 1 && page > 1) setPage(page - 1);
      reloadAll();
    } catch (err) {
      toast.error(err.message || "Unable to delete product.", { title: "Delete failed" });
    }
  }

  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const rows = [];
      for (let current = 1; ; current += 1) {
        const pageQuery = new URLSearchParams(query);
        pageQuery.set("page", String(current));
        pageQuery.set("limit", "100");
        const result = await api(`/products?${pageQuery}`);
        rows.push(...toList(result));
        if (current >= (result.pagination?.totalPages ?? 1)) break;
      }
      exportCsv(
        "products",
        [
          ["ID", (p) => p.id],
          ["Name", (p) => p.name],
          ["Category", (p) => p.category_name],
          ["Price (MAD)", (p) => p.price],
          ["Stock", (p) => p.stock],
          ["Active", (p) => (isActiveFlag(p.is_active) ? "Yes" : "No")],
          ["Description", (p) => p.description],
        ],
        rows
      );
      toast.info(`Exported ${rows.length} products to CSV.`);
    } catch (err) {
      toast.error(err.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  function toggleSort(key) {
    setSort((current) =>
      current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }
    );
    setPage(1);
  }

  const filtering = Boolean(debouncedSearch.trim() || categoryId || supplierFilter || status !== "all");
  const initialLoading = productsResource.loading && !productsResource.data;
  const totalAll = allResource.data?.pagination?.total;
  const lowCount = lowResource.data?.pagination?.total;
  const inactiveCount = inactiveResource.data?.pagination?.total;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        actions={
          <>
            <Button icon="download" onClick={handleExport} loading={exporting} disabled={pagination.total === 0}>
              Export
            </Button>
            {canWrite && (
              <Button variant="primary" icon="plus" onClick={openCreate}>
                Add product
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total products" value={number(totalAll)} icon="products" loading={totalAll === undefined} />
        <StatCard label="Categories" value={number(categories.length)} icon="categories" tone="info" loading={categoriesResource.loading && !categoriesResource.data} />
        <StatCard
          label="Low stock"
          value={number(lowCount)}
          hint="At or below their reorder point"
          icon="alert"
          tone="warning"
          loading={lowCount === undefined}
          onClick={() => {
            setStatus("low");
            setPage(1);
          }}
        />
        <StatCard
          label="Inactive"
          value={number(inactiveCount)}
          hint="Hidden from new orders"
          icon="ban"
          tone="danger"
          loading={inactiveCount === undefined}
          onClick={() => {
            setStatus("inactive");
            setPage(1);
          }}
        />
      </div>

      {productsResource.error && <ErrorState message={productsResource.error} onRetry={reloadAll} />}

      <Card>
        <div className="flex flex-col gap-3 border-b p-4 xl:flex-row xl:items-center" style={{ borderColor: "var(--border-color)" }}>
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search name or description..."
            className="xl:w-72"
          />
          <select
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by category"
            className="app-input h-10 py-0 xl:w-48"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={supplierFilter}
            onChange={(event) => {
              setSupplierFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by supplier"
            className="app-input h-10 py-0 xl:w-48"
          >
            <option value="">All suppliers</option>
            {toList(suppliersResource.data).map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          <SegmentedControl
            label="Status filter"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "low", label: "Low stock" },
            ]}
          />
          <Button
            size="icon"
            variant="ghost"
            icon="refresh"
            onClick={reloadAll}
            aria-label="Refresh"
            title="Refresh"
            className={`xl:ml-auto ${productsResource.loading ? "[&_svg]:animate-spin" : ""}`}
          />
        </div>

        {initialLoading ? (
          <TableSkeleton columns={6} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={filtering ? "search" : "products"}
            title={filtering ? "No matching products" : "No products yet"}
            description={filtering ? "Try a different search, category, or status." : "Add your first product to start building your catalog."}
            action={
              filtering ? (
                <Button
                  onClick={() => {
                    setSearch("");
                    setDebouncedSearch("");
                    setCategoryId("");
                    setSupplierFilter("");
                    setStatus("all");
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                canWrite && (
                  <Button variant="primary" icon="plus" onClick={openCreate}>
                    Add your first product
                  </Button>
                )
              )
            }
          />
        ) : (
          <div className={`overflow-x-auto transition-opacity ${productsResource.loading ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[900px] text-left text-sm">
              <TableHead>
                <SortHeader label="Product" column="name" sort={sort} onSort={toggleSort} />
                <SortHeader label="Category" column="category" sort={sort} onSort={toggleSort} />
                <SortHeader label="Price" column="price" sort={sort} onSort={toggleSort} />
                <SortHeader label="Stock" column="stock" sort={sort} onSort={toggleSort} />
                <Th>Active</Th>
                <Th align="right">Actions</Th>
              </TableHead>
              <tbody>
                {products.map((product) => {
                  const active = isActiveFlag(product.is_active);
                  const stock = Number(product.stock ?? 0);

                  return (
                    <tr key={product.id} className="border-t transition-colors hover:bg-[var(--surface-hover)]" style={{ borderColor: "var(--border-color)" }}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar label={initials(product.name)} seed={product.category_id} />
                          <div className="min-w-0">
                            <p className={`max-w-[260px] truncate font-semibold ${active ? "app-text" : "app-text-muted line-through decoration-1"}`}>
                              {product.name}
                            </p>
                            <p className="max-w-[260px] truncate text-xs app-text-muted">{product.description || `#${product.id}`}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone="neutral">{product.category_name || "Uncategorized"}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-semibold tabular-nums app-text">{money(product.price)}</td>
                      <td className="px-5 py-3.5">
                        <StockMeter stock={stock} reorderPoint={Number(product.reorder_point ?? LOW_STOCK)} onOrder={Number(product.on_order ?? 0)} />
                      </td>
                      <td className="px-5 py-3.5">
                        {canWrite ? (
                          <Switch
                            size="sm"
                            checked={active}
                            disabled={togglingId === product.id}
                            onChange={(next) => toggleActive(product, next)}
                            label={active ? `Deactivate ${product.name}` : `Activate ${product.name}`}
                          />
                        ) : (
                          <Badge tone={active ? "success" : "neutral"} dot>
                            {active ? "Active" : "Inactive"}
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1">
                          <IconAction icon="box" label="Stock history" onClick={() => setHistoryFor(product)} />
                          {canWrite && <IconAction icon="edit" label="Edit product" onClick={() => openEdit(product)} />}
                          {canDelete && <IconAction icon="trash" label="Delete product" tone="danger" onClick={() => handleDelete(product)} />}
                          {!canWrite && !canDelete && <span className="text-xs app-text-muted">View only</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {products.length > 0 && (
          <Pagination
            page={page}
            totalPages={Math.max(1, Number(pagination.totalPages) || 1)}
            total={Number(pagination.total) || 0}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            label="products"
          />
        )}
      </Card>

      <Modal
        open={formOpen || createRequested}
        onClose={closeForm}
        busy={saving}
        size="lg"
        icon={isEditing ? "edit" : "products"}
        title={isEditing ? `Edit ${editing.name}` : "Add a new product"}
        description={isEditing ? "Update pricing, stock, and availability." : "Add an item to your catalog so it can be ordered."}
        footer={
          <>
            <Button onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="product-form" variant="primary" loading={saving} icon="check">
              {isEditing ? "Save changes" : "Create product"}
            </Button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSubmit} className="space-y-5">
          <InlineAlert>{formError}</InlineAlert>

          {categories.length === 0 && !categoriesResource.loading && (
            <InlineAlert tone="warning">
              You need at least one category first.{" "}
              <Link to="/categories?new=1" className="font-semibold underline">
                Create a category
              </Link>
            </InlineAlert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name" required className="sm:col-span-2">
              {(id) => <input id={id} name="name" value={form.name} onChange={handleChange} required minLength={2} maxLength={150} placeholder="e.g. Ergonomic office chair" className="app-input" />}
            </Field>

            <Field label="Category" required>
              {(id) => (
                <select id={id} name="category_id" value={form.category_id} onChange={handleChange} required className="app-input">
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Price" required hint={form.price !== "" ? money(form.price) : "Price in Moroccan dirhams"}>
              {(id) => (
                <div className="relative">
                  <input id={id} name="price" type="number" min="0" step="0.01" value={form.price} onChange={handleChange} required placeholder="0.00" className="app-input pr-14" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold app-text-muted">MAD</span>
                </div>
              )}
            </Field>

            {isEditing ? (
              <Field label="Stock" hint="Changes are recorded in the stock ledger with a reason.">
                {(id) => (
                  <div className="flex items-center gap-2">
                    <input id={id} value={number(editing.stock)} readOnly className="app-input tabular-nums app-muted" />
                    {canAdjust && (
                      <Button icon="edit" onClick={() => setAdjusting(editing)}>
                        Adjust
                      </Button>
                    )}
                  </div>
                )}
              </Field>
            ) : (
              <Field label="Opening stock" required hint="Recorded as the opening balance in the stock ledger">
                {(id) => (
                  <div className="flex items-center gap-2">
                    <Button size="icon" icon="minus" aria-label="Decrease stock" onClick={() => setForm((f) => ({ ...f, stock: String(Math.max(0, (Number(f.stock) || 0) - 1)) }))} />
                    <input id={id} name="stock" type="number" min="0" step="1" value={form.stock} onChange={handleChange} required placeholder="0" className="app-input text-center tabular-nums" />
                    <Button size="icon" icon="plus" aria-label="Increase stock" onClick={() => setForm((f) => ({ ...f, stock: String((Number(f.stock) || 0) + 1) }))} />
                  </div>
                )}
              </Field>
            )}

            <Field label="Unit cost (HT)" hint="Used for margins. Receiving a purchase order updates it to the weighted average.">
              {(id) => (
                <div className="relative">
                  <input id={id} name="average_cost" type="number" min="0" step="0.01" value={form.average_cost} onChange={handleChange} placeholder="Unknown" className="app-input pr-14 tabular-nums" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold app-text-muted">MAD</span>
                </div>
              )}
            </Field>

            <Field label="Reorder point" hint="Flag as low stock and suggest a reorder at or below this level (0 = never)">
              {(id) => <input id={id} name="reorder_point" type="number" min="0" step="1" value={form.reorder_point} onChange={handleChange} className="app-input tabular-nums" />}
            </Field>

            <Field label="Preferred supplier" hint="Used to group reorder suggestions">
              {(id) => (
                <select id={id} name="supplier_id" value={form.supplier_id} onChange={handleChange} className="app-input">
                  <option value="">No preferred supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} · {supplier.lead_time_days} days lead time
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <div className="flex items-center justify-between gap-4 rounded-xl border p-3.5" style={{ borderColor: "var(--border-color)" }}>
              <div>
                <p className="text-sm font-semibold app-text">Active</p>
                <p className="text-xs app-text-muted">Inactive products can't be ordered.</p>
              </div>
              <Switch checked={form.is_active} onChange={(value) => setForm((f) => ({ ...f, is_active: value }))} label="Product is active" />
            </div>

            <Field label="Description" className="sm:col-span-2" hint={`${form.description.length}/1000`}>
              {(id) => <textarea id={id} name="description" rows={3} maxLength={1000} value={form.description} onChange={handleChange} placeholder="Materials, dimensions, packaging..." className="app-input resize-y" />}
            </Field>
          </div>

          {isEditing && (
            <p className="flex items-center gap-2 text-xs app-text-muted">
              <Icon name="info" size={14} /> Product #{editing.id}
            </p>
          )}
        </form>
      </Modal>

      <StockHistoryDrawer product={historyFor} onClose={() => setHistoryFor(null)} canAdjust={canAdjust} onChanged={reloadAll} />
      <StockAdjustModal
        product={adjusting}
        onClose={() => setAdjusting(null)}
        onAdjusted={() => {
          reloadAll();
          setFormOpen(false);
        }}
      />
    </div>
  );
}
