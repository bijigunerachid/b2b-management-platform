import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Icon from "./ui/Icon";
import { Spinner } from "./ui/Button";
import { EmptyState } from "./ui/primitives";
import { can } from "../lib/api";

// With children it guards just that page; without, it guards the nested routes.
export default function ProtectedRoute({ permission, area = "staff", children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4" style={{ backgroundColor: "var(--app-bg)" }}>
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg animate-pop-in"
          style={{ backgroundColor: "var(--primary)" }}
        >
          <Icon name="box" size={28} strokeWidth={2} />
        </div>
        <div className="flex items-center gap-2 text-sm font-medium app-text-secondary">
          <Spinner size={15} />
          Checking your session...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  const isClient = user.role === "Customer";
  if (area === "staff" && isClient) return <Navigate to="/portal" replace />;
  if (area === "portal" && !isClient) return <Navigate to="/" replace />;

  if (permission && !can(user, permission)) {
    return (
      <EmptyState
        icon="lock"
        title="You don't have access to this page"
        description={`Your role (${user.role}) can't open it. Ask an administrator if you need access.`}
      />
    );
  }

  return children ?? <Outlet />;
}
