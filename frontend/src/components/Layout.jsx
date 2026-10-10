import { Suspense, useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import Icon from "./ui/Icon";
import { Avatar, Popover } from "./ui/primitives";
import { useConfirm, useToast } from "./ui/feedback";
import CommandPalette from "./CommandPalette";
import LanguageMenu from "./LanguageMenu";
import NotificationsMenu from "./NotificationsMenu";
import { PageFallback } from "./PageFallback";
import { can, initials } from "../lib/api";

import { t } from "../i18n";
const sections = [
  {
    title: "Overview",
    links: [
      { label: "Dashboard", path: "/", icon: "dashboard", permission: "dashboard.view" },
      { label: "Reports", path: "/reports", icon: "revenue", permission: "reports.view" },
      { label: "Demand forecast", path: "/forecast", icon: "sparkles", permission: "reports.view" },
    ],
  },
  {
    title: "Sales",
    links: [
      { label: "Quotes", path: "/quotes", icon: "fileText", permission: "quotes.view" },
      { label: "Orders", path: "/orders", icon: "orders", permission: "orders.view" },
      { label: "Receivables", path: "/receivables", icon: "wallet", permission: "payments.view" },
      { label: "Credit notes", path: "/credit-notes", icon: "undo", permission: "payments.view" },
      { label: "Customers", path: "/customers", icon: "customers", permission: "customers.view" },
    ],
  },
  {
    title: "Catalog",
    links: [
      { label: "Products", path: "/products", icon: "products", permission: "products.view" },
      { label: "Categories", path: "/categories", icon: "categories", permission: "products.view" },
      { label: "Pricing", path: "/pricing", icon: "receipt", permission: "pricing.view" },
    ],
  },
  {
    title: "Inventory",
    links: [
      { label: "Stock", path: "/inventory", icon: "box", permission: "inventory.view" },
      { label: "Purchase orders", path: "/purchase-orders", icon: "truck", permission: "inventory.view" },
      { label: "Suppliers", path: "/suppliers", icon: "building", permission: "inventory.view" },
    ],
  },
  {
    title: "Administration",
    links: [
      { label: "Users", path: "/users", icon: "users", permission: "users.manage" },
      { label: "Audit log", path: "/audit", icon: "list", permission: "audit.view" },
    ],
  },
];

function readCollapsed() {
  try {
    return localStorage.getItem("b2b-sidebar") === "collapsed";
  } catch {
    return false;
  }
}

function Logo({ compact }) {
  return (
    <Link to="/" className="flex items-center gap-3 outline-none">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md"
        style={{ backgroundColor: "var(--primary)" }}
      >
        <Icon name="box" size={21} strokeWidth={2} />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-tight tracking-tight app-text">{t("B2B Platform")}</p>
          <p className="text-xs app-text-muted">{t("Business Management")}</p>
        </div>
      )}
    </Link>
  );
}

function SidebarContent({ visibleSections, collapsed, onNavigate, user, onLogout }) {
  return (
    <div className="flex h-full flex-col">
      <div className={`flex h-[72px] shrink-0 items-center ${collapsed ? "justify-center" : "px-5"}`}>
        <Logo compact={collapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label={t("Main navigation")}>
        {visibleSections.map((section) => (
          <div key={section.title} className="mt-4 first:mt-1">
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6" style={{ backgroundColor: "var(--border-color)" }} />
            ) : (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider app-text-muted">
                {t(section.title)}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {section.links.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  end={link.path === "/"}
                  onClick={onNavigate}
                  title={collapsed ? t(link.label) : undefined}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                      collapsed ? "mx-auto h-11 w-11 justify-center" : "px-3 py-2.5"
                    } ${
                      isActive
                        ? "text-[var(--primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                    }`
                  }
                  style={({ isActive }) => (isActive ? { backgroundColor: "var(--primary-soft)" } : undefined)}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && !collapsed && (
                        <span
                          className="absolute -start-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-e-full"
                          style={{ backgroundColor: "var(--primary)" }}
                        />
                      )}
                      <Icon name={link.icon} size={19} strokeWidth={isActive ? 2.1 : 1.8} />
                      {!collapsed && <span className="flex-1">{t(link.label)}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t p-3" style={{ borderColor: "var(--border-color)" }}>
        <div className={`flex items-center gap-3 rounded-xl p-2 ${collapsed ? "flex-col" : ""}`}>
          <Avatar label={initials(user?.first_name, user?.last_name)} seed={user?.id} size={36} rounded="rounded-full" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold app-text">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="truncate text-xs app-text-muted">{t(user?.role)}</p>
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            aria-label={t("Sign out")}
            title={t("Sign out")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] app-text-secondary"
          >
            <Icon name="logout" size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const toast = useToast();

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const visibleSections = sections
    .map((section) => ({
      ...section,
      links: section.links.filter((link) => can(user, link.permission)),
    }))
    .filter((section) => section.links.length > 0);

  const allLinks = visibleSections.flatMap((section) => section.links);

  const currentPage =
    allLinks.find((link) => link.path === "/" && location.pathname === "/") ||
    allLinks.find((link) => link.path !== "/" && location.pathname.startsWith(link.path));

  const currentSection = visibleSections.find((section) => section.links.includes(currentPage));

  useEffect(() => {
    try {
      localStorage.setItem("b2b-sidebar", collapsed ? "collapsed" : "expanded");
    } catch {
      // Preference is kept for this session only.
    }
  }, [collapsed]);

  const pageTitle = currentPage ? `${t(currentPage.label)} · B2B Platform` : "B2B Platform";
  useEffect(() => {
    window.document.title = pageTitle;
  }, [pageTitle]);

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = useCallback(async () => {
    const confirmed = await confirm({
      title: t("Sign out?"),
      message: t("You will need to sign in again to access the workspace."),
      confirmLabel: t("Sign out"),
      tone: "primary",
      icon: "logout",
    });

    if (!confirmed) return;

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      toast.error(t("Could not sign out. Please try again."));
    }
  }, [confirm, logout, navigate, toast]);

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--app-bg)" }}>
      <aside
        className="fixed inset-y-0 start-0 z-40 hidden border-e transition-[width] duration-200 lg:block"
        style={{
          width: collapsed ? 80 : "var(--sidebar-width)",
          backgroundColor: "var(--surface)",
          borderColor: "var(--border-color)",
        }}
      >
        <SidebarContent
          visibleSections={visibleSections}
          collapsed={collapsed}
          user={user}
          onLogout={handleLogout}
        />
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? t("Expand sidebar") : t("Collapse sidebar")}
          title={collapsed ? t("Expand sidebar") : t("Collapse sidebar")}
          className="absolute -end-3 top-[26px] flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition hover:scale-110 app-text-secondary"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-color)" }}
        >
          <Icon name="chevronsLeft" size={13} strokeWidth={2.2} className={`transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in"
            style={{ backgroundColor: "var(--overlay)" }}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="absolute inset-y-0 start-0 w-[280px] max-w-[85vw] border-e shadow-2xl animate-drawer-left"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border-color)" }}
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label={t("Close navigation")}
              className="absolute end-3 top-5 flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] app-text-secondary"
            >
              <Icon name="close" size={18} />
            </button>
            <SidebarContent
              visibleSections={visibleSections}
              collapsed={false}
              user={user}
              onNavigate={() => setMobileOpen(false)}
              onLogout={handleLogout}
            />
          </aside>
        </div>
      )}

      <div
        className={`flex min-h-screen min-w-0 flex-col transition-[padding] duration-200 ${
          collapsed ? "lg:ps-20" : "lg:ps-[var(--sidebar-width)]"
        }`}
      >
        <header
          className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b px-4 backdrop-blur-md sm:px-6 lg:px-8"
          style={{
            backgroundColor: "color-mix(in srgb, var(--surface) 82%, transparent)",
            borderColor: "var(--border-color)",
          }}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={t("Open navigation")}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-[var(--surface-hover)] lg:hidden app-text"
          >
            <Icon name="menu" size={20} />
          </button>

          <nav aria-label={t("Breadcrumb")} className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
            <span className="app-text-muted">{currentSection ? t(currentSection.title) : t("Workspace")}</span>
            <Icon name="chevronRight" size={14} className="app-text-muted" />
            <span className="truncate font-semibold app-text">{currentPage ? t(currentPage.label) : t("Page")}</span>
          </nav>

          <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="group flex h-10 items-center gap-2.5 rounded-xl border px-3 text-sm transition hover:border-[var(--border-strong)] md:w-64 app-text-muted"
              style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface-muted)" }}
              aria-label={t("Open command palette")}
            >
              <Icon name="search" size={17} />
              <span className="hidden flex-1 text-start md:block">{t("Search anything...")}</span>
              <span className="hidden items-center gap-0.5 md:flex">
                <span className="kbd">{isMac ? "⌘" : "Ctrl"}</span>
                <span className="kbd">{t("K")}</span>
              </span>
            </button>

            <NotificationsMenu />

            <LanguageMenu />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? t("Switch to light mode") : t("Switch to dark mode")}
              title={theme === "dark" ? t("Switch to light mode") : t("Switch to dark mode")}
              className="flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-[var(--surface-hover)] app-text-secondary"
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={19} className="transition-transform duration-300 hover:rotate-12" />
            </button>

            <Popover
              label={t("Account menu")}
              width={260}
              trigger={({ props }) => (
                <button
                  type="button"
                  {...props}
                  className="ms-1 flex items-center gap-2 rounded-xl p-1 pe-2 transition hover:bg-[var(--surface-hover)]"
                  aria-label={t("Account menu")}
                >
                  <Avatar label={initials(user?.first_name, user?.last_name)} seed={user?.id} size={34} rounded="rounded-full" />
                  <Icon name="chevronDown" size={15} className="hidden app-text-muted sm:block" />
                </button>
              )}
            >
              {({ close }) => (
                <div>
                  <div className="flex items-center gap-3 border-b p-4" style={{ borderColor: "var(--border-color)" }}>
                    <Avatar label={initials(user?.first_name, user?.last_name)} seed={user?.id} size={42} rounded="rounded-full" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold app-text">
                        {user?.first_name} {user?.last_name}
                      </p>
                      <p className="truncate text-xs app-text-secondary">{user?.email}</p>
                      <span
                        className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{ backgroundColor: "var(--primary-soft)", color: "var(--primary)" }}
                      >
                        {t(user?.role)}
                      </span>
                    </div>
                  </div>
                  <div className="p-1.5">
                    {[
                      { icon: theme === "dark" ? "sun" : "moon", label: theme === "dark" ? t("Light mode") : t("Dark mode"), run: toggleTheme },
                      { icon: "command", label: t("Command palette"), hint: isMac ? "⌘K" : "Ctrl K", run: () => setPaletteOpen(true) },
                      { icon: "logout", label: t("Sign out"), run: handleLogout, danger: true },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          close();
                          item.run();
                        }}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                          item.danger
                            ? "text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                            : "app-text hover:bg-[var(--surface-hover)]"
                        }`}
                      >
                        <Icon name={item.icon} size={17} />
                        <span className="flex-1 text-start">{item.label}</span>
                        {item.hint && <span className="text-xs app-text-muted">{item.hint}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Popover>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div key={location.pathname} className="animate-rise">
            {/* Keeps the shell on screen while a lazily loaded page arrives. */}
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        user={user}
        links={allLinks}
        onLogout={handleLogout}
      />
    </div>
  );
}
