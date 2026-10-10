import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { useConfirm, useToast } from "../components/ui/feedback";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Field,
  IconAction,
  InlineAlert,
  PageHeader,
  SearchInput,
  StatCard,
  Switch,
  TableHead,
  TableSkeleton,
  Th,
} from "../components/ui/primitives";
import { api, can, compactMoney, formatDate, initials, number, toList, useResource } from "../lib/api";

import { t } from "../i18n";
const emptyForm = { name: "", contact_name: "", email: "", phone: "", city: "", country: "Morocco", lead_time_days: "7", notes: "", is_active: true };

export default function Suppliers() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const canWrite = can(user, "suppliers.write");
  const canDelete = can(user, "suppliers.delete");

  const { data, loading, error, reload } = useResource("/suppliers");
  const suppliers = useMemo(() => toList(data), [data]);

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const createRequested = params.get("new") === "1" && canWrite;
  const isEditing = editing !== null && !createRequested;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return suppliers.filter((supplier) => !term || `${supplier.name} ${supplier.contact_name ?? ""} ${supplier.city ?? ""}`.toLowerCase().includes(term));
  }, [suppliers, search]);

  const active = suppliers.filter((supplier) => supplier.is_active);
  const openValue = suppliers.reduce((sum, supplier) => sum + Number(supplier.open_value), 0);
  const averageLead = active.length ? Math.round(active.reduce((sum, supplier) => sum + supplier.lead_time_days, 0) / active.length) : 0;

  function openForm(supplier = null) {
    setEditing(supplier);
    setForm(
      supplier
        ? {
            name: supplier.name,
            contact_name: supplier.contact_name ?? "",
            email: supplier.email ?? "",
            phone: supplier.phone ?? "",
            city: supplier.city ?? "",
            country: supplier.country ?? "Morocco",
            lead_time_days: String(supplier.lead_time_days),
            notes: supplier.notes ?? "",
            is_active: Boolean(supplier.is_active),
          }
        : emptyForm
    );
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    if (createRequested) {
      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next, { replace: true });
    }
  }

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    const lead = Number(form.lead_time_days);
    if (!Number.isInteger(lead) || lead < 0 || lead > 365) return setFormError(t("Lead time must be between 0 and 365 days."));

    setSaving(true);
    try {
      const body = { ...form, lead_time_days: lead, name: form.name.trim() };
      for (const key of ["contact_name", "email", "phone", "city", "notes"]) {
        if (!body[key].trim()) delete body[key];
      }
      await api(isEditing ? `/suppliers/${editing.id}` : "/suppliers", { method: isEditing ? "PUT" : "POST", body });
      toast.success(isEditing ? t("{name} was updated.", { name: body.name }) : t("{name} was added.", { name: body.name }));
      // closeForm() ignores calls while saving, so close directly here.
      setFormOpen(false);
      if (createRequested) {
        const next = new URLSearchParams(params);
        next.delete("new");
        setParams(next, { replace: true });
      }
      reload();
    } catch (err) {
      setFormError(err.message || t("Could not save the supplier."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(supplier, nextActive) {
    try {
      await api(`/suppliers/${supplier.id}`, {
        method: "PUT",
        body: {
          name: supplier.name,
          lead_time_days: supplier.lead_time_days,
          country: supplier.country,
          ...Object.fromEntries(["contact_name", "email", "phone", "city", "notes"].filter((key) => supplier[key]).map((key) => [key, supplier[key]])),
          is_active: nextActive,
        },
      });
      toast.success(nextActive ? t("{name} is now active.", { name: supplier.name }) : t("{name} is now inactive.", { name: supplier.name }));
      reload();
    } catch (err) {
      toast.error(err.message || t("Could not update the supplier."));
    }
  }

  async function handleDelete(supplier) {
    const confirmed = await confirm({
      title: t("Delete {name}?", { name: supplier.name }),
      message: t("Products using it as preferred supplier will be unassigned. Suppliers with purchase orders can't be deleted; deactivate them instead."),
      confirmLabel: t("Delete supplier"),
    });
    if (!confirmed) return;

    try {
      await api(`/suppliers/${supplier.id}`, { method: "DELETE" });
      toast.success(t("{name} was deleted.", { name: supplier.name }));
      reload();
    } catch (err) {
      toast.error(err.message || t("Could not delete the supplier."), { title: t("Not deleted") });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Suppliers")}
        actions={
          canWrite && (
            <Button variant="primary" icon="plus" onClick={() => openForm()}>
              {t("Add supplier")}
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("Active suppliers")} value={number(active.length)} hint={t("{count} inactive", { count: suppliers.length - active.length })} icon="building" loading={loading && !data} />
        <StatCard label={t("On order")} value={compactMoney(openValue)} icon="truck" tone="info" loading={loading && !data} />
        <StatCard label={t("Average lead time")} value={t("{count} days", { count: averageLead })} hint={t("Across active suppliers")} icon="clock" tone="warning" loading={loading && !data} />
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}

      <Card>
        <div className="border-b p-4" style={{ borderColor: "var(--border-color)" }}>
          <SearchInput value={search} onChange={setSearch} placeholder={t("Search name, contact, or city...")} className="sm:w-80" />
        </div>

        {loading && !data ? (
          <TableSkeleton columns={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={suppliers.length ? "search" : "building"}
            title={suppliers.length ? t("No suppliers match") : t("No suppliers yet")}
            description={suppliers.length ? t("Try another search.") : t("Add the companies you buy stock from.")}
            action={!suppliers.length && canWrite && <Button variant="primary" icon="plus" onClick={() => openForm()}>{t("Add supplier")}</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-start text-sm">
              <TableHead>
                <Th>{t("Supplier")}</Th>
                <Th>{t("Lead time")}</Th>
                <Th align="right">{t("Products")}</Th>
                <Th align="right">{t("On order")}</Th>
                <Th>{t("Last order")}</Th>
                <Th>{t("Active")}</Th>
                <Th align="right">{t("Actions")}</Th>
              </TableHead>
              <tbody>
                {filtered.map((supplier) => (
                  <tr key={supplier.id} className="border-t transition-colors hover:bg-[var(--surface-hover)]" style={{ borderColor: "var(--border-color)" }}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar label={initials(supplier.name)} seed={supplier.id} size={36} />
                        <div className="min-w-0">
                          <p className={`max-w-[180px] truncate font-semibold ${supplier.is_active ? "app-text" : "app-text-muted line-through"}`} title={supplier.name} dir="auto">{supplier.name}</p>
                          <p className="max-w-[180px] truncate text-xs app-text-muted">
                            {[supplier.contact_name, supplier.city, supplier.country].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={supplier.lead_time_days > 10 ? "warning" : "neutral"} icon="clock">
                        {supplier.lead_time_days} days
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-end tabular-nums">
                      <Link to={`/products?supplier=${supplier.id}`} className="font-semibold hover:underline app-text">
                        {number(supplier.product_count)}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-end">
                      {Number(supplier.open_orders) > 0 ? (
                        <Link to="/purchase-orders" className="hover:underline">
                          <span className="font-semibold tabular-nums app-text">{compactMoney(supplier.open_value)}</span>
                          <span className="block text-xs app-text-muted">{supplier.open_orders} order{Number(supplier.open_orders) === 1 ? "" : "s"}</span>
                        </Link>
                      ) : (
                        <span className="app-text-muted">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 app-text-secondary">{supplier.last_order_at ? formatDate(supplier.last_order_at) : "—"}</td>
                    <td className="px-5 py-3.5">
                      {canWrite ? (
                        <Switch size="sm" checked={Boolean(supplier.is_active)} onChange={(next) => toggleActive(supplier, next)} label={supplier.is_active ? t("Deactivate {name}", { name: supplier.name }) : t("Activate {name}", { name: supplier.name })} />
                      ) : (
                        <Badge tone={supplier.is_active ? "success" : "neutral"} dot>
                          {supplier.is_active ? t("Active") : t("Inactive")}
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        {canWrite && <IconAction icon="edit" label={t("Edit {name}", { name: supplier.name })} onClick={() => openForm(supplier)} />}
                        {canDelete && <IconAction icon="trash" label={t("Delete {name}", { name: supplier.name })} tone="danger" onClick={() => handleDelete(supplier)} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={formOpen || createRequested}
        onClose={closeForm}
        busy={saving}
        size="lg"
        icon="building"
        title={isEditing ? t("Edit {name}", { name: editing.name }) : t("Add a supplier")}
        footer={
          <>
            <Button onClick={closeForm} disabled={saving}>
              {t("Cancel")}
            </Button>
            <Button type="submit" form="supplier-form" variant="primary" loading={saving} icon="check">
              {isEditing ? t("Save changes") : t("Add supplier")}
            </Button>
          </>
        }
      >
        <form id="supplier-form" onSubmit={handleSubmit} className="space-y-4">
          <InlineAlert>{formError}</InlineAlert>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Company name")} required className="sm:col-span-2">
              {(id) => <input id={id} value={form.name} onChange={update("name")} required minLength={2} maxLength={150} className="app-input" />}
            </Field>
            <Field label={t("Contact name")}>
              {(id) => <input id={id} value={form.contact_name} onChange={update("contact_name")} maxLength={150} className="app-input" />}
            </Field>
            <Field label={t("Lead time (days)")} required hint={t("Typical time from order to delivery")}>
              {(id) => <input id={id} type="number" min="0" max="365" value={form.lead_time_days} onChange={update("lead_time_days")} required className="app-input tabular-nums" />}
            </Field>
            <Field label={t("Email")}>
              {(id) => <input id={id} type="email" value={form.email} onChange={update("email")} maxLength={255} className="app-input" />}
            </Field>
            <Field label={t("Phone")}>
              {(id) => <input id={id} type="tel" value={form.phone} onChange={update("phone")} maxLength={30} className="app-input" />}
            </Field>
            <Field label={t("City")}>
              {(id) => <input id={id} value={form.city} onChange={update("city")} maxLength={100} className="app-input" />}
            </Field>
            <Field label={t("Country")}>
              {(id) => <input id={id} value={form.country} onChange={update("country")} maxLength={100} className="app-input" />}
            </Field>
            <Field label={t("Notes")} className="sm:col-span-2">
              {(id) => <textarea id={id} value={form.notes} onChange={update("notes")} rows={2} maxLength={1000} placeholder={t("Payment terms, minimum order...")} className="app-input resize-y" />}
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}
