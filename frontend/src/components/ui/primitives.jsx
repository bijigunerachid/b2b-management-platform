/* eslint-disable react-refresh/only-export-components */
import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon";
import Button from "./Button";

import { t } from "../../i18n";
export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight app-text">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm app-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className = "", children, ...props }) {
  return (
    <section className={`app-surface overflow-hidden ${className}`} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, actions, children }) {
  return (
    <div
      className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: "var(--border-color)" }}
    >
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-bold app-text">{title}</h2>
        {description && <p className="mt-0.5 text-sm app-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      {children}
    </div>
  );
}

const tones = {
  primary: ["var(--primary-soft)", "var(--primary)"],
  success: ["var(--success-soft)", "var(--success)"],
  warning: ["var(--warning-soft)", "var(--warning)"],
  danger: ["var(--danger-soft)", "var(--danger)"],
  info: ["var(--info-soft)", "var(--info)"],
  neutral: ["var(--surface-muted)", "var(--text-secondary)"],
};

export function toneStyle(tone) {
  const [backgroundColor, color] = tones[tone] ?? tones.neutral;
  return { backgroundColor, color };
}

// Amounts are formatted with a no-break space before the currency, so a long
// one in a narrow card would be split mid-word ("8.031,74 M / AD"). Let it wrap
// between the number and the currency instead.
function wrapBeforeCurrency(value) {
  return typeof value === "string" ? value.replace(/[\u00a0\u202f](?=[^\d]*$)/, " ") : value;
}

export function StatCard({ label, value, hint, icon, tone = "primary", loading = false, onClick }) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`app-surface flex w-full flex-col p-5 text-start transition-colors ${onClick ? "hover:border-[var(--border-strong)]" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium app-text-secondary">{label}</p>
          {loading ? (
            <div className="skeleton mt-3 h-8 w-20" />
          ) : (
            <p className="mt-2 break-words text-2xl font-bold leading-tight tracking-tight tabular-nums app-text">{wrapBeforeCurrency(value)}</p>
          )}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={toneStyle(tone)}>
          <Icon name={icon} size={18} />
        </div>
      </div>
      {hint && <p className="mt-3 text-xs app-text-secondary">{hint}</p>}
    </Component>
  );
}

export function Badge({ tone = "neutral", dot = false, icon, children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
      style={toneStyle(tone)}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {icon && <Icon name={icon} size={13} strokeWidth={2.2} />}
      {typeof children === "string" ? t(children) : children}
    </span>
  );
}

const avatarPalette = ["primary", "success", "warning", "info", "danger"];

export function Avatar({ label, seed, size = 40, rounded = "rounded-xl" }) {
  const index = Math.abs(Number(seed) || String(label).length) % avatarPalette.length;

  return (
    <div
      className={`flex shrink-0 items-center justify-center text-sm font-bold ${rounded}`}
      style={{ width: size, height: size, ...toneStyle(avatarPalette[index]) }}
      aria-hidden="true"
    >
      {label}
    </div>
  );
}

export function DetailItem({ icon, label, children }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3.5" style={{ borderColor: "var(--border-color)" }}>
      {icon && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg app-muted app-text-secondary">
          <Icon name={icon} size={16} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide app-text-muted">{label}</p>
        <div className="mt-0.5 break-words text-sm font-semibold app-text">{children || "—"}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon = "search", title, description, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl app-muted app-text-secondary">
        <Icon name={icon} size={22} />
      </div>
      <h3 className="text-sm font-semibold app-text">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm app-text-secondary">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
      style={{ ...toneStyle("danger"), borderColor: "color-mix(in srgb, var(--danger) 30%, transparent)" }}
    >
      <div className="flex items-start gap-3">
        <Icon name="alertCircle" size={20} className="mt-0.5" />
        <div>
          <p className="text-sm font-semibold">{t("Something went wrong")}</p>
          <p className="mt-0.5 text-sm opacity-90">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button size="sm" variant="secondary" icon="refresh" onClick={onRetry}>
          {t("Try again")}
        </Button>
      )}
    </div>
  );
}

export function InlineAlert({ tone = "danger", children }) {
  if (!children) return null;

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className="mb-5 flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm animate-fade-in"
      style={{ ...toneStyle(tone), borderColor: "color-mix(in srgb, currentColor 25%, transparent)" }}
    >
      <Icon name={tone === "danger" ? "alertCircle" : "info"} size={18} className="mt-px" />
      <div>{children}</div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div className="divide-y" style={{ borderColor: "var(--border-color)" }} aria-label={t("Loading")} aria-busy="true">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4 px-5 py-4" style={{ borderColor: "var(--border-color)" }}>
          <div className="skeleton h-10 w-10 rounded-xl" />
          {Array.from({ length: columns - 1 }, (_, column) => (
            <div key={column} className="skeleton h-4 flex-1" style={{ maxWidth: column === 0 ? 200 : 120 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Field({ label, required, hint, error, children, className = "" }) {
  const id = useId();

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1 text-sm font-medium app-text">
        {label}
        {required && <span style={{ color: "var(--danger)" }}>*</span>}
      </label>
      {typeof children === "function" ? children(id) : children}
      {(error || hint) && (
        <p className="mt-1.5 text-xs" style={{ color: error ? "var(--danger)" : "var(--text-muted)" }}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder, className = "", ...props }) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <Icon name="search" size={17} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 app-text-muted" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? t("Search...")}
        aria-label={placeholder ?? t("Search...")}
        className="app-input h-10 py-0 ps-9 pe-9 [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("Clear search")}
          className="absolute end-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md transition hover:bg-[var(--surface-hover)] app-text-muted"
        >
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}

export function SegmentedControl({ options, value, onChange, label, className = "" }) {
  return (
    <div role="tablist" aria-label={label} className={`flex max-w-full gap-1 overflow-x-auto rounded-xl p-1 app-muted ${className}`}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active ? "shadow-sm app-text" : "app-text-secondary hover:text-[var(--text-primary)]"
            }`}
            style={active ? { backgroundColor: "var(--surface)" } : undefined}
          >
            {typeof option.label === "string" ? t(option.label) : option.label}
            {option.count !== undefined && (
              <span
                className="rounded-full px-1.5 text-[11px] font-semibold"
                style={active ? toneStyle("primary") : { backgroundColor: "var(--surface-hover)" }}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SortHeader({ label, column, sort, onSort, align = "left", className = "" }) {
  const active = sort.key === column;
  const icon = active ? (sort.direction === "asc" ? "sortUp" : "sortDown") : "sort";

  return (
    <th
      scope="col"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide ${align === "right" ? "text-end" : ""} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-[var(--text-primary)] ${
          active ? "app-text" : ""
        }`}
      >
        {label}
        <Icon name={icon} size={14} strokeWidth={2} className={active ? "" : "opacity-40"} />
      </button>
    </th>
  );
}

export function Th({ children, align = "left", className = "" }) {
  return (
    <th
      scope="col"
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide ${align === "right" ? "text-end" : ""} ${className}`}
    >
      {children}
    </th>
  );
}

export function TableHead({ children }) {
  return (
    <thead className="app-text-secondary" style={{ backgroundColor: "var(--surface-muted)" }}>
      <tr>{children}</tr>
    </thead>
  );
}

export function Pagination({ page, totalPages, total, pageSize, onPageChange, label }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages = [];
  for (let current = 1; current <= totalPages; current += 1) {
    if (current === 1 || current === totalPages || Math.abs(current - page) <= 1) {
      pages.push(current);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div
      className="flex flex-col gap-3 border-t px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: "var(--border-color)" }}
    >
      <p className="text-sm app-text-secondary">
        {t("Showing {from}–{to} of {total} {label}", { from, to, total, label: label ?? t("items") })}
      </p>

      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label={t("Pagination")}>
          <Button size="icon-sm" variant="ghost" icon="chevronLeft" aria-label={t("Previous page")} disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
          {pages.map((item, index) =>
            item === "..." ? (
              <span key={`gap-${index}`} className="px-1 text-sm app-text-muted">
                ...
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === page ? "page" : undefined}
                className={`h-8 min-w-8 rounded-lg px-2 text-sm font-semibold transition ${
                  item === page ? "" : "app-text-secondary hover:bg-[var(--surface-hover)]"
                }`}
                style={item === page ? toneStyle("primary") : undefined}
              >
                {item}
              </button>
            )
          )}
          <Button size="icon-sm" variant="ghost" icon="chevronRight" aria-label={t("Next page")} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} />
        </nav>
      )}
    </div>
  );
}

export function IconAction({ icon, label, tone, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-40 ${
        tone === "danger"
          ? "text-[var(--text-secondary)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      }`}
    >
      <Icon name={icon} size={17} />
    </button>
  );
}

export function Popover({ trigger, children, align = "right", width = 320, label }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;

    function handlePointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }

    function handleKey(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="relative">
      {trigger({
        open,
        props: {
          "aria-expanded": open,
          "aria-controls": panelId,
          "aria-haspopup": "dialog",
          onClick: () => setOpen((value) => !value),
        },
      })}

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          className={`absolute top-full z-50 mt-2 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border animate-pop-in ${
            align === "right" ? "end-0 origin-top-right" : "start-0 origin-top-left"
          }`}
          style={{
            width,
            backgroundColor: "var(--surface)",
            borderColor: "var(--border-color)",
            boxShadow: "var(--pop-shadow)",
          }}
        >
          {typeof children === "function" ? children({ close }) : children}
        </div>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled, size = "md" }) {
  const small = size === "sm";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50 ${
        small ? "h-5 w-9" : "h-6 w-11"
      }`}
      style={{ backgroundColor: checked ? "var(--success)" : "var(--border-strong)" }}
    >
      <span
        className={`inline-block rounded-full bg-white shadow-sm transition-transform duration-200 ${
          small ? "h-4 w-4" : "h-5 w-5"
        }`}
        style={{ transform: `translateX(calc(var(--dir, 1) * ${checked ? (small ? 18 : 22) : 2}px))` }}
      />
    </button>
  );
}
