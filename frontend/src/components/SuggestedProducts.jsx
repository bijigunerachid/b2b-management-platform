import { Link } from "react-router-dom";
import Icon from "./ui/Icon";
import { money, useResource } from "../lib/api";
import { recommendationReason } from "../lib/ml";

import { t } from "../i18n";

/** Products this customer hasn't bought yet but probably needs, from the recommendation model. */
export default function SuggestedProducts({ customer }) {
  const { data, loading } = useResource(customer ? `/ml/recommendations/customers/${customer.id}` : null);
  const items = (data?.data ?? []).slice(0, 5);

  if (loading && !data) return <div className="skeleton h-40 rounded-xl" />;
  if (!items.length) return null; // no model yet, or nothing new to suggest

  return (
    <section aria-labelledby="suggested-heading">
      <h3 id="suggested-heading" className="mb-1 flex items-center gap-2 text-sm font-bold app-text">
        <Icon name="sparkles" size={15} style={{ color: "var(--primary)" }} />
        {t("Suggested products")}
      </h3>
      <p className="mb-3 text-xs app-text-muted">{t("Not bought yet by this customer, likely to be needed. Worth mentioning on the next call or quote.")}</p>
      <ul className="divide-y overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
            <div className="min-w-0 flex-1">
              <Link to={`/products?q=${encodeURIComponent(item.name)}`} className="block truncate text-sm font-semibold hover:underline app-text">
                {item.name}
              </Link>
              <p className="truncate text-xs app-text-muted">{item.category_name}</p>
              <p className="mt-1 text-xs app-text-secondary">{recommendationReason(item.reason)}</p>
            </div>
            <div className="text-end">
              <p className="text-sm font-semibold tabular-nums app-text">{money(item.price)}</p>
              <p className="text-[11px] tabular-nums app-text-muted">{item.stock > 0 ? t("{count} in stock", { count: item.stock }) : t("Out of stock")}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
