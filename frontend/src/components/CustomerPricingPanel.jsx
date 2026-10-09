import { useState } from "react";
import Button from "./ui/Button";
import { Modal } from "./ui/Modal";
import { useConfirm, useToast } from "./ui/feedback";
import { Field, IconAction, InlineAlert } from "./ui/primitives";
import { api, money, toList, useActiveProducts, useResource } from "../lib/api";

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/** Add or change a contract price. Pass `customer` to fix the customer, `editing` to change an existing price. */
export function ContractPriceModal({ open, onClose, customer, editing, onSaved }) {
  const toast = useToast();
  const customersResource = useResource(open && !customer && !editing ? "/customers" : null);
  const customers = toList(customersResource.data);
  const { products } = useActiveProducts(open);

  const [form, setForm] = useState({ customer_id: "", product_id: "", unit_price: "", note: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const prepareKey = open ? `${customer?.id ?? ""}:${editing?.id ?? "new"}` : null;
  const [preparedFor, setPreparedFor] = useState(null);
  if (prepareKey !== preparedFor) {
    setPreparedFor(prepareKey);
    if (prepareKey) {
      setForm({
        customer_id: String(editing?.customer_id ?? customer?.id ?? ""),
        product_id: String(editing?.product_id ?? ""),
        unit_price: editing ? String(editing.unit_price) : "",
        note: editing?.note ?? "",
      });
      setError("");
    }
  }

  const product = products.find((option) => String(option.id) === form.product_id);
  const listPrice = product ? Number(product.price) : editing?.list_price;
  const price = Number(form.unit_price);
  const off = listPrice > 0 && form.unit_price !== "" ? round2((1 - price / listPrice) * 100) : null;
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!form.customer_id) return setError("Choose a customer.");
    if (!form.product_id) return setError("Choose a product.");
    if (form.unit_price === "" || !Number.isFinite(price) || price < 0) return setError("Enter a price of 0 or more.");

    setSaving(true);
    try {
      await api(`/customers/${form.customer_id}/prices`, {
        method: "PUT",
        body: { product_id: Number(form.product_id), unit_price: round2(price), note: form.note.trim() },
      });
      toast.success(`${money(price)} saved as the contract price.`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Could not save the price.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={saving}
      size="sm"
      icon="receipt"
      title={editing ? "Change contract price" : "Add a contract price"}
      description={editing ? `${editing.product_name} for ${editing.company_name}` : customer?.company_name}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="contract-price-form" variant="primary" loading={saving}>
            Save price
          </Button>
        </>
      }
    >
      <form id="contract-price-form" onSubmit={handleSubmit} className="space-y-4">
        <InlineAlert>{error}</InlineAlert>
        {!customer && !editing && (
          <Field label="Customer" required>
            {(id) => (
              <select id={id} value={form.customer_id} onChange={update("customer_id")} className="app-input">
                <option value="">Select a customer...</option>
                {customers.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.company_name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        {!editing && (
          <Field label="Product" required>
            {(id) => (
              <select id={id} value={form.product_id} onChange={update("product_id")} className="app-input">
                <option value="">Select a product...</option>
                {products.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} · {money(option.price)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <Field
          label="Price (HT)"
          required
          hint={
            listPrice === undefined || listPrice === null
              ? "Applies to every order and quote for this customer."
              : `Catalog price ${money(listPrice)}${off !== null ? (off >= 0 ? `, ${off}% off` : `, ${-off}% above`) : ""}. Price lists and volume discounts don't apply on top.`
          }
        >
          {(id) => (
            <div className="relative">
              <input id={id} type="number" min="0" step="0.01" value={form.unit_price} onChange={update("unit_price")} className="app-input pr-14 tabular-nums" data-autofocus />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold app-text-muted">MAD</span>
            </div>
          )}
        </Field>
        <Field label="Note">
          {(id) => <input id={id} value={form.note} onChange={update("note")} maxLength={255} placeholder="e.g. Annual agreement 2026" className="app-input" />}
        </Field>
      </form>
    </Modal>
  );
}

export default function CustomerPricingPanel({ customer, canManage, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [version, setVersion] = useState(0);
  const listsResource = useResource(customer ? "/pricing/price-lists" : null);
  const pricesResource = useResource(customer ? `/pricing/customer-prices?customer_id=${customer.id}&v=${version}` : null);
  const lists = listsResource.data?.data ?? [];
  const prices = pricesResource.data?.data ?? [];
  const [modal, setModal] = useState(null);
  const [savingList, setSavingList] = useState(false);

  async function changeList(value) {
    setSavingList(true);
    try {
      await api(`/customers/${customer.id}/price-list`, { method: "PATCH", body: { price_list_id: value ? Number(value) : null } });
      const list = lists.find((option) => String(option.id) === value);
      toast.success(list ? `${customer.company_name} now gets ${list.name} prices.` : `${customer.company_name} now pays catalog prices.`);
      onChanged?.();
    } catch (err) {
      toast.error(err.message || "Could not change the price list.");
    } finally {
      setSavingList(false);
    }
  }

  async function remove(price) {
    const confirmed = await confirm({
      title: "Remove this contract price?",
      message: `${price.product_name} goes back to ${customer.company_name}'s normal price. Existing orders keep their prices.`,
      confirmLabel: "Remove",
    });
    if (!confirmed) return;
    try {
      await api(`/pricing/customer-prices/${price.id}`, { method: "DELETE" });
      toast.success("Contract price removed.");
      setVersion((value) => value + 1);
    } catch (err) {
      toast.error(err.message || "Could not remove the price.");
    }
  }

  if (!customer) return null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold app-text">Pricing</h3>
        {canManage && (
          <Button size="sm" icon="plus" onClick={() => setModal({})}>
            Contract price
          </Button>
        )}
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "var(--border-color)" }}>
        <Field label="Price list">
          {(id) =>
            canManage ? (
              <select
                id={id}
                value={customer.price_list_id ?? ""}
                onChange={(event) => changeList(event.target.value)}
                disabled={savingList || listsResource.loading}
                className="app-input"
              >
                <option value="">None (catalog prices)</option>
                {lists
                  .filter((list) => list.is_active || list.id === customer.price_list_id)
                  .map((list) => (
                    <option key={list.id} value={list.id} disabled={!list.is_active}>
                      {list.name}, −{list.discount_percent}%{list.is_active ? "" : " (inactive)"}
                    </option>
                  ))}
              </select>
            ) : (
              <p id={id} className="text-sm app-text">
                {customer.price_list_name ? `${customer.price_list_name}, −${Number(customer.price_list_discount)}%` : "None (catalog prices)"}
              </p>
            )
          }
        </Field>

        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide app-text-muted">Contract prices</p>
          {pricesResource.loading && !pricesResource.data ? (
            <div className="skeleton mt-2 h-10 rounded-lg" />
          ) : prices.length === 0 ? (
            <p className="mt-1.5 text-sm app-text-secondary">None. Volume discounts apply as usual.</p>
          ) : (
            <ul className="mt-1.5 divide-y" style={{ borderColor: "var(--border-color)" }}>
              {prices.map((price) => (
                <li key={price.id} className="flex items-center gap-3 py-2" style={{ borderColor: "var(--border-color)" }}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium app-text">{price.product_name}</p>
                    <p className="truncate text-xs app-text-muted">
                      <span className="line-through">{money(price.list_price)}</span>
                      {price.list_price > 0 && ` · ${Math.round((1 - price.unit_price / price.list_price) * 1000) / 10}% off`}
                      {price.note && ` · ${price.note}`}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums app-text">{money(price.unit_price)}</p>
                  {canManage && (
                    <div className="flex gap-0.5">
                      <IconAction icon="edit" label={`Change price of ${price.product_name}`} onClick={() => setModal({ editing: price })} />
                      <IconAction icon="trash" label={`Remove price of ${price.product_name}`} tone="danger" onClick={() => remove(price)} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ContractPriceModal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        customer={customer}
        editing={modal?.editing}
        onSaved={() => setVersion((value) => value + 1)}
      />
    </section>
  );
}
