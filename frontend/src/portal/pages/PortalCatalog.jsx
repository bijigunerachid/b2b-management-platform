import { useEffect, useState } from "react";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import { useToast } from "../../components/ui/feedback";
import { Badge, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, toneStyle } from "../../components/ui/primitives";
import { money, useResource } from "../../lib/api";
import { useCart } from "../CartContext";

const availabilityMeta = {
  in_stock: { label: "In stock", tone: "success" },
  low_stock: { label: "Low stock", tone: "warning" },
  out_of_stock: { label: "Out of stock", tone: "danger" },
};

function ProductCard({ product }) {
  const cart = useCart();
  const toast = useToast();
  const [quantity, setQuantity] = useState(1);
  const meta = availabilityMeta[product.availability];
  const unavailable = product.availability === "out_of_stock";
  const inCart = cart.lines.find((line) => line.product_id === product.id);

  function add() {
    if (cart.full && !inCart) {
      toast.warning("Your cart can hold up to 50 different products.");
      return;
    }
    cart.add(product, quantity);
    toast.success(`${quantity} × ${product.name} added to your cart.`, { duration: 2500 });
    setQuantity(1);
  }

  return (
    <article className="app-surface flex flex-col p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={toneStyle("primary")}>
          <Icon name="box" size={19} />
        </span>
        <Badge tone={meta.tone} dot>
          {meta.label}
        </Badge>
      </div>
      <h3 className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold app-text">{product.name}</h3>
      <p className="mt-0.5 text-xs app-text-muted">{product.category_name}</p>
      <p className="mt-3 text-lg font-bold tabular-nums app-text">
        {money(product.price)} <span className="text-xs font-normal app-text-muted">HT</span>
      </p>
      <div className="mt-auto flex items-center gap-2 pt-4">
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(event) => setQuantity(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
          aria-label={`Quantity of ${product.name}`}
          disabled={unavailable}
          className="app-input h-10 w-16 px-1 py-0 text-center tabular-nums"
        />
        <Button variant={inCart ? "secondary" : "primary"} icon={inCart ? "check" : "plus"} onClick={add} disabled={unavailable} className="flex-1">
          {unavailable ? "Unavailable" : inCart ? `In cart (${inCart.quantity})` : "Add"}
        </Button>
      </div>
    </article>
  );
}

export default function PortalCatalog() {
  const cart = useCart();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = new URLSearchParams({ page: String(page) });
  if (debounced.trim()) query.set("search", debounced.trim());
  if (categoryId) query.set("category_id", categoryId);

  const { data, loading, error, reload } = useResource(`/portal/catalog?${query}`);
  const products = data?.data ?? [];
  const categories = data?.categories ?? [];
  const pagination = data?.pagination ?? { total: 0, totalPages: 1 };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order products"
        actions={
          <Button variant="primary" icon="orders" onClick={() => cart.setOpen(true)}>
            Cart {cart.units > 0 ? `(${cart.units})` : ""}
          </Button>
        }
      />

      <div className="flex flex-col gap-3">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search products..."
          className="sm:w-96"
        />
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Categories">
          {[{ id: "", name: "All products" }, ...categories].map((category) => {
            const active = String(category.id) === categoryId;
            return (
              <button
                key={category.id || "all"}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setCategoryId(String(category.id));
                  setPage(1);
                }}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${active ? "" : "app-text-secondary hover:bg-[var(--surface-hover)]"}`}
                style={active ? { ...toneStyle("primary"), borderColor: "var(--primary)" } : { borderColor: "var(--border-color)", backgroundColor: "var(--surface)" }}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="skeleton h-56 rounded-2xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState icon="search" title="No products found" description="Try another search or category." />
      ) : (
        <>
          <div className={`grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="app-surface overflow-hidden">
            <Pagination page={page} totalPages={Math.max(1, pagination.totalPages)} total={pagination.total} pageSize={pagination.limit ?? 24} onPageChange={setPage} label="products" />
          </div>
        </>
      )}
    </div>
  );
}
