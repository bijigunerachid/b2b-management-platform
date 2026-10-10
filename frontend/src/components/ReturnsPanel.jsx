import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "./ui/Button";
import Icon from "./ui/Icon";
import { Modal } from "./ui/Modal";
import { useToast } from "./ui/feedback";
import { Field, InlineAlert, toneStyle } from "./ui/primitives";
import company from "../config/company";
import { api, formatDate, money, number, useResource } from "../lib/api";
import { PAYMENT_METHODS } from "../lib/billing";
import { RETURN_REASONS } from "../lib/returns";

import { t } from "../i18n";
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function emptyForm(lines) {
  return {
    reason: RETURN_REASONS[0],
    note: "",
    refund_method: "Bank transfer",
    lines: Object.fromEntries(lines.map((line) => [line.product_id, { quantity: "", restock: true }])),
  };
}

function ReturnModal({ open, onClose, order, billing, lines, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState(() => emptyForm(lines));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [preparedFor, setPreparedFor] = useState(null);
  const prepareKey = open ? `${order.id}:${lines.map((line) => line.returnable).join(",")}` : null;
  if (prepareKey && prepareKey !== preparedFor) {
    setPreparedFor(prepareKey);
    setForm(emptyForm(lines));
    setError("");
  }
  if (!open && preparedFor !== null) setPreparedFor(null);

  const openLines = lines.filter((line) => line.returnable > 0);
  const chosen = openLines
    .map((line) => ({ line, quantity: Number(form.lines[line.product_id]?.quantity) || 0, restock: form.lines[line.product_id]?.restock ?? true }))
    .filter((entry) => entry.quantity > 0);

  const subtotal = round2(chosen.reduce((sum, entry) => sum + entry.quantity * entry.line.unit_price, 0));
  const total = round2(subtotal * (1 + company.vatRate));
  const refund = round2(Math.max(0, total - billing.balance));

  const setLine = (productId, changes) =>
    setForm((current) => ({ ...current, lines: { ...current.lines, [productId]: { ...current.lines[productId], ...changes } } }));
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const invalid = chosen.find((entry) => !Number.isInteger(entry.quantity) || entry.quantity > entry.line.returnable);
    if (invalid) return setError(t("You can return at most {count} of {product}.", { count: invalid.line.returnable, product: invalid.line.product_name }));
    if (chosen.length === 0) return setError(t("Enter a quantity for at least one product."));
    if (form.reason === "Other" && form.note.trim().length < 3) return setError(t("Describe the reason in the note."));

    setSaving(true);
    try {
      const result = await api(`/orders/${order.id}/credit-notes`, {
        method: "POST",
        body: {
          reason: form.reason,
          note: form.note.trim(),
          refund_method: refund > 0 ? form.refund_method : null,
          items: chosen.map((entry) => ({ product_id: entry.line.product_id, quantity: entry.quantity, restock: entry.restock })),
        },
      });
      const note = result.data;
      toast.success(
        note.refund_amount > 0 ? t("{amount} to refund by {method}.", { amount: money(note.refund_amount), method: t(form.refund_method).toLowerCase() }) : t("{amount} taken off the balance.", { amount: money(note.total) }),
        { title: t("{number} created", { number: note.number }) }
      );
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message || t("Could not create the credit note."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={saving}
      size="lg"
      icon="undo"
      title={t("Return items")}
      description={`${t("Order #{id}", { id: order.id })} · ${order.company_name}`}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            {t("Cancel")}
          </Button>
          <Button type="submit" form="return-form" variant="primary" loading={saving} disabled={chosen.length === 0}>
            {total > 0 ? t("Create credit note for {amount}", { amount: money(total) }) : t("Create credit note")}
          </Button>
        </>
      }
    >
      <form id="return-form" onSubmit={handleSubmit} className="space-y-5">
        <InlineAlert>{error}</InlineAlert>

        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
          <table className="w-full min-w-[480px] text-start text-sm">
            <thead>
              <tr className="text-xs app-text-muted" style={{ backgroundColor: "var(--surface-muted)" }}>
                <th className="px-4 py-2.5 font-semibold">{t("Product")}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{t("Can return")}</th>
                <th className="px-3 py-2.5 font-semibold">{t("Quantity")}</th>
                <th className="px-4 py-2.5 font-semibold">{t("Back in stock")}</th>
              </tr>
            </thead>
            <tbody>
              {openLines.map((line) => {
                const value = form.lines[line.product_id] ?? { quantity: "", restock: true };
                return (
                  <tr key={line.product_id} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium app-text">{line.product_name}</p>
                      <p className="text-xs app-text-muted">
                        {t("{price} each", { price: money(line.unit_price) })}{line.returned > 0 && `, ${t("{count} already returned", { count: line.returned })}`}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-end tabular-nums app-text-secondary">{line.returnable}</td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min="0"
                        max={line.returnable}
                        step="1"
                        value={value.quantity}
                        onChange={(event) => setLine(line.product_id, { quantity: event.target.value })}
                        placeholder="0"
                        aria-label={t("Quantity of {product} to return", { product: line.product_name })}
                        className="app-input w-20 tabular-nums"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <label className="inline-flex items-center gap-2 text-sm app-text-secondary">
                        <input
                          type="checkbox"
                          checked={value.restock}
                          onChange={(event) => setLine(line.product_id, { restock: event.target.checked })}
                          className="h-4 w-4 accent-[var(--primary)]"
                        />
                        {value.restock ? t("Yes") : t("No, write off")}
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("Reason")} required>
            {(id) => (
              <select id={id} value={form.reason} onChange={update("reason")} className="app-input">
                {RETURN_REASONS.map((reason) => (
                  <option key={reason}>{reason}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("Note")} required={form.reason === "Other"}>
            {(id) => <input id={id} value={form.note} onChange={update("note")} maxLength={500} placeholder={t("Printed on the credit note")} className="app-input" />}
          </Field>
        </div>

        {total > 0 && (
          <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border-color)" }}>
            <dl className="space-y-1.5">
              <div className="flex justify-between app-text-secondary">
                <dt>{t("Subtotal")}</dt>
                <dd className="tabular-nums">{money(subtotal)}</dd>
              </div>
              <div className="flex justify-between app-text-secondary">
                <dt>{t("VAT {percent}%", { percent: Math.round(company.vatRate * 100) })}</dt>
                <dd className="tabular-nums">{money(round2(total - subtotal))}</dd>
              </div>
              <div className="flex justify-between border-t pt-1.5 font-bold app-text" style={{ borderColor: "var(--border-color)" }}>
                <dt>{t("Credit")}</dt>
                <dd className="tabular-nums">{money(total)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs app-text-secondary">
              {refund === 0
                ? t("The open balance goes down from {from} to {to}.", { from: money(billing.balance), to: money(round2(billing.balance - total)) })
                : billing.balance > 0
                  ? t("{balance} comes off the open balance and {refund} is refunded.", { balance: money(billing.balance), refund: money(refund) })
                  : t("This order is already paid, so {refund} is refunded.", { refund: money(refund) })}
            </p>
            {refund > 0 && (
              <div className="mt-3 max-w-xs">
                <Field label={t("Refund method")} required>
                  {(id) => (
                    <select id={id} value={form.refund_method} onChange={update("refund_method")} className="app-input">
                      {PAYMENT_METHODS.map((method) => (
                        <option key={method}>{method}</option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}

export default function ReturnsPanel({ order, version = 0, canCreate, onChanged }) {
  const { data, loading, error } = useResource(order ? `/orders/${order.id}/credit-notes?v=${version}` : null);
  const [open, setOpen] = useState(false);

  const returns = data?.data;
  const notes = returns?.credit_notes ?? [];

  if (!order || (order.status !== "Completed" && notes.length === 0)) return null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold app-text">{t("Returns")}</h3>
        {canCreate && returns?.can_return && (
          <Button size="sm" icon="undo" onClick={() => setOpen(true)}>
            {t("Return items")}
          </Button>
        )}
      </div>

      {error ? (
        <InlineAlert>{error}</InlineAlert>
      ) : loading && !returns ? (
        <div className="skeleton h-14 rounded-xl" />
      ) : notes.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm app-text-secondary" style={{ borderColor: "var(--border-strong)" }}>
          {t("Nothing returned.")}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
          {notes.map((note) => (
            <li key={note.id} className="flex items-start gap-3 px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={toneStyle("neutral")}>
                <Icon name="undo" size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold app-text">
                  <Link to={`/credit-notes/${note.id}/print`} target="_blank" rel="noopener" className="hover:underline">
                    {note.number}
                  </Link>
                  <span className="ms-2 text-xs font-normal app-text-muted">
                    {note.units === 1 ? t("1 unit") : t("{count} units", { count: number(note.units) })} · {note.reason}
                  </span>
                </p>
                <p className="truncate text-xs app-text-muted">
                  {formatDate(note.created_at)}
                  {note.created_by_name && ` · ${t("by {name}", { name: note.created_by_name })}`}
                  {note.refund_amount > 0 && ` · ${t("{amount} refunded by {method}", { amount: money(note.refund_amount), method: t(note.refund_method).toLowerCase() })}`}
                </p>
              </div>
              <p className="text-sm font-bold tabular-nums app-text">−{money(note.total)}</p>
            </li>
          ))}
        </ul>
      )}

      {returns && (
        <ReturnModal open={open} onClose={() => setOpen(false)} order={order} billing={order.billing} lines={returns.lines} onCreated={onChanged} />
      )}
    </section>
  );
}
