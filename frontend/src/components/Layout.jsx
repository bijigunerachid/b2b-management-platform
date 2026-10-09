
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle";
const links = [
    {
        label: "Dashboard",
        path: "/",
        roles: ["Admin", "Manager", "Employee"],
    },
    {
        label: "Customers",
        path: "/customers",
        roles: ["Admin", "Manager", "Employee"],
    },
    {
        label: "Products",
        path: "/products",
        roles: ["Admin", "Manager", "Employee"],
    },
    {
        label: "Categories",
        path: "/categories",
        roles: ["Admin", "Manager", "Employee"],
    },
    {
        label: "Orders",
        path: "/orders",
        roles: ["Admin", "Manager", "Employee"],
    },
    {
        label: "Users",
        path: "/users",
        roles: ["Admin"],
    },
];

export default function Layout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const visibleLinks = links.filter((link) =>
        link.roles.includes(user?.role)
    );

    async function handleLogout() {
        try {
            await logout();
            navigate("/login", { replace: true });
        } catch (error) {
            console.error("Logout failed:", error);
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 md:flex">
            <aside className="bg-slate-900 text-white md:min-h-screen md:w-64">
                <div className="border-b border-slate-700 p-6">
                    <h2 className="text-xl font-bold">
                        B2B Platform
                    </h2>

                    <p className="mt-1 text-xs text-slate-400">
                        Business Management
                    </p>
                </div>

                <nav className="flex gap-2 overflow-x-auto p-3 md:flex-col">
                    {visibleLinks.map((link) => (
                        <NavLink
                            key={link.path}
                            to={link.path}
                            end={link.path === "/"}
                            className={({ isActive }) =>
                                `whitespace-nowrap rounded-lg px-4 py-3 text-sm transition ${
                                    isActive
                                        ? "bg-blue-600 text-white"
                                        : "text-slate-300 hover:bg-slate-800"
                                }`
                            }
                        >
                            {link.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="border-t border-slate-700 p-4 md:mt-8">
                    <p className="truncate text-sm font-medium">
                        {user?.first_name || "User"}{" "}
                        {user?.last_name || ""}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                        {user?.role || "Authenticated"}
                    </p>

                    <button
                        onClick={handleLogout}
                        className="mt-4 w-full rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
                    >
                        Sign out
                    </button>
                </div>
            </aside>

            <main className="min-w-0 flex-1 p-5 md:p-8">
                <Outlet />
            </main>
        </div>
    );
}