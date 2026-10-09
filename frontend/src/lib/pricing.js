import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

export const PRICE_SOURCES = {
  list: { label: "Catalog price", tone: "neutral" },
  price_list: { label: "Price list", tone: "info" },
  volume: { label: "Volume discount", tone: "success" },
  contract: { label: "Contract price", tone: "primary" },
  quote: { label: "Quoted price", tone: "warning" },
};

/**
 * Asks the server what `lines` cost for a customer, so forms show the same
 * price the order will get. `path` is /pricing/preview (staff, needs
 * customerId) or /portal/cart/price (the signed-in client).
 * Returns { prices: Map(productId → line), priceList, loading }.
 */
export function usePrices(path, customerId, lines) {
  const items = lines
    .map((line) => ({ product_id: Number(line.product_id), quantity: Number(line.quantity) }))
    .filter((item) => item.product_id > 0 && Number.isInteger(item.quantity) && item.quantity > 0);
  const needsCustomer = path === "/pricing/preview";
  const key = items.length > 0 && (!needsCustomer || customerId) ? JSON.stringify({ customerId: needsCustomer ? Number(customerId) : null, items }) : null;

  const [state, setState] = useState({ key: null, lines: [], priceList: null });

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;

    // Short delay so typing a quantity sends one request, not one per keystroke.
    const timer = setTimeout(() => {
      const { customerId: customer, items: body } = JSON.parse(key);
      api(path, { method: "POST", body: customer ? { customer_id: customer, items: body } : { items: body } }).then(
        (result) => {
          if (!cancelled) setState({ key, lines: result.data?.lines ?? [], priceList: result.data?.price_list ?? null });
        },
        () => {
          if (!cancelled) setState((previous) => ({ ...previous, key }));
        }
      );
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, path]);

  const prices = useMemo(() => new Map(state.lines.map((line) => [line.product_id, line])), [state.lines]);

  return { prices: key ? prices : new Map(), priceList: state.priceList, loading: Boolean(key) && state.key !== key };
}

export function hasDiscount(line) {
  return line && Number(line.list_price) > Number(line.unit_price) + 0.004;
}
