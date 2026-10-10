import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Icon from "../components/ui/Icon";
import Button from "../components/ui/Button";
import { Drawer } from "../components/ui/Modal";
import { useConfirm, useToast } from "../components/ui/feedback";
import { Avatar, InlineAlert, Popover } from "../components/ui/primitives";
import { PageFallback } from "../components/PageFallback";
import LanguageMenu from "../components/LanguageMenu";
import { api, initials, money } from "../lib/api";
import company from "../config/company";
import { hasDiscount, usePrices } from "../lib/pricing";
import { CartProvider, useCart } from "./CartContext";
import HelpAssistant from "../components/HelpAssistant";

import { t } from "../i18n";
const links = [
  { to: "/portal", label: "Home", icon: "dashboard", end: true },
  { to: "/portal/catalog", label: "Catalog", icon: "products" },
  { to: "/portal/orders", label: "Orders", icon: "orders" },
  { to: "/portal/quotes", label: "Quotes", icon: "fileText" },
  { to: "/portal/account", label: "Account", icon: "users" },
];

function CartDrawer() {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const { prices, loading: pricing } = usePrices("/portal/cart/price", null, cart.open ? cart.lines : []);
  const priceOf = (line) => prices.get(line.product_id)?.unit_price ?? line.price;
  const subtotal = Math.round(cart.lines.reduce((sum, line) => sum + priceOf(line) * line.quantity, 0) * 100) / 100;
  const vat = Math.round(subtotal * company.vatRate * 100) / 100;

  async function placeOrder() {
    setError("");
    setPlacing(true);
    try {
      const result = await api("/portal/orders", {
        method: "POST",
        body: { items: cart.lines.map((line) => ({ product_id: line.product_id, quantity: line.quantity })) },
      });
      cart.clear();
      cart.setOpen(false);
      toast.success(t("We received order #{id}. We'll confirm it shortly.", { id: result.data.orderId }), { title: t("Order placed") });
      navigate(`/portal/orders?view=${result.data.orderId}`);
    } catch (err) {
      setError(err.message || t("Your order could not be placed."));
    } finally {
      setPlacing(false);
    }
  }

  return (
    <Drawer
      open={cart.open}
      onClose={() => !placing && cart.setOpen(false)}
      title={cart.lines.length ? (cart.units === 1 ? t("1 item") : t("{count} items", { count: cart.units })) : t("Your cart is empty")}
      description={t("Your prices, including your discounts.")}
      icon="orders"
      footer={
        cart.lines.length > 0 && (
          <>
            <Button variant="ghost" onClick={cart.clear} disabled={placing} className="me-auto">
              {t("Empty cart")}
            </Button>
            <Button variant="primary" icon="check" loading={placing} onClick={placeOrder}>
              {t("Place order")} · {money(subtotal + vat)}
            </Button>
          </>
        )
      }
    >
      <InlineAlert>{error}</InlineAlert>
      {cart.lines.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm app-text-secondary">{t("Browse the catalog and add products to your cart.")}</p>
          <Button
            className="mt-4"
            variant="primary"
            icon="products"
            onClick={() => {
              cart.setOpen(false);
              navigate("/portal/catalog");
            }}
          >
            {t("Open the catalog")}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="divide-y overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
            {cart.lines.map((line) => {
              const price = prices.get(line.product_id);
              return (
              <li key={line.product_id} className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold app-text">{line.name}</p>
                  <p className="text-xs app-text-muted">
                    {hasDiscount(price) && <span className="me-1 line-through">{money(price.list_price)}</span>}
                    {t("{price} each", { price: money(priceOf(line)) })}
                    {price?.label && ` · ${price.label}`}
                  </p>
                  {price?.next_break && (
                    <p className="text-xs font-medium" style={{ color: "var(--success)" }}>
                      {t("Order {count} more for a {percent}% volume discount", { count: price.next_break.min_quantity - line.quantity, percent: price.next_break.discount_percent })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon-sm" icon="minus" aria-label={t("Fewer {product}", { product: line.name })} onClick={() => cart.setQuantity(line.product_id, line.quantity - 1)} />
                  <input
                    type="number"
                    min="1"
                    value={line.quantity}
                    onChange={(event) => cart.setQuantity(line.product_id, Math.max(1, Number.parseInt(event.target.value, 10) || 1))}
                    aria-label={t("Quantity of {product}", { product: line.name })}
                    className="app-input h-8 w-16 px-1 py-0 text-center tabular-nums"
                  />
                  <Button size="icon-sm" icon="plus" aria-label={t("More {product}", { product: line.name })} onClick={() => cart.setQuantity(line.product_id, line.quantity + 1)} />
                </div>
                <p className="w-24 text-end text-sm font-semibold tabular-nums app-text">{money(priceOf(line) * line.quantity)}</p>
              </li>
              );
            })}
          </ul>
          <dl className={`space-y-1.5 rounded-xl p-4 text-sm app-muted transition-opacity ${pricing ? "opacity-60" : ""}`}>
            <div className="flex justify-between">
              <dt className="app-text-secondary">{t("Subtotal (HT)")}</dt>
              <dd className="tabular-nums app-text">{money(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="app-text-secondary">{t("VAT {percent}%", { percent: Math.round(company.vatRate * 100) })}</dt>
              <dd className="tabular-nums app-text">{money(vat)}</dd>
            </div>
            <div className="flex justify-between pt-1 text-base">
              <dt className="font-semibold app-text">{t("Total")}</dt>
              <dd className="font-bold tabular-nums app-text">{money(subtotal + vat)}</dd>
            </div>
          </dl>
          <p className="text-xs app-text-muted">
            {t("Payment terms: {days} days after invoice. Your order is reviewed by our team before it ships.", { days: company.paymentTermsDays })}
          </p>
        </div>
      )}
    </Drawer>
  );
}

function Shell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const cart = useCart();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const page = links.find((link) => (link.end ? location.pathname === link.to : location.pathname.startsWith(link.to)));
    document.title = `${page ? t(page.label) : t("Portal")} · ${t("{company} client portal", { company: company.name })}`;
  }, [location.pathname]);

  async function signOut() {
    if (!(await confirm({ title: t("Sign out?"), message: t("You'll need your password to sign in again."), confirmLabel: t("Sign out"), tone: "primary", icon: "logout" }))) return;
    await logout().catch(() => {});
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--app-bg)" }}>
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-md"
        style={{ backgroundColor: "color-mix(in srgb, var(--surface) 88%, transparent)", borderColor: "var(--border-color)" }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: "var(--primary)" }}>
              <Icon name="box" size={19} strokeWidth={2} />
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-bold leading-tight app-text">{company.name}</p>
              <p className="truncate text-xs app-text-muted">{t("Client portal")} · {user?.company_name}</p>
            </div>
          </div>

          <nav className="ms-auto hidden items-center gap-1 md:flex" aria-label={t("Portal navigation")}>
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "text-[var(--primary)]" : "app-text-secondary hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"}`
                }
                style={({ isActive }) => (isActive ? { backgroundColor: "var(--primary-soft)" } : undefined)}
              >
                {t(link.label)}
              </NavLink>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-1 md:ms-2">
            <button
              type="button"
              onClick={() => cart.setOpen(true)}
              aria-label={t("Cart, {count} items", { count: cart.units })}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-[var(--surface-hover)] app-text-secondary"
            >
              <Icon name="orders" size={19} />
              {cart.units > 0 && (
                <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ backgroundColor: "var(--primary)" }}>
                  {cart.units > 99 ? "99+" : cart.units}
                </span>
              )}
            </button>
            <LanguageMenu />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? t("Switch to light mode") : t("Switch to dark mode")}
              className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-[var(--surface-hover)] app-text-secondary"
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={19} />
            </button>
            <Popover
              label={t("Account menu")}
              width={250}
              trigger={({ props }) => (
                <button type="button" {...props} aria-label={t("Account menu")} className="rounded-xl p-1 transition hover:bg-[var(--surface-hover)]">
                  <Avatar label={initials(user?.first_name, user?.last_name)} seed={user?.id} size={32} rounded="rounded-full" />
                </button>
              )}
            >
              {({ close }) => (
                <div>
                  <div className="border-b p-4" style={{ borderColor: "var(--border-color)" }}>
                    <p className="truncate text-sm font-semibold app-text">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="truncate text-xs app-text-secondary">{user?.email}</p>
                    <p className="mt-1 truncate text-xs font-medium" style={{ color: "var(--primary)" }}>
                      {user?.company_name}
                    </p>
                  </div>
                  <div className="p-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        navigate("/portal/account");
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-[var(--surface-hover)] app-text"
                    >
                      <Icon name="lock" size={17} /> Account & password
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        signOut();
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--danger)] transition hover:bg-[var(--danger-soft)]"
                    >
                      <Icon name="logout" size={17} /> {t("Sign out")}
                    </button>
                  </div>
                </div>
              )}
            </Popover>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t px-3 py-2 md:hidden" style={{ borderColor: "var(--border-color)" }} aria-label={t("Portal navigation")}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? "text-[var(--primary)]" : "app-text-secondary"}`}
              style={({ isActive }) => (isActive ? { backgroundColor: "var(--primary-soft)" } : undefined)}
            >
              <Icon name={link.icon} size={15} />
              {t(link.label)}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <div key={location.pathname} className="animate-rise">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs app-text-muted sm:px-6">
        {company.name} · {company.phone} · {company.email}
      </footer>

      <CartDrawer />
      <HelpAssistant />
    </div>
  );
}

export default function PortalLayout() {
  return (
    <CartProvider>
      <Shell />
    </CartProvider>
  );
}
