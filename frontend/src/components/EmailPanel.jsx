import { useState } from "react";
import Button from "./ui/Button";
import Icon from "./ui/Icon";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/feedback";
import { Badge, Field, InlineAlert } from "./ui/primitives";
import { api, formatDate, useResource } from "../lib/api";
import { EMAIL_STATUS, EMAIL_TYPES } from "../lib/emails";

import { t } from "../i18n";

const LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية" },
  { value: "en", label: "English" },
];

/** One email as the client received it, in a sandboxed frame (no scripts, no access to the app). */
export function EmailPreviewModal({ emailId, onClose }) {
  const { data, loading, error } = useResource(emailId ? `/emails/${emailId}` : null);
  const email = data?.data;
  const status = EMAIL_STATUS[email?.status];

  return (
    <Modal open={Boolean(emailId)} onClose={onClose} size="lg" icon="mail" title={email?.subject ?? t("Email")} description={email ? `${t("To {email}", { email: email.recipient })} · ${formatDate(email.created_at, true)}` : ""}>
      {error ? (
        <InlineAlert>{error}</InlineAlert>
      ) : loading && !email ? (
        <div className="skeleton h-96 rounded-xl" />
      ) : (
        email && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs app-text-secondary">
              <Badge tone={status?.tone} icon={status?.icon}>
                {t(status?.label ?? email.status)}
              </Badge>
              {email.sent_by_name ? <span>{t("Sent by {name}", { name: email.sent_by_name })}</span> : <span>{t("Sent automatically")}</span>}
            </div>
            {email.error && <InlineAlert>{email.error}</InlineAlert>}
            {email.status === "outbox" && <p className="text-xs app-text-muted">{t("Not sent: no mail server is set up, so the email was saved here instead.")}</p>}
            <iframe title={email.subject} sandbox="" srcDoc={email.html} className="h-[60vh] w-full rounded-xl border bg-white" style={{ borderColor: "var(--border-color)" }} />
          </div>
        )
      )}
    </Modal>
  );
}

/** The "send by email" form for an invoice or a quote. */
function SendEmailModal({ open, onClose, kind, endpoint, customerId, onSent }) {
  const toast = useToast();
  const customer = useResource(open && customerId ? `/customers/${customerId}` : null).data?.data;
  const settings = useResource(open ? "/emails/settings" : null).data?.data;
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  // Fill the form from the customer once it has loaded.
  const [preparedFor, setPreparedFor] = useState(null);
  if (open && customer && preparedFor !== customer.id) {
    setPreparedFor(customer.id);
    setForm({ to: customer.email ?? "", language: customer.email_language ?? "fr", message: "" });
    setError("");
  }
  if (!open && preparedFor !== null) setPreparedFor(null);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSending(true);
    try {
      const result = await api(endpoint, { method: "POST", body: { to: form.to.trim(), language: form.language, message: form.message } });
      toast.success(result.message, { title: result.data?.status === "outbox" ? t("Saved to the outbox") : t("Email sent") });
      onSent?.();
      onClose();
    } catch (err) {
      setError(err.message || t("The email couldn't be sent."));
    } finally {
      setSending(false);
    }
  }

  const title = kind === "quote" ? t("Email the quote") : t("Email the invoice");
  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={sending}
      size="md"
      icon="mail"
      title={title}
      description={customer?.company_name ?? ""}
      footer={
        <>
          <Button onClick={onClose} disabled={sending}>
            {t("Cancel")}
          </Button>
          <Button type="submit" form="send-email-form" variant="primary" icon="send" loading={sending} disabled={!form?.to?.trim()}>
            {t("Send")}
          </Button>
        </>
      }
    >
      {!form ? (
        <div className="skeleton h-48 rounded-xl" />
      ) : (
        <form id="send-email-form" onSubmit={submit} className="space-y-4">
          <InlineAlert>{error}</InlineAlert>
          {settings?.mode === "outbox" && (
            <InlineAlert tone="info">{t("No mail server is set up, so the email will be saved to the outbox instead of being sent. You can read it under Emails.")}</InlineAlert>
          )}
          {kind === "quote" && <p className="text-xs app-text-muted">{t("A draft quote is marked as sent once it's emailed.")}</p>}
          <Field label={t("To")} required hint={customer && !customer.email ? t("This customer has no email address yet.") : undefined}>
            {(id) => <input id={id} type="email" value={form.to} onChange={(event) => setForm((f) => ({ ...f, to: event.target.value }))} className="app-input" data-autofocus />}
          </Field>
          <Field label={t("Language")} hint={t("Defaults to the customer's email language")}>
            {(id) => (
              <select id={id} value={form.language} onChange={(event) => setForm((f) => ({ ...f, language: event.target.value }))} className="app-input">
                {LANGUAGES.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("Message")} hint={t("Optional, shown above the document")}>
            {(id) => <textarea id={id} rows={3} maxLength={1000} value={form.message} onChange={(event) => setForm((f) => ({ ...f, message: event.target.value }))} className="app-input resize-y" />}
          </Field>
        </form>
      )}
    </Modal>
  );
}

/**
 * Emails about one invoice or quote: who it was sent to and when, plus the
 * button to send it. `kind` is "invoice" or "quote".
 */
export default function EmailPanel({ kind, documentId, customerId, canSend, canView, disabled = false, disabledReason = "", onSent }) {
  const [version, setVersion] = useState(0);
  const [sending, setSending] = useState(false);
  const [previewId, setPreviewId] = useState(null);
  const query = kind === "quote" ? `quote_id=${documentId}` : `order_id=${documentId}`;
  const { data } = useResource(canView ? `/emails?${query}&v=${version}` : null);
  const emails = data?.data ?? [];

  if (!canView && !canSend) return null;

  return (
    <section aria-labelledby={`emails-${kind}-${documentId}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 id={`emails-${kind}-${documentId}`} className="text-sm font-bold app-text">
          {t("Emails")}
        </h3>
        {canSend && (
          <Button size="sm" icon="mail" onClick={() => setSending(true)} disabled={disabled} title={disabled ? disabledReason : undefined}>
            {kind === "quote" ? t("Email to client") : t("Email invoice")}
          </Button>
        )}
      </div>
      {emails.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-center text-xs app-text-secondary" style={{ borderColor: "var(--border-strong)" }}>
          {kind === "quote" ? t("This quote hasn't been emailed yet.") : t("No emails about this invoice yet.")}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
          {emails.map((email) => {
            const status = EMAIL_STATUS[email.status];
            return (
              <li key={email.id} style={{ borderColor: "var(--border-color)" }}>
                <button type="button" onClick={() => setPreviewId(email.id)} className="flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-[var(--surface-hover)]">
                  <Icon name="mail" size={16} className="app-text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium app-text">{t(EMAIL_TYPES[email.type])} · {email.recipient}</span>
                    <span className="block text-xs app-text-muted">
                      {formatDate(email.created_at, true)}
                      {email.sent_by_name ? ` · ${email.sent_by_name}` : ` · ${t("automatic")}`}
                    </span>
                  </span>
                  <Badge tone={status?.tone}>{t(status?.label ?? email.status)}</Badge>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <SendEmailModal
        open={sending}
        onClose={() => setSending(false)}
        kind={kind}
        endpoint={kind === "quote" ? `/quotes/${documentId}/email` : `/orders/${documentId}/email`}
        customerId={customerId}
        onSent={() => {
          setVersion((value) => value + 1);
          onSent?.();
        }}
      />
      <EmailPreviewModal emailId={previewId} onClose={() => setPreviewId(null)} />
    </section>
  );
}
