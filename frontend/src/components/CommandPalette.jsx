import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import Icon from "./ui/Icon";
import { api, can, money, toList } from "../lib/api";
import { useTheme } from "../context/ThemeContext";

/**
 * Global ⌘K / Ctrl+K launcher: navigation, quick actions, and live record
 * search across customers, products, and orders.
 */
export default function CommandPalette({ open, onClose, user, links, onLogout }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [records, setRecords] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Load searchable records the first time the palette opens.
  useEffect(() => {
    if (!open || records) return undefined;

    let cancelled = false;

    Promise.allSettled([
      api("/customers"),
      api("/products?limit=100"),
      api("/orders"),
    ]).then(([customers, products, orders]) => {
      if (cancelled) return;
      setRecords({
        customers: customers.status === "fulfilled" ? toList(customers.value) : [],
        products: products.status === "fulfilled" ? toList(products.value) : [],
        orders: orders.status === "fulfilled" ? toList(orders.value) : [],
      });
    });

    return () => {
      cancelled = true;
    };
  }, [open, records]);

  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = (...values) =>
      !term || values.filter(Boolean).join(" ").toLowerCase().includes(term);

    const go = (path) => () => navigate(path);

    const navigation = links
      .filter((link) => matches(link.label, "go to page"))
      .map((link) => ({
        id: `nav-${link.path}`,
        icon: link.icon,
        label: link.label,
        hint: "Page",
        run: go(link.path),
      }));

    const actions = [
      can(user, "customers.write") && {
        id: "new-customer",
        icon: "userPlus",
        label: "Add new customer",
        run: go("/customers?new=1"),
      },
      can(user, "products.write") && {
        id: "new-product",
        icon: "products",
        label: "Add new product",
        run: go("/products?new=1"),
      },
      can(user, "orders.write") && {
        id: "new-order",
        icon: "orders",
        label: "Create new order",
        run: go("/orders?new=1"),
      },
      can(user, "categories.write") && {
        id: "new-category",
        icon: "categories",
        label: "Add new category",
        run: go("/categories?new=1"),
      },
      {
        id: "theme",
        icon: theme === "dark" ? "sun" : "moon",
        label: `Switch to ${theme === "dark" ? "light" : "dark"} mode`,
        run: toggleTheme,
      },
      {
        id: "logout",
        icon: "logout",
        label: "Sign out",
        run: onLogout,
      },
    ]
      .filter(Boolean)
      .filter((action) => matches(action.label));

    const result = [
      { title: "Navigation", items: navigation },
      { title: "Actions", items: actions },
    ];

    if (term.length >= 2 && records) {
      result.push(
        {
          title: "Customers",
          items: records.customers
            .filter((customer) => matches(customer.company_name, customer.contact_name, customer.email, customer.city))
            .slice(0, 5)
            .map((customer) => ({
              id: `customer-${customer.id}`,
              icon: "building",
              label: customer.company_name,
              hint: customer.city || customer.contact_name,
              run: go(`/customers?view=${customer.id}`),
            })),
        },
        {
          title: "Products",
          items: records.products
            .filter((product) => matches(product.name, product.category_name))
            .slice(0, 5)
            .map((product) => ({
              id: `product-${product.id}`,
              icon: "box",
              label: product.name,
              hint: `${money(product.price)} · ${product.stock} in stock`,
              run: go(`/products?q=${encodeURIComponent(product.name)}`),
            })),
        },
        {
          title: "Orders",
          items: records.orders
            .filter((order) => matches(`#${order.id}`, String(order.id), order.company_name, order.status))
            .slice(0, 5)
            .map((order) => ({
              id: `order-${order.id}`,
              icon: "orders",
              label: `Order #${order.id} · ${order.company_name}`,
              hint: `${order.status} · ${money(order.total_amount)}`,
              run: go(`/orders?view=${order.id}`),
            })),
        }
      );
    }

    return result.filter((group) => group.items.length > 0);
  }, [query, records, links, user, theme, navigate, toggleTheme, onLogout]);

  const flat = groups.flatMap((group) => group.items);
  const activeIndex = Math.min(active, Math.max(0, flat.length - 1));

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  function close() {
    setQuery("");
    setActive(0);
    setRecords(null); // refetch next time so new records appear
    onClose();
  }

  function run(item) {
    close();
    item.run();
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((activeIndex + 1) % Math.max(flat.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((activeIndex - 1 + flat.length) % Math.max(flat.length, 1));
    } else if (event.key === "Enter" && flat[activeIndex]) {
      event.preventDefault();
      run(flat[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  let index = -1;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]">
      <div
        className="absolute inset-0 backdrop-blur-[2px] animate-fade-in"
        style={{ backgroundColor: "var(--overlay)" }}
        onMouseDown={close}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border animate-pop-in"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border-color)",
          boxShadow: "var(--pop-shadow)",
        }}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b px-4" style={{ borderColor: "var(--border-color)" }}>
          <Icon name="search" size={19} className="app-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            placeholder="Search pages, actions, customers, orders…"
            aria-label="Search commands"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={flat[activeIndex] ? `cmd-${flat[activeIndex].id}` : undefined}
            className="h-14 flex-1 bg-transparent text-[15px] outline-none app-text placeholder:text-[var(--text-muted)]"
          />
          <span className="kbd">Esc</span>
        </div>

        <div ref={listRef} id="command-results" role="listbox" className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
          {groups.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium app-text">No results for “{query}”</p>
              <p className="mt-1 text-xs app-text-secondary">
                {records ? "Try a company name, product, or order number." : "Loading records…"}
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.title} className="mb-1">
                <p className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wider app-text-muted">
                  {group.title}
                </p>
                {group.items.map((item) => {
                  index += 1;
                  const itemIndex = index;
                  const selected = itemIndex === activeIndex;

                  return (
                    <button
                      key={item.id}
                      id={`cmd-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      data-index={itemIndex}
                      onMouseMove={() => setActive(itemIndex)}
                      onClick={() => run(item)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors"
                      style={selected ? { backgroundColor: "var(--primary-soft)" } : undefined}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                        style={{
                          borderColor: "var(--border-color)",
                          color: selected ? "var(--primary)" : "var(--text-secondary)",
                          backgroundColor: "var(--surface)",
                        }}
                      >
                        <Icon name={item.icon} size={16} />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium app-text">{item.label}</span>
                      {item.hint && <span className="hidden truncate text-xs app-text-muted sm:block">{item.hint}</span>}
                      {selected && <Icon name="arrowRight" size={15} style={{ color: "var(--primary)" }} />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          className="flex items-center gap-4 border-t px-4 py-2.5 text-xs app-text-muted"
          style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface-muted)" }}
        >
          <span className="flex items-center gap-1.5"><span className="kbd">↑</span><span className="kbd">↓</span> navigate</span>
          <span className="flex items-center gap-1.5"><span className="kbd">↵</span> select</span>
          <span className="ml-auto hidden sm:block">Tip: type 2+ letters to search records</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
