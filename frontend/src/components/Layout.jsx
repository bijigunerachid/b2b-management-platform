
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle";

const links = [
  {
    label: "Dashboard",
    path: "/",
    roles: ["Admin", "Manager", "Employee"],
    icon: "▦",
  },
  {
    label: "Customers",
    path: "/customers",
    roles: ["Admin", "Manager", "Employee"],
    icon: "♙",
  },
  {
    label: "Products",
    path: "/products",
    roles: ["Admin", "Manager", "Employee"],
    icon: "▤",
  },
  {
    label: "Categories",
    path: "/categories",
    roles: ["Admin", "Manager", "Employee"],
    icon: "▧",
  },
  {
    label: "Orders",
    path: "/orders",
    roles: ["Admin", "Manager", "Employee"],
    icon: "☷",
  },
  {
    label: "Users",
    path: "/users",
    roles: ["Admin"],
    icon: "♧",
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleLinks = links.filter((link) =>
    link.roles.includes(user?.role)
  );

  const currentPage =
    visibleLinks.find(
      (link) =>
        link.path === location.pathname &&
        link.path === "/"
    ) ||
    visibleLinks.find(
      (link) =>
        link.path !== "/" &&
        location.pathname.startsWith(link.path)
    ) ||
    visibleLinks[0];

  async function handleLogout() {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <div
      className="min-h-screen md:flex"
      style={{
        backgroundColor: "var(--app-bg)",
        color: "var(--text-primary)",
      }}
    >
      {/* Mobile header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between border-b px-4 py-3 md:hidden"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border-color)",
        }}
      >
        <div>
          <p className="text-lg font-bold tracking-tight">
            B2B <span style={{ color: "var(--primary)" }}>Platform</span>
          </p>
          <p className="text-xs app-text-secondary">
            Business Management
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileMenuOpen}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border-color)" }}
        >
          {mobileMenuOpen ? "Close ✕" : "Menu ☰"}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`${
          mobileMenuOpen ? "block" : "hidden"
        } w-full shrink-0 md:sticky md:top-0 md:block md:h-screen md:w-64`}
        style={{
          backgroundColor: "var(--surface)",
          borderRight: "1px solid var(--border-color)",
        }}
      >
        <div
          className="hidden border-b px-6 py-7 md:block"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white shadow-sm">
            B
          </div>

          <h1 className="text-xl font-bold tracking-tight">
            B2B Platform
          </h1>

          <p className="mt-1 text-xs app-text-secondary">
            Business Management
          </p>
        </div>

        <div className="px-4 pb-2 pt-5">
          <p className="px-3 text-xs font-semibold uppercase tracking-widest app-text-secondary">
            Workspace
          </p>
        </div>

        <nav
          className="flex flex-col gap-1 px-3 pb-5"
          aria-label="Main navigation"
        >
          {visibleLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.path === "/"}
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800"
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? undefined
                  : { color: "var(--text-secondary)" }
              }
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg"
                aria-hidden="true"
              >
                {link.icon}
              </span>

              <span className="flex-1">{link.label}</span>

              <span className="text-xs opacity-60" aria-hidden="true">
                ›
              </span>
            </NavLink>
          ))}
        </nav>

        {/* User profile */}
        <div
          className="border-t p-4 md:absolute md:bottom-0 md:left-0 md:right-0"
          style={{
            borderColor: "var(--border-color)",
            backgroundColor: "var(--surface)",
          }}
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              {(user?.first_name || "U").charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {user?.first_name || "User"}{" "}
                {user?.last_name || ""}
              </p>

              <p className="mt-1 truncate text-xs app-text-secondary">
                {user?.role || "Authenticated"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
            style={{ borderColor: "var(--border-color)" }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="min-w-0 flex-1">
        {/* Desktop header */}
        <header
          className="sticky top-0 z-30 hidden h-[76px] items-center justify-between border-b px-6 md:flex lg:px-9"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border-color)",
          }}
        >
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              {currentPage?.label || "Workspace"}
            </h2>
            <p className="mt-1 text-xs app-text-secondary">
              Manage your business in one place
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            <div
              className="hidden h-9 w-px sm:block"
              style={{ backgroundColor: "var(--border-color)" }}
            />

            <div className="text-right">
              <p className="text-sm font-semibold">
                {user?.first_name || "User"}
              </p>
              <p className="text-xs app-text-secondary">
                {user?.role || "Authenticated"}
              </p>
            </div>
          </div>
        </header>

        {/* Mobile controls */}
        <div className="flex justify-end px-4 pt-4 md:hidden">
          <ThemeToggle />
        </div>

        <main className="min-w-0 p-4 sm:p-6 lg:p-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}