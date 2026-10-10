import { useState } from "react";
import Button from "./ui/Button";
import Icon from "./ui/Icon";
import { Modal } from "./ui/Modal";
import { useConfirm, useToast } from "./ui/feedback";
import { Field, InlineAlert, Switch, toneStyle } from "./ui/primitives";
import { api, formatDate, useResource } from "../lib/api";

import { t } from "../i18n";
export default function PortalAccessPanel({ customer, canManage }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [version, setVersion] = useState(0);
  const { data, loading } = useResource(customer ? `/customers/${customer.id}/portal-users?v=${version}` : null);
  const users = data?.data ?? [];

  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  function openInvite() {
    const [first = "", ...rest] = (customer.contact_name ?? "").split(" ");
    setForm({ first_name: first, last_name: rest.join(" "), email: customer.email ?? "" });
    setError("");
    setInviting(true);
  }

  async function invite(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const result = await api(`/customers/${customer.id}/portal-users`, {
        method: "POST",
        body: { first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim() },
      });
      setInviting(false);
      setCreated(result.data);
      setVersion((value) => value + 1);
    } catch (err) {
      setError(err.message || t("Could not create portal access."));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(user, active) {
    if (!active) {
      const confirmed = await confirm({
        title: t("Disable portal access for {name}?", { name: user.first_name }),
        message: t("They're signed out immediately and can't sign in until access is enabled again."),
        confirmLabel: t("Disable access"),
      });
      if (!confirmed) return;
    }
    try {
      await api(`/portal-users/${user.id}/status`, { method: "PATCH", body: { is_active: active } });
      toast.success(active ? t("Portal access enabled for {email}.", { email: user.email }) : t("Portal access disabled for {email}.", { email: user.email }));
      setVersion((value) => value + 1);
    } catch (err) {
      toast.error(err.message || t("Could not update portal access."));
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast.info(t("Copied to the clipboard."));
    } catch {
      toast.warning(t("Copy failed. Select the text and copy it manually."));
    }
  }

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold app-text">{t("Portal access")}</h3>
        {canManage && (
          <Button size="sm" icon="userPlus" onClick={openInvite}>
            {t("Invite contact")}
          </Button>
        )}
      </div>

      {loading && !data ? (
        <div className="skeleton h-14 rounded-xl" />
      ) : users.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-4 text-sm app-text-secondary" style={{ borderColor: "var(--border-strong)" }}>
          {t("No one at {company} can sign in yet. Invite a contact to let them order, pay invoices, and accept quotes online.", { company: customer.company_name })}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
          {users.map((user) => (
            <li key={user.id} className="flex items-center gap-3 px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={toneStyle(user.is_active ? "success" : "neutral")}>
                <Icon name="users" size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${user.is_active ? "app-text" : "app-text-muted line-through"}`}>
                  {user.first_name} {user.last_name}
                </p>
                <p className="truncate text-xs app-text-muted">
                  {user.email} · since {formatDate(user.created_at)}
                </p>
              </div>
              {canManage && <Switch size="sm" checked={Boolean(user.is_active)} onChange={(next) => toggle(user, next)} label={user.is_active ? t("Disable {email}", { email: user.email }) : t("Enable {email}", { email: user.email })} />}
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={inviting}
        onClose={() => !saving && setInviting(false)}
        busy={saving}
        size="sm"
        icon="userPlus"
        eyebrow={customer?.company_name}
        title={t("Invite to the client portal")}
        footer={
          <>
            <Button onClick={() => setInviting(false)} disabled={saving}>
              {t("Cancel")}
            </Button>
            <Button type="submit" form="invite-form" variant="primary" icon="check" loading={saving}>
              {t("Create access")}
            </Button>
          </>
        }
      >
        <form id="invite-form" onSubmit={invite} className="space-y-4">
          <InlineAlert>{error}</InlineAlert>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("First name")} required>
              {(id) => <input id={id} value={form.first_name} onChange={update("first_name")} required maxLength={100} className="app-input" />}
            </Field>
            <Field label={t("Last name")} required>
              {(id) => <input id={id} value={form.last_name} onChange={update("last_name")} required maxLength={100} className="app-input" />}
            </Field>
          </div>
          <Field label={t("Email (their login)")} required>
            {(id) => <input id={id} type="email" value={form.email} onChange={update("email")} required maxLength={255} className="app-input" />}
          </Field>
        </form>
      </Modal>

      <Modal
        open={Boolean(created)}
        onClose={() => setCreated(null)}
        size="sm"
        icon="lock"
        iconTone="success"
        title={t("Portal access created")}
        description={t("The password is only shown once.")}
        footer={
          <Button variant="primary" onClick={() => setCreated(null)}>
            {t("Done")}
          </Button>
        }
      >
        {created && (
          <div className="space-y-3">
            {[
              [t("Email"), created.email],
              [t("Temporary password"), created.temporary_password],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center gap-2 rounded-xl border p-3" style={{ borderColor: "var(--border-color)" }}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide app-text-muted">{label}</p>
                  <p className="truncate font-mono text-sm font-semibold app-text">{value}</p>
                </div>
                <Button size="icon-sm" icon="copy" aria-label={t("Copy {what}", { what: label.toLowerCase() })} onClick={() => copy(value)} />
              </div>
            ))}
            <InlineAlert tone="warning">{t("Ask them to change it from Account → Sign-in after their first login.")}</InlineAlert>
          </div>
        )}
      </Modal>
    </section>
  );
}
