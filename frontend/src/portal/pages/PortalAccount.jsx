import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/ui/Button";
import { useToast } from "../../components/ui/feedback";
import { Card, CardHeader, DetailItem, Field, InlineAlert, PageHeader } from "../../components/ui/primitives";
import { api, useResource } from "../../lib/api";
import company from "../../config/company";

// Mirrors checkPasswordPolicy in backend/src/config/security.js.
function passwordProblem(password) {
  if (password.length < 10) return "Use at least 10 characters.";
  if (new TextEncoder().encode(password).length > 72) return "Use at most 72 bytes.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Include at least one letter and one number.";
  return null;
}

export default function PortalAccount() {
  const { user } = useAuth();
  const toast = useToast();
  const { data } = useResource("/portal/summary");
  const customer = data?.data?.customer;
  const [form, setForm] = useState({ current: "", next: "", repeat: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const problem = passwordProblem(form.next);
    if (problem) return setError(problem);
    if (form.next !== form.repeat) return setError("The new passwords don't match.");

    setSaving(true);
    try {
      const result = await api("/auth/password", { method: "POST", body: { current_password: form.current, new_password: form.next } });
      toast.success(result.message, { title: "Password updated" });
      setForm({ current: "", next: "", repeat: "" });
    } catch (err) {
      setError(err.message || "Could not change your password.");
    } finally {
      setSaving(false);
    }
  }

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="Your account" description="Your details and sign-in settings." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Company" description={`To update these details, contact us at ${company.email}.`} />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <DetailItem icon="building" label="Company">{customer?.company_name}</DetailItem>
            <DetailItem icon="users" label="Contact">{customer?.contact_name}</DetailItem>
            <DetailItem icon="mail" label="Email">{customer?.email}</DetailItem>
            <DetailItem icon="phone" label="Phone">{customer?.phone}</DetailItem>
            <div className="sm:col-span-2">
              <DetailItem icon="mapPin" label="Address">{[customer?.address, customer?.city, customer?.country].filter(Boolean).join(", ")}</DetailItem>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Sign-in" description={`Signed in as ${user?.email}`} />
          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            <InlineAlert>{error}</InlineAlert>
            <Field label="Current password" required>
              {(id) => <input id={id} type="password" value={form.current} onChange={update("current")} autoComplete="current-password" required className="app-input" />}
            </Field>
            <Field label="New password" required hint="At least 10 characters with a letter and a number.">
              {(id) => <input id={id} type="password" value={form.next} onChange={update("next")} autoComplete="new-password" minLength={10} required className="app-input" />}
            </Field>
            <Field label="Repeat new password" required>
              {(id) => <input id={id} type="password" value={form.repeat} onChange={update("repeat")} autoComplete="new-password" required className="app-input" />}
            </Field>
            <p className="text-xs app-text-muted">Changing your password signs you out on other devices.</p>
            <Button type="submit" variant="primary" icon="lock" loading={saving}>
              Change password
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
