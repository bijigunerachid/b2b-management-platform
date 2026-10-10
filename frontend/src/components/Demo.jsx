import { useState } from "react";
import Icon from "./ui/Icon";
import { toneStyle } from "./ui/primitives";
import { useDemo } from "../lib/demo";

import { t } from "../i18n";

// What each demo account shows a visitor. Staff descriptions match the role
// table in backend/src/config/permissions.js.
const ACCOUNT_INFO = {
  admin: { icon: "lock", description: "Everything, including users and the audit log." },
  manager: { icon: "dashboard", description: "Runs sales, catalog, pricing and purchasing. No user management." },
  accountant: { icon: "wallet", description: "Read-only on sales and catalog. Records payments and returns, sees costs, reports and the audit log." },
  warehouse: { icon: "box", description: "Stock, deliveries and order fulfilment. No prices, costs or money." },
  employee: { icon: "eye", description: "Read-only access to sales, catalog and stock." },
  client: { icon: "building", description: "The client portal: order at their prices, download invoices, answer quotes." },
};

/** One-click sign-in buttons for the shared demo accounts (login page). */
export function DemoAccounts({ demo, onSignIn }) {
  const [busy, setBusy] = useState(null);

  async function signIn(account) {
    setBusy(account.key);
    try {
      await onSignIn(account.email, demo.password);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--primary) 35%, var(--border-color))" }} aria-labelledby="demo-heading">
      <h2 id="demo-heading" className="flex items-center gap-2 text-sm font-bold app-text">
        <Icon name="sparkles" size={16} style={{ color: "var(--primary)" }} />
        {t("Try the live demo")}
      </h2>
      <p className="mt-1 text-xs app-text-secondary">
        {t("Sign in with one click as any role. Try anything: the data resets every night at {time}.", { time: demo.reset_time })}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {demo.accounts.map((account) => {
          const info = ACCOUNT_INFO[account.key] ?? { icon: "users", description: "" };
          return (
            <button
              key={account.key}
              type="button"
              onClick={() => signIn(account)}
              disabled={Boolean(busy)}
              title={t(info.description)}
              className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition hover:bg-[var(--surface-hover)] disabled:opacity-60"
              style={{ borderColor: "var(--border-color)" }}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={toneStyle(account.key === "client" ? "success" : "primary")}>
                <Icon name={busy === account.key ? "refresh" : info.icon} size={15} className={busy === account.key ? "animate-spin" : ""} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold app-text">{account.key === "client" ? t("Client portal") : t(account.role)}</span>
                <span className="block truncate text-[11px] app-text-muted">{t(info.description)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** A thin notice at the top of every page while the server is in demo mode. */
export function DemoBanner() {
  const demo = useDemo();
  if (!demo) return null;
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-center text-xs font-medium" style={{ backgroundColor: "var(--primary)", color: "var(--primary-contrast)" }}>
      <Icon name="sparkles" size={13} />
      {t("Live demo: try anything. The data resets every night at {time}; passwords and staff accounts can't be changed.", { time: demo.reset_time })}
    </div>
  );
}
