import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { useConfirm, useToast } from "../components/ui/feedback";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Field,
  IconAction,
  InlineAlert,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedControl,
  Switch,
  TableHead,
  TableSkeleton,
  Th,
} from "../components/ui/primitives";
import { ContractPriceModal } from "../components/CustomerPricingPanel";
import { api, can, formatDate, money, number, toList, useResource } from "../lib/api";
import useTable from "../lib/useTable";

import { t } from "../i18n";
const TABS = [
  { value: "lists", label: "Price lists" },
  { value: "volume", label: "Volume discounts" },
  { value: "contracts", label: "Contract prices" },
];

const rowClass = "border-t transition-colors hover:bg-[var(--surface-hover)]";

function useFormModal(initial) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [preparedFor, setPreparedFor] = useState(null);
  return { form, setForm, error, setError, saving, setSaving, preparedFor, setPreparedFor };
}

function PriceListModal({ open, editing, onClose, onSaved }) {
  const toast = useToast();
  const state = useFormModal({ name: "", description: "", discount_percent: "", is_active: true });
  const { form, setForm, error, setError, saving, setSaving } = state;

  const prepareKey = open ? `${editing?.id ?? "new"}` : null;
  if (prepareKey !== state.preparedFor) {
    state.setPreparedFor(prepareKey);
    if (prepareKey) {
      setForm({
        name: editing?.name ?? "",
        description: editing?.description ?? "",
        discount_percent: editing ? String(editing.discount_percent) : "",
        is_active: editing?.is_active ?? true,
      });
      setError("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api(editing ? `/pricing/price-lists/${editing.id}` : "/pricing/price-lists", {
        method: editing ? "PUT" : "POST",
        body: { ...form, name: form.name.trim(), discount_percent: Number(form.discount_percent) },
      });
      toast.success(t("{name} saved.", { name: form.name.trim() }));
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || t("Could not save the price list."));
    } finally {
      setSaving(false);
    }
  }

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={saving}
      size="sm"
      icon="receipt"
      title={editing ? t("Edit {name}", { name: editing.name }) : t("New price list")}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            {t("Cancel")}
          </Button>
          <Button type="submit" form="price-list-form" variant="primary" loading={saving}>
            {t("Save")}
          </Button>
        </>
      }
    >
      <form id="price-list-form" onSubmit={handleSubmit} className="space-y-4">
        <InlineAlert>{error}</InlineAlert>
        <Field label={t("Name")} required>
          {(id) => <input id={id} value={form.name} onChange={update("name")} maxLength={100} placeholder={t("e.g. Gold")} className="app-input" data-autofocus />}
        </Field>
        <Field label={t("Discount off catalog prices")} required hint={t("Between 0.01% and 50%.")}>
          {(id) => (
            <div className="relative">
              <input id={id} type="number" min="0.01" max="50" step="0.01" value={form.discount_percent} onChange={update("discount_percent")} className="app-input pe-10 tabular-nums" />
              <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-semibold app-text-muted">%</span>
            </div>
          )}
        </Field>
        <Field label={t("Description")}>
          {(id) => <input id={id} value={form.description} onChange={update("description")} maxLength={255} placeholder={t("Who gets this list")} className="app-input" />}
        </Field>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium app-text">{t("Active")}</p>
            <p className="text-xs app-text-muted">{t("Customers on an inactive list pay catalog prices.")}</p>
          </div>
          <Switch checked={form.is_active} onChange={(value) => setForm((current) => ({ ...current, is_active: value }))} label={t("Active")} />
        </div>
      </form>
    </Modal>
  );
}

function VolumeDiscountModal({ open, editing, categories, onClose, onSaved }) {
  const toast = useToast();
  const state = useFormModal({ category_id: "", min_quantity: "", discount_percent: "" });
  const { form, setForm, error, setError, saving, setSaving } = state;

  const prepareKey = open ? `${editing?.id ?? "new"}` : null;
  if (prepareKey !== state.preparedFor) {
    state.setPreparedFor(prepareKey);
    if (prepareKey) {
      setForm({
        category_id: editing?.category_id ? String(editing.category_id) : "",
        min_quantity: editing ? String(editing.min_quantity) : "",
        discount_percent: editing ? String(editing.discount_percent) : "",
      });
      setError("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api(editing ? `/pricing/volume-discounts/${editing.id}` : "/pricing/volume-discounts", {
        method: editing ? "PUT" : "POST",
        body: {
          category_id: form.category_id ? Number(form.category_id) : null,
          min_quantity: Number(form.min_quantity),
          discount_percent: Number(form.discount_percent),
        },
      });
      toast.success(t("Volume discount saved."));
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || t("Could not save the volume discount."));
    } finally {
      setSaving(false);
    }
  }

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={saving}
      size="sm"
      icon="box"
      title={editing ? t("Edit volume discount") : t("New volume discount")}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            {t("Cancel")}
          </Button>
          <Button type="submit" form="volume-form" variant="primary" loading={saving}>
            {t("Save")}
          </Button>
        </>
      }
    >
      <form id="volume-form" onSubmit={handleSubmit} className="space-y-4">
        <InlineAlert>{error}</InlineAlert>
        <Field label={t("Products")}>
          {(id) => (
            <select id={id} value={form.category_id} onChange={update("category_id")} className="app-input">
              <option value="">{t("All products")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("From quantity")} required hint={t("Units of one product on a line.")}>
            {(id) => <input id={id} type="number" min="2" step="1" value={form.min_quantity} onChange={update("min_quantity")} className="app-input tabular-nums" data-autofocus />}
          </Field>
          <Field label={t("Discount")} required>
            {(id) => (
              <div className="relative">
                <input id={id} type="number" min="0.01" max="50" step="0.01" value={form.discount_percent} onChange={update("discount_percent")} className="app-input pe-10 tabular-nums" />
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-semibold app-text-muted">%</span>
              </div>
            )}
          </Field>
        </div>
        <p className="text-xs app-text-muted">
          A line gets the largest discount it qualifies for, after the customer&apos;s price list discount. Contract prices are never discounted further.
        </p>
      </form>
    </Modal>
  );
}

function PriceLists({ canWrite }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useResource("/pricing/price-lists");
  const lists = data?.data ?? [];
  const [modal, setModal] = useState(null);

  async function remove(list) {
    const confirmed = await confirm({ title: t("Delete {name}?", { name: list.name }), message: t("Orders already placed keep their prices."), confirmLabel: t("Delete") });
    if (!confirmed) return;
    try {
      await api(`/pricing/price-lists/${list.id}`, { method: "DELETE" });
      toast.success(t("{name} deleted.", { name: list.name }));
      reload();
    } catch (err) {
      toast.error(err.message || t("Could not delete the price list."));
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" style={{ borderColor: "var(--border-color)" }}>
        <p className="text-sm app-text-secondary">{t("A percentage off every catalog price, for the customers on the list. Assign lists from a customer's profile.")}</p>
        {canWrite && (
          <Button variant="primary" icon="plus" onClick={() => setModal({})}>
            {t("New price list")}
          </Button>
        )}
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data ? (
        <TableSkeleton columns={5} />
      ) : lists.length === 0 ? (
        <EmptyState icon="receipt" title={t("No price lists")} description={t("Everyone pays catalog prices.")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-start text-sm">
            <TableHead>
              <Th>{t("Name")}</Th>
              <Th align="right">{t("Discount")}</Th>
              <Th align="right">{t("Customers")}</Th>
              <Th>{t("Status")}</Th>
              {canWrite && <Th align="right">{t("Actions")}</Th>}
            </TableHead>
            <tbody>
              {lists.map((list) => (
                <tr key={list.id} className={rowClass} style={{ borderColor: "var(--border-color)" }}>
                  <td className="px-5 py-3.5">
                    <p className="font-semibold app-text">{list.name}</p>
                    {list.description && <p className="text-xs app-text-muted">{list.description}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-end font-semibold tabular-nums app-text">−{list.discount_percent}%</td>
                  <td className="px-5 py-3.5 text-end tabular-nums app-text-secondary">
                    {list.customer_count > 0 ? (
                      <Link to={`/customers?price_list=${list.id}`} className="hover:underline">
                        {number(list.customer_count)}
                      </Link>
                    ) : (
                      0
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge tone={list.is_active ? "success" : "neutral"} dot>
                      {list.is_active ? t("Active") : t("Inactive")}
                    </Badge>
                  </td>
                  {canWrite && (
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        <IconAction icon="edit" label={t("Edit {name}", { name: list.name })} onClick={() => setModal({ editing: list })} />
                        <IconAction icon="trash" label={t("Delete {name}", { name: list.name })} tone="danger" onClick={() => remove(list)} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PriceListModal open={Boolean(modal)} editing={modal?.editing} onClose={() => setModal(null)} onSaved={reload} />
    </Card>
  );
}

function VolumeDiscounts({ canWrite }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useResource("/pricing/volume-discounts");
  const categoriesResource = useResource("/categories");
  const categories = toList(categoriesResource.data);
  const rules = useMemo(() => data?.data ?? [], [data]);
  const [modal, setModal] = useState(null);

  const groups = useMemo(() => {
    const byKey = new Map();
    for (const rule of rules) {
      const key = rule.category_id ?? "all";
      if (!byKey.has(key)) byKey.set(key, { key, name: rule.category_name ?? t("All products"), rules: [] });
      byKey.get(key).rules.push(rule);
    }
    return [...byKey.values()];
  }, [rules]);

  async function remove(rule) {
    const confirmed = await confirm({
      title: t("Delete this volume discount?"),
      message: t("{products}, from {count} units, −{percent}%.", { products: rule.category_name ?? t("All products"), count: rule.min_quantity, percent: rule.discount_percent }),
      confirmLabel: t("Delete"),
    });
    if (!confirmed) return;
    try {
      await api(`/pricing/volume-discounts/${rule.id}`, { method: "DELETE" });
      toast.success(t("Volume discount deleted."));
      reload();
    } catch (err) {
      toast.error(err.message || t("Could not delete the volume discount."));
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" style={{ borderColor: "var(--border-color)" }}>
        <p className="text-sm app-text-secondary">{t("Lower prices when a line reaches a quantity. Category breaks compete with the ones for all products; the larger wins.")}</p>
        {canWrite && (
          <Button variant="primary" icon="plus" onClick={() => setModal({})}>
            {t("New volume discount")}
          </Button>
        )}
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data ? (
        <TableSkeleton columns={3} />
      ) : groups.length === 0 ? (
        <EmptyState icon="box" title={t("No volume discounts")} description={t("Quantity doesn't change the price.")} />
      ) : (
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <div key={group.key} className="rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
              <p className="border-b px-4 py-3 text-sm font-semibold app-text" style={{ borderColor: "var(--border-color)" }}>
                {group.name}
              </p>
              <ul>
                {group.rules.map((rule) => (
                  <li key={rule.id} className="flex items-center gap-3 border-t px-4 py-2.5 first:border-t-0" style={{ borderColor: "var(--border-color)" }}>
                    <p className="flex-1 text-sm app-text-secondary">{t("From {count} units", { count: number(rule.min_quantity) })}</p>
                    <p className="text-sm font-semibold tabular-nums app-text">−{rule.discount_percent}%</p>
                    {canWrite && (
                      <div className="flex gap-0.5">
                        <IconAction icon="edit" label={t("Edit volume discount")} onClick={() => setModal({ editing: rule })} />
                        <IconAction icon="trash" label={t("Delete volume discount")} tone="danger" onClick={() => remove(rule)} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <VolumeDiscountModal open={Boolean(modal)} editing={modal?.editing} categories={categories} onClose={() => setModal(null)} onSaved={reload} />
    </Card>
  );
}

const contractAccessors = {
  customer: (row) => row.company_name,
  product: (row) => row.product_name,
  price: (row) => row.unit_price,
  off: (row) => (row.list_price > 0 ? 1 - row.unit_price / row.list_price : 0),
};

function ContractPrices({ canWrite }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useResource("/pricing/customer-prices");
  const rows = useMemo(() => data?.data ?? [], [data]);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? rows.filter((row) => row.company_name.toLowerCase().includes(term) || row.product_name.toLowerCase().includes(term)) : rows;
  }, [rows, search]);
  const table = useTable(filtered, { accessors: contractAccessors, initialSort: { key: "customer", direction: "asc" } });

  async function remove(row) {
    const confirmed = await confirm({
      title: t("Remove this contract price?"),
      message: t("{product} goes back to {customer}'s normal price.", { product: row.product_name, customer: row.company_name }),
      confirmLabel: t("Remove"),
    });
    if (!confirmed) return;
    try {
      await api(`/pricing/customer-prices/${row.id}`, { method: "DELETE" });
      toast.success(t("Contract price removed."));
      reload();
    } catch (err) {
      toast.error(err.message || t("Could not remove the price."));
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" style={{ borderColor: "var(--border-color)" }}>
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            table.setPage(1);
          }}
          placeholder={t("Search customer or product...")}
          className="sm:w-80"
        />
        {canWrite && (
          <Button variant="primary" icon="plus" onClick={() => setModal({})}>
            {t("New contract price")}
          </Button>
        )}
      </div>
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data ? (
        <TableSkeleton columns={5} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="receipt" title={rows.length ? t("No contract prices match") : t("No contract prices")} description={rows.length ? t("Try another search.") : t("Agreed prices for one customer and product go here.")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-start text-sm">
            <TableHead>
              <Th>{t("Customer")}</Th>
              <Th>{t("Product")}</Th>
              <Th align="right">{t("Catalog")}</Th>
              <Th align="right">{t("Contract")}</Th>
              <Th className="hidden xl:table-cell">{t("Note")}</Th>
              {canWrite && <Th align="right">{t("Actions")}</Th>}
            </TableHead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.id} className={rowClass} style={{ borderColor: "var(--border-color)" }}>
                  <td className="px-5 py-3.5">
                    <Link to={`/customers?view=${row.customer_id}`} className="font-medium hover:underline app-text">
                      {row.company_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 app-text">{row.product_name}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-end tabular-nums app-text-muted">{money(row.list_price)}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-end">
                    <p className="font-semibold tabular-nums app-text">{money(row.unit_price)}</p>
                    {row.list_price > 0 && <p className="text-xs tabular-nums app-text-muted">{Math.round((1 - row.unit_price / row.list_price) * 1000) / 10}% off</p>}
                  </td>
                  <td className="hidden px-5 py-3.5 text-xs app-text-muted xl:table-cell">
                    {row.note ?? ""}
                    <p>
                      {formatDate(row.updated_at)}
                      {row.created_by_name && `, ${row.created_by_name}`}
                    </p>
                  </td>
                  {canWrite && (
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        <IconAction icon="edit" label={t("Change {product} for {customer}", { product: row.product_name, customer: row.company_name })} onClick={() => setModal({ editing: row })} />
                        <IconAction icon="trash" label={t("Remove {product} for {customer}", { product: row.product_name, customer: row.company_name })} tone="danger" onClick={() => remove(row)} />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length > 0 && (
        <Pagination page={table.page} totalPages={table.totalPages} total={table.total} pageSize={table.pageSize} onPageChange={table.setPage} label={t("contract prices")} />
      )}
      <ContractPriceModal open={Boolean(modal)} editing={modal?.editing} onClose={() => setModal(null)} onSaved={reload} />
    </Card>
  );
}

export default function Pricing() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((option) => option.value === params.get("tab")) ? params.get("tab") : "lists";
  const canWrite = can(user, "pricing.write");

  return (
    <div className="space-y-6">
      <PageHeader title={t("Pricing")} description={t("A contract price wins. Otherwise: catalog price, less the price list, less the volume discount.")} />
      <SegmentedControl label={t("Pricing rules")} value={tab} onChange={(value) => setParams({ tab: value }, { replace: true })} options={TABS} />
      {tab === "lists" && <PriceLists canWrite={canWrite} />}
      {tab === "volume" && <VolumeDiscounts canWrite={canWrite} />}
      {tab === "contracts" && <ContractPrices canWrite={canWrite} />}
    </div>
  );
}
