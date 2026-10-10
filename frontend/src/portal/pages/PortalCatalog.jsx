import { useEffect, useState } from "react";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import { useToast } from "../../components/ui/feedback";
import { Badge, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, toneStyle } from "../../components/ui/primitives";
import { money, useResource } from "../../lib/api";
import { recommendationReason } from "../../lib/ml";
import { useCart } from "../CartContext";

import { t } from "../../i18n";
const availabilityMeta = {
  in_stock: { label: "In stock", tone: "success" },
  low_stock: { label: "Low stock", tone: "warning" },
  out_of_stock: { label: "Out of stock", tone: "danger" },
};

export function ProductCard({ product }) {
  const cart = useCart();
  const toast = useToast();
  const [quantity, setQuantity] = useState(1);
  const meta = availabilityMeta[product.availability];
  const unavailable = product.availability === "out_of_stock";
  const inCart = cart.lines.find((line) => line.product_id === product.id);

  function add() {
    if (cart.full && !inCart) {
      toast.warning(t("Your cart can hold up to 50 different products."));
      return;
    }
    cart.add({ ...product, price: product.your_price ?? product.price }, quantity);
    toast.success(t("{quantity} × {product} added to your cart.", { quantity, product: product.name }), { duration: 2500 });
    setQuantity(1);
  }

  return (
    <article className="app-surface flex flex-col p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={toneStyle("primary")}>
          <Icon name="box" size={19} />
        </span>
        <Badge tone={meta.tone} dot>
          {t(meta.label)}
        </Badge>
      </div>
      <h3 className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold app-text">{product.name}</h3>
      <p className="mt-0.5 text-xs app-text-muted">{product.category_name}</p>
      {product.reason && (
        <p className="mt-2 flex items-start gap-1.5 text-xs app-text-secondary">
          <Icon name="sparkles" size={13} className="mt-0.5 shrink-0" style={{ color: "var(--primary)" }} />
          {recommendationReason(product.reason, "client")}
        </p>
      )}
      <div className="mt-3">
        {product.your_price < product.price && (
          <p className="text-xs tabular-nums app-text-muted">
            <span className="line-through">{money(product.price)}</span> · {product.price_label}
          </p>
        )}
        <p className="text-lg font-bold tabular-nums app-text">
          {money(product.your_price ?? product.price)} <span className="text-xs font-normal app-text-muted">{t("HT")}</span>
        </p>
        {product.volume_prices?.length > 0 && (
          <p className="mt-0.5 text-xs app-text-secondary">
            {product.volume_prices.map((tier) => `${tier.min_quantity}+: ${money(tier.unit_price)}`).join(" · ")}
          </p>
        )}
      </div>
      <div className="mt-auto flex items-center gap-2 pt-4">
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(event) => setQuantity(Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
          aria-label={t("Quantity of {product}", { product: product.name })}
          disabled={unavailable}
          className="app-input h-10 w-16 px-1 py-0 text-center tabular-nums"
        />
        <Button variant={inCart ? "secondary" : "primary"} icon={inCart ? "check" : "plus"} onClick={add} disabled={unavailable} className="flex-1">
          {unavailable ? t("Unavailable") : inCart ? t("In cart ({count})", { count: inCart.quantity }) : t("Add")}
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
        title={t("Order products")}
        actions={
          <Button variant="primary" icon="orders" onClick={() => cart.setOpen(true)}>
            {t("Cart")} {cart.units > 0 ? `(${cart.units})` : ""}
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
          placeholder={t("Search products...")}
          className="sm:w-96"
        />
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label={t("Categories")}>
          {[{ id: "", name: t("All products") }, ...categories].map((category) => {
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
        <EmptyState icon="search" title={t("No products found")} description={t("Try another search or category.")} />
      ) : (
        <>
          <div className={`grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${loading ? "opacity-60" : ""}`}>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="app-surface overflow-hidden">
            <Pagination page={page} totalPages={Math.max(1, pagination.totalPages)} total={pagination.total} pageSize={pagination.limit ?? 24} onPageChange={setPage} label={t("products")} />
          </div>
        </>
      )}
    </div>
  );
}
