import { Link } from "react-router-dom";
import Icon from "../components/ui/Icon";

export default function NotFound() {
  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6"
      style={{ backgroundColor: "var(--app-bg)" }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--primary-soft) 0%, transparent 70%)" }}
      />
      <div className="relative max-w-md text-center animate-rise">
        <p
          className="bg-clip-text text-[120px] font-extrabold leading-none tracking-tighter text-transparent sm:text-[160px]"
          style={{ backgroundImage: "linear-gradient(135deg, var(--primary), var(--accent))" }}
        >
          404
        </p>
        <h1 className="mt-2 text-2xl font-bold app-text">Page not found</h1>
        <p className="mt-2 text-sm app-text-secondary">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-contrast)" }}
        >
          <Icon name="dashboard" size={17} />
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
