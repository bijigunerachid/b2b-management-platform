import { useCallback, useEffect, useState } from "react";
import { language, t } from "../i18n";

const API_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");

export const API_URL = `${API_ORIGIN}/api`;

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

    // Session expired or was revoked: AuthContext signs the user out.
    if (response.status === 401 && !path.startsWith("/auth/")) {
      window.dispatchEvent(new CustomEvent("auth:expired", { detail: result.message }));
    }

    const error = new Error(
      fieldMessage || result.message || t("Request failed ({status}).", { status: response.status })
    );
    error.status = response.status;
    throw error;
  }

  return result;
}

export function toList(result, key) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (key && Array.isArray(result?.[key])) return result[key];
  return [];
}

// `loading` is derived instead of stored so the effect never sets state synchronously.
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
            error: error.message || t("Unable to load data."),
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

// Formatters follow the interface language (see i18n/index.jsx) and are cached per language.
const formatters = new Map();
function formatter(kind, locale, options) {
  const key = `${kind}:${locale}:${JSON.stringify(options)}`;
  if (!formatters.has(key)) {
    formatters.set(key, kind === "relative" ? new Intl.RelativeTimeFormat(locale, options) : new Intl.NumberFormat(locale, options));
  }
  return formatters.get(key);
}

export function money(value) {
  return formatter("number", language().money, { style: "currency", currency: "MAD" }).format(Number(value) || 0);
}

export function compactMoney(value) {
  const amount = formatter("number", language().numbers, { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0);
  return `${amount} ${t("MAD")}`;
}

export function number(value) {
  return formatter("number", language().numbers, {}).format(Number(value) || 0);
}

export function formatDate(value, withTime = false) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString(language().intl, {
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

  const relative = formatter("relative", language().intl, { numeric: "auto" });

  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return relative.format(-Math.round(seconds / size), unit);
    }
  }

  return t("just now");
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

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  // Neutralize spreadsheet formula injection, then quote.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

// columns: [header, (row) => value]
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

// The server sends each user's permissions (backend/src/config/permissions.js).
export function can(user, permission) {
  return Boolean(user?.permissions?.includes(permission));
}

// The API returns at most 100 products per page, so pickers load every page.
export function useActiveProducts(enabled = true) {
  const [state, setState] = useState({ key: null, products: [], error: "" });
  const [version, setVersion] = useState(0);
  const key = enabled ? `active#${version}` : null;

  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;

    (async () => {
      const products = [];
      for (let page = 1; ; page += 1) {
        const result = await api(`/products?status=active&limit=100&sort=name&order=asc&page=${page}`);
        products.push(...toList(result));
        if (page >= (result.pagination?.totalPages ?? 1)) break;
      }
      return products;
    })().then(
      (products) => {
        if (!cancelled) setState({ key, products, error: "" });
      },
      (error) => {
        if (!cancelled) setState((previous) => ({ ...previous, key, error: error.message || t("Unable to load products.") }));
      }
    );

    return () => {
      cancelled = true;
    };
  }, [key]);

  return {
    products: state.products,
    error: state.error,
    loading: Boolean(key) && state.key !== key,
    reload: () => setVersion((value) => value + 1),
  };
}
