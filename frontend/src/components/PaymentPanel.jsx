import { useState } from "react";
import Button from "./ui/Button";
import Icon from "./ui/Icon";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/feedback";
import { Badge, Field, IconAction, InlineAlert, toneStyle } from "./ui/primitives";
import { api, formatDate, money, useResource } from "../lib/api";
import { PAYMENT_METHODS, localDateInput, paymentBadge } from "../lib/billing";

const methodIcons = {
  "Bank transfer": "building",
  Cheque: "receipt",
  Cash: "wallet",
  Card: "lock",
};

/* ---------- Record payment ---------- */

export function RecordPaymentModal({ open, onClose, order, billing, onRecorded }) {
  const toast = useToast();
  const [form, setForm] = useState({ amount: "", method: "Bank transfer", paid_at: localDateInput(), reference: "", note: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Prefill the full balance each time the dialog opens for an order.
  const [preparedFor, setPreparedFor] = useState(null);
  const prepareKey = open ? `${order?.id}:${billing?.balance}` : null;
  if (prepareKey && prepareKey !== preparedFor) {
    setPreparedFor(prepareKey);
    setForm({ amount: String(billing?.balance ?? ""), method: "Bank transfer", paid_at: localDateInput(), reference: "", note: "" });
    setError("");
  }
  if (!open && preparedFor !== null) setPreparedFor(null);

  const amount = Number(form.amount);
  const remaining = billing ? Math.max(0, Math.round((billing.balance - (Number.isFinite(amount) ? amount : 0)) * 100) / 100) : 0;
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!Number.isFinite(amount) || amount <= 0) return setError("Enter an amount greater than zero.");
    if (amount > billing.balance + 0.005) return setError(`The balance due is ${money(billing.balance)}.`);

    setSaving(true);
    try {
      const result = await api(`/orders/${order.id}/payments`, {
        method: "POST",
        body: {
          amount: Math.round(amount * 100) / 100,
          method: form.method,
          paid_at: form.paid_at,
          reference: form.reference.trim(),
          note: form.note.trim(),
        },
      });
      const status = result.data?.billing?.payment_status;
      toast.success(
        status === "Paid" ? `Order #${order.id} is now paid in full.` : `${money(amount)} recorded. ${money(result.data?.billing?.balance)} still due.`,
        { title: "Payment recorded" }
      );
      onRecorded();
      onClose();
    } catch (err) {
      setError(err.message || "Could not record the payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={saving}
      icon="wallet"
      iconTone="success"
      eyebrow={order ? `Order #${order.id}` : "Payment"}
      title="Record a payment"
      description={order?.company_name}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" variant="primary" loading={saving} icon="check">
            Record {Number.isFinite(amount) && amount > 0 ? money(amount) : "payment"}
          </Button>
        </>
      }
    >
      {billing && (
        <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
          <InlineAlert>{error}</InlineAlert>

          <div className="grid grid-cols-3 gap-2 rounded-xl p-3 text-center app-muted">
            {[
              ["Invoice total", billing.total_due],
              ["Already paid", billing.amount_paid],
              ["Balance due", billing.balance],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[11px] font-medium uppercase tracking-wide app-text-muted">{label}</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums app-text">{money(value)}</p>
              </div>
            ))}
          </div>

          <Field label="Amount" required hint={remaining > 0 ? `${money(remaining)} will remain due.` : "This settles the invoice in full."}>
            {(id) => (
              <>
                <div className="relative">
                  <input
                    id={id}
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={billing.balance}
                    value={form.amount}
                    onChange={update("amount")}
                    required
                    className="app-input pr-14 text-base font-semibold tabular-nums"
                    data-autofocus
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold app-text-muted">MAD</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[0.25, 0.5, 1].map((share) => (
                    <button
                      key={share}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, amount: String(Math.round(billing.balance * share * 100) / 100) }))}
                      className="rounded-lg border px-2.5 py-1 text-xs font-semibold transition hover:bg-[var(--surface-hover)] app-text-secondary"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      {share === 1 ? "Full balance" : `${share * 100}%`}
                    </button>
                  ))}
                </div>
              </>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Method" required>
              {(id) => (
                <select id={id} value={form.method} onChange={update("method")} className="app-input">
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method}>{method}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Payment date" required>
              {(id) => (
                <input
                  id={id}
                  type="date"
                  value={form.paid_at}
                  min={localDateInput(order.created_at)}
                  max={localDateInput()}
                  onChange={update("paid_at")}
                  required
                  className="app-input"
                />
              )}
            </Field>
          </div>

          <Field label="Reference" hint="Transfer reference, cheque number…">
            {(id) => <input id={id} value={form.reference} onChange={update("reference")} maxLength={100} placeholder="e.g. VIR-20261009-4821" className="app-input" />}
          </Field>
          <Field label="Note">
            {(id) => <input id={id} value={form.note} onChange={update("note")} maxLength={255} placeholder="Optional" className="app-input" />}
          </Field>
        </form>
      )}
    </Modal>
  );
}

/* ---------- Void payment ---------- */

function VoidPaymentModal({ payment, onClose, onVoided }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [preparedFor, setPreparedFor] = useState(null);
  if (payment && payment.id !== preparedFor) {
    setPreparedFor(payment.id);
    setReason("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (reason.trim().length < 3) return setError("Explain why this payment is being voided.");

    setSaving(true);
    try {
      await api(`/payments/${payment.id}/void`, { method: "PATCH", body: { reason: reason.trim() } });
      toast.success(`${money(payment.amount)} payment was voided.`, { title: "Payment voided" });
      onVoided();
      onClose();
    } catch (err) {
      setError(err.message || "Could not void the payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={Boolean(payment)}
      onClose={onClose}
      busy={saving}
      size="sm"
      icon="ban"
      iconTone="danger"
      title="Void this payment?"
      description={payment ? `${money(payment.amount)} · ${payment.method} · ${formatDate(`${payment.paid_at}T00:00:00`)}` : ""}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Keep payment
          </Button>
          <Button type="submit" form="void-form" variant="danger" loading={saving}>
            Void payment
          </Button>
        </>
      }
    >
      <form id="void-form" onSubmit={handleSubmit} className="space-y-3">
        <InlineAlert>{error}</InlineAlert>
        <p className="text-sm app-text-secondary">
          The payment stays in the history for auditing but no longer counts toward the amount paid.
        </p>
        <Field label="Reason" required>
          {(id) => (
            <textarea
              id={id}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={255}
              placeholder="e.g. Recorded twice, cheque bounced…"
              className="app-input resize-none"
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}

/* ---------- Panel ---------- */

/**
 * Billing summary, payment history, and payment actions for one order.
 * `version` changes force a reload; `onChanged` lets the parent refresh lists.
 */
export default function PaymentPanel({ order, version = 0, canRecord, canVoid, onChanged }) {
  const [localVersion, setLocalVersion] = useState(0);
  const { data, loading, error } = useResource(order ? `/orders/${order.id}/payments?v=${version}-${localVersion}` : null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [voiding, setVoiding] = useState(null);

  const billing = data?.data?.billing ?? order?.billing;
  const payments = data?.data?.payments ?? [];

  function refresh() {
    setLocalVersion((value) => value + 1);
    onChanged?.();
  }

  if (!billing) return null;

  const badge = paymentBadge(billing);
  const progress = billing.total_due > 0 ? Math.min(100, (billing.amount_paid / billing.total_due) * 100) : 0;
  const isVoid = billing.payment_status === "Void";
  const dueIn = Math.round((new Date(billing.due_date) - new Date()) / 86400000);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold app-text">Payments</h3>
        {canRecord && !isVoid && billing.balance > 0 && (
          <Button size="sm" variant="primary" icon="plus" onClick={() => setRecordOpen(true)}>
            Record payment
          </Button>
        )}
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide app-text-muted">Balance due</p>
            <p className="mt-0.5 text-2xl font-bold tracking-tight tabular-nums app-text">{money(billing.balance)}</p>
            <p className="mt-0.5 text-xs app-text-secondary">
              of {money(billing.total_due)} incl. VAT
              {!isVoid && billing.balance > 0 && (
                <>
                  {" · "}
                  <span style={billing.overdue ? { color: "var(--danger)", fontWeight: 600 } : undefined}>
                    {billing.overdue
                      ? `${billing.days_overdue} days overdue`
                      : dueIn === 0
                        ? "due today"
                        : `due in ${dueIn} days (${formatDate(billing.due_date)})`}
                  </span>
                </>
              )}
            </p>
          </div>
          <Badge tone={badge.tone} icon={badge.icon}>
            {badge.label}
          </Badge>
        </div>

        {!isVoid && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-muted)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progress}%`, backgroundColor: progress >= 100 ? "var(--success)" : "var(--primary)" }}
              />
            </div>
            <p className="mt-1.5 text-xs app-text-muted">
              {money(billing.amount_paid)} paid · {progress.toFixed(0)}%
            </p>
          </div>
        )}
      </div>

      <div className="mt-3">
        {error ? (
          <InlineAlert>{error}</InlineAlert>
        ) : loading && !data ? (
          <div className="skeleton h-14 rounded-xl" />
        ) : payments.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm app-text-secondary" style={{ borderColor: "var(--border-strong)" }}>
            {isVoid ? "This order was cancelled; no payment is due." : "No payments recorded yet."}
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
            {payments.map((payment) => {
              const voided = Boolean(payment.voided_at);
              return (
                <li key={payment.id} className="flex items-start gap-3 px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={toneStyle(voided ? "neutral" : "success")}>
                    <Icon name={methodIcons[payment.method] ?? "wallet"} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold tabular-nums ${voided ? "line-through app-text-muted" : "app-text"}`}>
                      {money(payment.amount)}
                      <span className="ml-2 text-xs font-normal app-text-muted">{payment.method}</span>
                    </p>
                    <p className="truncate text-xs app-text-muted">
                      {formatDate(`${payment.paid_at}T00:00:00`)}
                      {payment.reference && ` · ${payment.reference}`}
                      {payment.recorded_by_name && ` · by ${payment.recorded_by_name}`}
                    </p>
                    {payment.note && <p className="mt-0.5 text-xs app-text-secondary">{payment.note}</p>}
                    {voided && (
                      <p className="mt-1 text-xs font-medium" style={{ color: "var(--danger)" }}>
                        Voided {formatDate(payment.voided_at)}
                        {payment.voided_by_name && ` by ${payment.voided_by_name}`}: {payment.void_reason}
                      </p>
                    )}
                  </div>
                  {canVoid && !voided && (
                    <IconAction icon="ban" label="Void payment" tone="danger" onClick={() => setVoiding(payment)} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <RecordPaymentModal open={recordOpen} onClose={() => setRecordOpen(false)} order={order} billing={billing} onRecorded={refresh} />
      <VoidPaymentModal payment={voiding} onClose={() => setVoiding(null)} onVoided={refresh} />
    </section>
  );
}
