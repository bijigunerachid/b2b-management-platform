import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "./ui/Button";
import Icon from "./ui/Icon";
import DemandForecast from "./DemandForecast";
import { Drawer, Modal } from "./ui/Modal";
import { useToast } from "./ui/feedback";
import { Field, InlineAlert, SegmentedControl, toneStyle } from "./ui/primitives";
import { api, formatDate, number, timeAgo, useResource } from "../lib/api";
import { ADJUSTMENT_REASONS, MOVEMENT_TYPES } from "../lib/purchasing";

import { t } from "../i18n";
export function StockAdjustModal({ product, onClose, onAdjusted }) {
  const toast = useToast();
  const [direction, setDirection] = useState("remove");
  const [form, setForm] = useState({ quantity: "", reason: "Stock count correction", note: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [preparedFor, setPreparedFor] = useState(null);
  if (product && product.id !== preparedFor) {
    setPreparedFor(product.id);
    setDirection("remove");
    setForm({ quantity: "", reason: "Stock count correction", note: "" });
    setError("");
  }
  if (!product && preparedFor !== null) setPreparedFor(null);

  const amount = Number(form.quantity) || 0;
  const delta = direction === "add" ? amount : -amount;
  const stock = Number(product?.stock ?? 0);
  const after = stock + delta;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!Number.isInteger(amount) || amount < 1) return setError(t("Enter a whole quantity of at least 1."));
    if (after < 0) return setError(t("Only {count} in stock: you can remove at most {count}.", { count: stock }));
    if (form.reason === "Other" && form.note.trim().length < 3) return setError(t("Describe the reason in the note."));

    setSaving(true);
    try {
      const result = await api(`/products/${product.id}/adjustments`, {
        method: "POST",
        body: { quantity: delta, reason: form.reason, note: form.note.trim() },
      });
      toast.success(`${product.name}: ${delta > 0 ? "+" : ""}${delta} → ${t("{count} in stock", { count: result.data.stock })}.`, { title: t("Stock adjusted") });
      onAdjusted?.();
      onClose();
    } catch (err) {
      setError(err.message || t("Could not adjust stock."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={Boolean(product)}
      onClose={onClose}
      busy={saving}
      size="sm"
      icon="edit"
      title={product?.name ?? ""}
      description={t("Currently {count} in stock. Every change is recorded with its reason.", { count: number(stock) })}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            {t("Cancel")}
          </Button>
          <Button type="submit" form="adjust-form" variant="primary" loading={saving} icon="check" disabled={amount < 1 || after < 0}>
            {amount > 0 ? t("Set stock to {count}", { count: number(after) }) : t("Adjust stock")}
          </Button>
        </>
      }
    >
      <form id="adjust-form" onSubmit={handleSubmit} className="space-y-4">
        <InlineAlert>{error}</InlineAlert>
        <SegmentedControl
          label={t("Direction")}
          value={direction}
          onChange={setDirection}
          options={[
            { value: "remove", label: t("Remove stock") },
            { value: "add", label: t("Add stock") },
          ]}
        />
        <Field label={t("Quantity")} required hint={amount > 0 ? `${number(stock)} → ${number(after)}` : direction === "add" ? t("Units to add") : t("Units to remove")}>
          {(id) => (
            <input
              id={id}
              type="number"
              min="1"
              step="1"
              value={form.quantity}
              onChange={(event) => setForm((f) => ({ ...f, quantity: event.target.value }))}
              className="app-input text-base font-semibold tabular-nums"
              data-autofocus
            />
          )}
        </Field>
        <Field label={t("Reason")} required>
          {(id) => (
            <select id={id} value={form.reason} onChange={(event) => setForm((f) => ({ ...f, reason: event.target.value }))} className="app-input">
              {ADJUSTMENT_REASONS.map((reason) => (
                <option key={reason}>{reason}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t("Note")} required={form.reason === "Other"} hint={t("Optional detail, e.g. location or count sheet number")}>
          {(id) => <input id={id} value={form.note} onChange={(event) => setForm((f) => ({ ...f, note: event.target.value }))} maxLength={200} className="app-input" />}
        </Field>
      </form>
    </Modal>
  );
}

export function MovementRow({ movement, showProduct = true }) {
  const meta = MOVEMENT_TYPES[movement.type] ?? MOVEMENT_TYPES.adjustment;
  const positive = movement.quantity > 0;

  return (
    <li className="flex items-start gap-3 px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={toneStyle(meta.tone)}>
        <Icon name={meta.icon} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold app-text">
          {showProduct ? movement.product_name : meta.label}
          {showProduct && <span className="ms-2 text-xs font-normal app-text-muted">{meta.label}</span>}
        </p>
        <p className="truncate text-xs app-text-muted">
          {movement.reason}
          {movement.order_id && (
            <>
              {" · "}
              <Link to={`/orders?view=${movement.order_id}`} className="hover:underline" style={{ color: "var(--primary)" }}>
                {t("Order #{id}", { id: movement.order_id })}
              </Link>
            </>
          )}
          {movement.credit_note_id && (
            <>
              {" · "}
              <Link to={`/credit-notes/${movement.credit_note_id}/print`} target="_blank" rel="noopener" className="hover:underline" style={{ color: "var(--primary)" }}>
                {t("View credit note")}
              </Link>
            </>
          )}
          {movement.purchase_order_id && (
            <>
              {" · "}
              <Link to={`/purchase-orders?view=${movement.purchase_order_id}`} className="hover:underline" style={{ color: "var(--primary)" }}>
                {t("View PO")}
              </Link>
            </>
          )}
        </p>
        <p className="text-[11px] app-text-muted">
          {formatDate(movement.created_at, true)} · {timeAgo(movement.created_at)}
          {movement.created_by_name && ` · ${movement.created_by_name}`}
        </p>
      </div>
      <div className="text-end">
        <p className="text-sm font-bold tabular-nums" style={{ color: positive ? "var(--success)" : "var(--danger)" }}>
          {positive ? "+" : "−"}
          {number(Math.abs(movement.quantity))}
        </p>
        <p className="text-[11px] tabular-nums app-text-muted">→ {number(movement.balance_after)}</p>
      </div>
    </li>
  );
}

export function StockHistoryDrawer({ product, onClose, canAdjust, onChanged }) {
  const [version, setVersion] = useState(0);
  const [adjusting, setAdjusting] = useState(null);
  const { data, loading, error } = useResource(product ? `/inventory/movements?product_id=${product.id}&limit=100&v=${version}` : null);
  const movements = data?.data ?? [];
  const current = movements[0]?.balance_after ?? product?.stock ?? 0;

  return (
    <>
      <Drawer
        open={Boolean(product)}
        onClose={onClose}
        title={product?.name ?? ""}
        description={product ? `${t("{count} in stock", { count: number(current) })} · ${t("reorder at {count}", { count: number(product.reorder_point ?? 5) })}${Number(product.on_order) > 0 ? ` · ${t("{count} on order", { count: number(product.on_order) })}` : ""}` : ""}
        icon="box"
        footer={
          product &&
          canAdjust && (
            <Button variant="primary" icon="edit" onClick={() => setAdjusting({ ...product, stock: current })}>
              {t("Adjust stock")}
            </Button>
          )
        }
      >
        {product && <DemandForecast product={product} stock={current} />}
        <h3 className="mb-2 text-sm font-semibold app-text">{t("Stock movements")}</h3>
        {error ? (
          <InlineAlert>{error}</InlineAlert>
        ) : loading && !data ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        ) : movements.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm app-text-secondary" style={{ borderColor: "var(--border-strong)" }}>
            {t("No stock movements recorded yet.")}
          </p>
        ) : (
          <>
            <ul className="divide-y overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
              {movements.map((movement) => (
                <MovementRow key={movement.id} movement={movement} showProduct={false} />
              ))}
            </ul>
            {data?.pagination?.total > movements.length && (
              <p className="mt-3 text-center text-xs app-text-muted">
                {t("Showing the latest {count} of {total} movements.", { count: movements.length, total: number(data.pagination.total) })}
              </p>
            )}
          </>
        )}
      </Drawer>

      <StockAdjustModal
        product={adjusting}
        onClose={() => setAdjusting(null)}
        onAdjusted={() => {
          setVersion((value) => value + 1);
          onChanged?.();
        }}
      />
    </>
  );
}
