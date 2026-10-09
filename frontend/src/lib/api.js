import { useCallback, useEffect, useState } from "react";

// Backend origin, set per environment in frontend/.env (see .env.example).
const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

export const API_URL = `${API_ORIGIN}/api`;

/**
 * Fetch wrapper for the backend: sends the auth cookie, encodes JSON, and
 * throws an Error carrying the server's most specific message.
 */
export async function api(path, { body, ...options } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    const fieldMessage = Array.isArray(result.errors)
      ? result.errors.map((error) => error.message).join(" ")
      : "";

    // A 401 on any protected call means the session ended (expired,
    // revoked, or deactivated): let AuthContext sign the user out.
    if (response.status === 401 && !path.startsWith("/auth/")) {
      window.dispatchEvent(new CustomEvent("auth:expired", { detail: result.message }));
    }

    const error = new Error(
      fieldMessage || result.message || `Request failed (${response.status}).`
    );
    error.status = response.status;
    throw error;
  }

  return result;
}

/** Normalizes the different list shapes the API returns into an array. */
export function toList(result, key) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (key && Array.isArray(result?.[key])) return result[key];
  return [];
}

/**
 * Loads `path` and reloads whenever it changes or `reload()` is called.
 * `loading` is derived from whether the latest request has settled, so no
 * state is set synchronously inside the effect.
 */
export function useResource(path) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({
    key: null,
    data: null,
    error: "",
  });

  const key = path ? `${path}#${version}` : null;

  useEffect(() => {
    if (!key) return undefined;

    let cancelled = false;

    api(path).then(
      (data) => {
        if (!cancelled) setState({ key, data, error: "" });
      },
      (error) => {
        if (!cancelled) {
          setState((previous) => ({
            key,
            data: previous.data,
            error: error.message || "Unable to load data.",
          }));
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [key, path]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  return {
    data: state.data,
    error: state.error,
    loading: Boolean(key) && state.key !== key,
    reload,
  };
}

/* ---------- Formatting ---------- */

const moneyFormatter = new Intl.NumberFormat("fr-MA", {
  style: "currency",
  currency: "MAD",
});

const compactMoneyFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function money(value) {
  return moneyFormatter.format(Number(value) || 0);
}

export function compactMoney(value) {
  return `${compactMoneyFormatter.format(Number(value) || 0)} MAD`;
}

export function number(value) {
  return new Intl.NumberFormat("en").format(Number(value) || 0);
}

export function formatDate(value, withTime = false) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  });
}

export function timeAgo(value) {
  const date = new Date(value);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);

  if (Number.isNaN(seconds)) return "";

  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return formatter.format(-Math.round(seconds / size), unit);
    }
  }

  return "just now";
}

export function initials(...parts) {
  return (
    parts
      .filter(Boolean)
      .map((part) => String(part).trim().charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function isActiveFlag(value) {
  return value === true || value === 1 || value === "1";
}

/* ---------- CSV export ---------- */

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  // Neutralize spreadsheet formula injection, then quote.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

/**
 * Downloads `rows` as a CSV file.
 * `columns` is a list of [header, (row) => value] pairs.
 */
export function exportCsv(filename, columns, rows) {
  const lines = [
    columns.map(([header]) => csvCell(header)).join(","),
    ...rows.map((row) =>
      columns.map(([, getValue]) => csvCell(getValue(row))).join(",")
    ),
  ];

  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/* ---------- Permissions (mirror the backend route guards) ---------- */

const permissions = {
  "customers.write": ["Admin", "Manager"],
  "customers.delete": ["Admin"],
  "products.write": ["Admin", "Manager"],
  "products.delete": ["Admin"],
  "categories.write": ["Admin", "Manager"],
  "categories.delete": ["Admin"],
  "orders.write": ["Admin", "Manager"],
  "payments.write": ["Admin", "Manager"],
  "payments.void": ["Admin"],
  "users.manage": ["Admin"],
};

export function can(user, permission) {
  return Boolean(user && permissions[permission]?.includes(user.role));
}
