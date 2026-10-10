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
    if (!Number.isInteger(lead) || lead < 0 || lead > 365) return setFormError("Lead time must be between 0 and 365 days.");

    setSaving(true);
    try {
      const body = { ...form, lead_time_days: lead, name: form.name.trim() };
      for (const key of ["contact_name", "email", "phone", "city", "notes"]) {
        if (!body[key].trim()) delete body[key];
      }
      await api(isEditing ? `/suppliers/${editing.id}` : "/suppliers", { method: isEditing ? "PUT" : "POST", body });
      toast.success(`${body.name} was ${isEditing ? "updated" : "added"}.`);
      // closeForm() ignores calls while saving, so close directly here.
      setFormOpen(false);
      if (createRequested) {
        const next = new URLSearchParams(params);
        next.delete("new");
        setParams(next, { replace: true });
      }
      reload();
    } catch (err) {
      setFormError(err.message || "Could not save the supplier.");
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
      toast.success(`${supplier.name} is now ${nextActive ? "active" : "inactive"}.`);
      reload();
    } catch (err) {
      toast.error(err.message || "Could not update the supplier.");
    }
  }

  async function handleDelete(supplier) {
    const confirmed = await confirm({
      title: `Delete ${supplier.name}?`,
      message: "Products using it as preferred supplier will be unassigned. Suppliers with purchase orders can't be deleted; deactivate them instead.",
      confirmLabel: "Delete supplier",
    });
    if (!confirmed) return;

    try {
      await api(`/suppliers/${supplier.id}`, { method: "DELETE" });
      toast.success(`${supplier.name} was deleted.`);
      reload();
    } catch (err) {
      toast.error(err.message || "Could not delete the supplier.", { title: "Not deleted" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        actions={
          canWrite && (
            <Button variant="primary" icon="plus" onClick={() => openForm()}>
              Add supplier
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active suppliers" value={number(active.length)} hint={`${suppliers.length - active.length} inactive`} icon="building" loading={loading && !data} />
        <StatCard label="On order" value={compactMoney(openValue)} icon="truck" tone="info" loading={loading && !data} />
        <StatCard label="Average lead time" value={`${averageLead} days`} hint="Across active suppliers" icon="clock" tone="warning" loading={loading && !data} />
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}

      <Card>
        <div className="border-b p-4" style={{ borderColor: "var(--border-color)" }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, contact, or city..." className="sm:w-80" />
        </div>

        {loading && !data ? (
          <TableSkeleton columns={6} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={suppliers.length ? "search" : "building"}
            title={suppliers.length ? "No suppliers match" : "No suppliers yet"}
            description={suppliers.length ? "Try another search." : "Add the companies you buy stock from."}
            action={!suppliers.length && canWrite && <Button variant="primary" icon="plus" onClick={() => openForm()}>Add supplier</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <TableHead>
                <Th>Supplier</Th>
                <Th>Lead time</Th>
                <Th align="right">Products</Th>
                <Th align="right">On order</Th>
                <Th>Last order</Th>
                <Th>Active</Th>
                <Th align="right">Actions</Th>
              </TableHead>
              <tbody>
                {filtered.map((supplier) => (
                  <tr key={supplier.id} className="border-t transition-colors hover:bg-[var(--surface-hover)]" style={{ borderColor: "var(--border-color)" }}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar label={initials(supplier.name)} seed={supplier.id} size={36} />
                        <div className="min-w-0">
                          <p className={`max-w-[220px] truncate font-semibold ${supplier.is_active ? "app-text" : "app-text-muted line-through"}`}>{supplier.name}</p>
                          <p className="max-w-[220px] truncate text-xs app-text-muted">
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
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      <Link to={`/products?supplier=${supplier.id}`} className="font-semibold hover:underline app-text">
                        {number(supplier.product_count)}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-right">
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
                        <Switch size="sm" checked={Boolean(supplier.is_active)} onChange={(next) => toggleActive(supplier, next)} label={supplier.is_active ? `Deactivate ${supplier.name}` : `Activate ${supplier.name}`} />
                      ) : (
                        <Badge tone={supplier.is_active ? "success" : "neutral"} dot>
                          {supplier.is_active ? "Active" : "Inactive"}
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1">
                        {canWrite && <IconAction icon="edit" label={`Edit ${supplier.name}`} onClick={() => openForm(supplier)} />}
                        {canDelete && <IconAction icon="trash" label={`Delete ${supplier.name}`} tone="danger" onClick={() => handleDelete(supplier)} />}
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
        title={isEditing ? `Edit ${editing.name}` : "Add a supplier"}
        footer={
          <>
            <Button onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="supplier-form" variant="primary" loading={saving} icon="check">
              {isEditing ? "Save changes" : "Add supplier"}
            </Button>
          </>
        }
      >
        <form id="supplier-form" onSubmit={handleSubmit} className="space-y-4">
          <InlineAlert>{formError}</InlineAlert>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" required className="sm:col-span-2">
              {(id) => <input id={id} value={form.name} onChange={update("name")} required minLength={2} maxLength={150} className="app-input" />}
            </Field>
            <Field label="Contact name">
              {(id) => <input id={id} value={form.contact_name} onChange={update("contact_name")} maxLength={150} className="app-input" />}
            </Field>
            <Field label="Lead time (days)" required hint="Typical time from order to delivery">
              {(id) => <input id={id} type="number" min="0" max="365" value={form.lead_time_days} onChange={update("lead_time_days")} required className="app-input tabular-nums" />}
            </Field>
            <Field label="Email">
              {(id) => <input id={id} type="email" value={form.email} onChange={update("email")} maxLength={255} className="app-input" />}
            </Field>
            <Field label="Phone">
              {(id) => <input id={id} type="tel" value={form.phone} onChange={update("phone")} maxLength={30} className="app-input" />}
            </Field>
            <Field label="City">
              {(id) => <input id={id} value={form.city} onChange={update("city")} maxLength={100} className="app-input" />}
            </Field>
            <Field label="Country">
              {(id) => <input id={id} value={form.country} onChange={update("country")} maxLength={100} className="app-input" />}
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              {(id) => <textarea id={id} value={form.notes} onChange={update("notes")} rows={2} maxLength={1000} placeholder="Payment terms, minimum order..." className="app-input resize-y" />}
            </Field>
          </div>
        </form>
      </Modal>
    </div>
  );
}
