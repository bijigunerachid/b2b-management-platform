import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6" style={{ backgroundColor: "var(--app-bg)" }}>
      <div className="max-w-sm text-center">
        <p className="text-sm font-semibold app-text-secondary">404</p>
        <h1 className="mt-2 text-2xl font-bold app-text">Page not found</h1>
        <p className="mt-2 text-sm app-text-secondary">This page doesn&apos;t exist or was moved.</p>
        <Link
          to="/"
          className="mt-6 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-contrast)" }}
        >
          Go to the dashboard
        </Link>
      </div>
    </main>
  );
}
