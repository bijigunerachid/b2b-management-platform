import { Spinner } from "./ui/Button";

/** Shown while a lazily loaded page downloads. */
export function PageFallback({ fullScreen = false }) {
  if (fullScreen) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--app-bg)" }}>
        <span className="app-text-secondary">
          <Spinner size={22} />
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <div className="skeleton h-14 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="skeleton h-32 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-80 rounded-2xl" />
    </div>
  );
}
