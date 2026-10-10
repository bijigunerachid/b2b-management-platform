import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { Drawer, Modal } from "../components/ui/Modal";
import { useConfirm, useToast } from "../components/ui/feedback";
import {
  Avatar,
  Badge,
  Card,
  DetailItem,
  EmptyState,
  ErrorState,
  Field,
  IconAction,
  InlineAlert,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedControl,
  SortHeader,
  StatCard,
  Switch,
  TableHead,
  TableSkeleton,
  Th,
} from "../components/ui/primitives";
import { api, can, exportCsv, formatDate, initials, money, number, toList, useResource } from "../lib/api";
import { ORDER_STATUS } from "../lib/orderStatus";
import { paymentBadge } from "../lib/billing";
import PortalAccessPanel from "../components/PortalAccessPanel";
import CustomerPricingPanel from "../components/CustomerPricingPanel";
import HistoryPanel from "../components/HistoryPanel";
import SuggestedProducts from "../components/SuggestedProducts";
import useTable from "../lib/useTable";

import { t } from "../i18n";
const emptyForm = {
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "Morocco",
  email_language: "fr",
  payment_reminders: true,
};

const EMAIL_LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية" },
  { value: "en", label: "English" },
];

const accessors = {
  company: (customer) => customer.company_name,
  contact: (customer) => customer.contact_name,
  city: (customer) => customer.city,
  created: (customer) => new Date(customer.created_at).getTime() || 0,
};

function isThisMonth(value) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function CustomerDrawer({ customer, open, onClose, onEdit, onDelete, onChanged, user }) {
  const navigate = useNavigate();
  const { data, loading } = useResource(open && customer ? "/orders" : null);

  const orders = toList(data).filter((order) => Number(order.customer_id) === Number(customer?.id));
  const billable = orders.filter((order) => order.status !== "Cancelled");
  const lifetimeValue = billable.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const outstanding = billable.reduce((sum, order) => sum + (order.billing?.balance ?? 0), 0);
  const overdue = billable.reduce((sum, order) => sum + (order.billing?.overdue ? order.billing.balance : 0), 0);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={customer?.company_name ?? ""}
      description={customer ? t("Customer #{id} · since {date}", { id: customer.id, date: formatDate(customer.created_at) }) : ""}
      footer={
        customer && (
          <>
            {can(user, "customers.delete") && (
              <Button variant="danger-ghost" icon="trash" onClick={() => onDelete(customer)} className="me-auto">
                {t("Delete")}
              </Button>
            )}
            {can(user, "customers.write") && (
              <Button icon="edit" onClick={() => onEdit(customer)}>
                {t("Edit")}
              </Button>
            )}
            {can(user, "quotes.write") && (
              <Button icon="fileText" onClick={() => navigate(`/quotes?new=1&customer=${customer.id}`)}>
                {t("New quote")}
              </Button>
            )}
            {can(user, "orders.write") && (
              <Button variant="primary" icon="plus" onClick={() => navigate(`/orders?new=1&customer=${customer.id}`)}>
                {t("New order")}
              </Button>
            )}
          </>
        )
      }
    >
      {customer && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar label={initials(customer.company_name)} seed={customer.id} size={56} rounded="rounded-2xl" />
            <div className="min-w-0">
              <p className="text-lg font-bold app-text">{customer.contact_name || "No contact"}</p>
              <p className="text-sm app-text-secondary">{t("Primary contact")}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t("Orders"), value: loading ? "..." : orders.length },
              { label: t("Lifetime value (HT)"), value: loading ? "..." : money(lifetimeValue) },
              {
                label: t("Outstanding"),
                value: loading ? "..." : money(outstanding),
                danger: overdue > 0,
                hint: overdue > 0 ? t("{amount} overdue", { amount: money(overdue) }) : null,
              },
              {
                label: t("Last order"),
                value: loading ? "..." : orders[0] ? formatDate(orders[0].created_at) : "—",
              },
            ].map((item) => (
              <div key={item.label} className="rounded-xl p-3 app-muted">
                <p className="text-[11px] font-medium uppercase tracking-wide app-text-muted">{item.label}</p>
                <p className="mt-1 truncate text-sm font-bold app-text" style={item.danger ? { color: "var(--danger)" } : undefined}>
                  {item.value}
                </p>
                {item.hint && <p className="truncate text-[11px] font-medium" style={{ color: "var(--danger)" }}>{item.hint}</p>}
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailItem icon="mail" label={t("Email")}>
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="hover:underline" style={{ color: "var(--primary)" }}>
                  {customer.email}
                </a>
              )}
            </DetailItem>
            <DetailItem icon="phone" label={t("Phone")}>
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="hover:underline">
                  {customer.phone}
                </a>
              )}
            </DetailItem>
            <DetailItem icon="mapPin" label={t("City")}>
              {customer.city}
            </DetailItem>
            <DetailItem icon="globe" label={t("Country")}>
              {customer.country}
            </DetailItem>
            <div className="sm:col-span-2">
              <DetailItem icon="building" label={t("Address")}>
                {customer.address}
              </DetailItem>
            </div>
          </div>

          {can(user, "pricing.view") && <CustomerPricingPanel customer={customer} canManage={can(user, "pricing.write")} onChanged={onChanged} />}

          <PortalAccessPanel customer={customer} canManage={can(user, "portal.manage")} />

          <SuggestedProducts customer={customer} />

          <div>
            <h3 className="mb-3 text-sm font-bold app-text">{t("Order history")}</h3>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="skeleton h-14 rounded-xl" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm app-text-secondary" style={{ borderColor: "var(--border-strong)" }}>
                {t("No orders from this customer yet.")}
              </div>
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
                {orders.map((order) => (
                  <li key={order.id} style={{ borderColor: "var(--border-color)" }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/orders?view=${order.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-[var(--surface-hover)]"
                    >
                      <span className="text-sm font-bold app-text">#{order.id}</span>
                      <span className="flex-1 text-xs app-text-muted">{formatDate(order.created_at)}</span>
                      <Badge tone={ORDER_STATUS[order.status]?.tone} dot>
                        {order.status}
                      </Badge>
                      {order.billing?.overdue && (
                        <Badge tone="danger" icon="alert">
                          {paymentBadge(order.billing).label}
                        </Badge>
                      )}
                      <span className="w-28 text-end text-sm font-semibold tabular-nums app-text">{money(order.total_amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {can(user, "audit.view") && <HistoryPanel entityType="customer" entityId={customer.id} />}
        </div>
      )}
    </Drawer>
  );
}

export default function Customers() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();

  const { data, loading, error, reload } = useResource("/customers");
  const customers = useMemo(() => toList(data, "customers"), [data]);

  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [view, setView] = useState("table");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const canWrite = can(user, "customers.write");
  const canDelete = can(user, "customers.delete");

  // ?new=1 opens the form, ?view=<id> opens a profile
  const createRequested = params.get("new") === "1" && canWrite;
  const viewId = params.get("view");
  const viewed = customers.find((customer) => String(customer.id) === viewId) ?? null;

  // Keep the last profile rendered while the drawer animates closed.
  const [lastViewed, setLastViewed] = useState(null);
  if (viewed && viewed !== lastViewed) setLastViewed(viewed);

  function updateParams(changes) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  }

  const countries = useMemo(
    () => [...new Set(customers.map((customer) => customer.country).filter(Boolean))].sort(),
    [customers]
  );

  const priceListFilter = params.get("price_list");
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((customer) => {
      if (priceListFilter && String(customer.price_list_id) !== priceListFilter) return false;
      const matchesCountry = country === "all" || customer.country === country;
      const matchesSearch =
        !term ||
        [customer.company_name, customer.contact_name, customer.email, customer.phone, customer.city]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(term);
      return matchesCountry && matchesSearch;
    });
  }, [customers, search, country, priceListFilter]);

  const table = useTable(filtered, {
    accessors,
    initialSort: { key: "created", direction: "desc" },
    pageSize: view === "grid" ? 12 : 10,
  });

  const cities = new Set(customers.map((customer) => customer.city?.trim().toLowerCase()).filter(Boolean)).size;
  const newThisMonth = customers.filter((customer) => isThisMonth(customer.created_at)).length;

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(customer) {
    setEditing(customer);
    setForm({
      company_name: customer.company_name || "",
      contact_name: customer.contact_name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      city: customer.city || "",
      country: customer.country || "Morocco",
      email_language: customer.email_language || "fr",
      payment_reminders: customer.payment_reminders === undefined ? true : Boolean(Number(customer.payment_reminders)),
    });
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    if (createRequested) updateParams({ new: null });
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");
    setSaving(true);

    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]));
    const isEditing = editing !== null && !createRequested;

    try {
      await api(isEditing ? `/customers/${editing.id}` : "/customers", {
        method: isEditing ? "PUT" : "POST",
        body: payload,
      });

      setFormOpen(false);
      if (createRequested) updateParams({ new: null });
      toast.success(
        isEditing ? t("{name} was updated.", { name: payload.company_name }) : t("{name} was added to your customers.", { name: payload.company_name }),
        { title: isEditing ? t("Customer updated") : t("Customer created") }
      );
      reload();
    } catch (err) {
      setFormError(err.message || t("Unable to save customer."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(customer) {
    const confirmed = await confirm({
      title: t("Delete {name}?", { name: customer.company_name }),
      message: t("This permanently removes the customer. Customers with existing orders cannot be deleted."),
      confirmLabel: t("Delete customer"),
    });

    if (!confirmed) return;

    try {
      await api(`/customers/${customer.id}`, { method: "DELETE" });
      if (viewId === String(customer.id)) updateParams({ view: null });
      toast.success(t("{name} was deleted.", { name: customer.company_name }));
      reload();
    } catch (err) {
      toast.error(err.message || t("Unable to delete customer."), { title: t("Delete failed") });
    }
  }

  function handleExport() {
    exportCsv(
      "customers",
      [
        ["ID", (c) => c.id],
        [t("Company"), (c) => c.company_name],
        [t("Contact"), (c) => c.contact_name],
        [t("Email"), (c) => c.email],
        [t("Phone"), (c) => c.phone],
        [t("Address"), (c) => c.address],
        [t("City"), (c) => c.city],
        [t("Country"), (c) => c.country],
        [t("Created"), (c) => c.created_at],
      ],
      table.sorted
    );
    toast.info(t("Exported {count} customers to CSV.", { count: table.sorted.length }));
  }

  const isEditing = editing !== null && !createRequested;
  const searching = Boolean(search.trim()) || country !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Customers")}
        actions={
          <>
            <Button icon="download" onClick={handleExport} disabled={filtered.length === 0}>
              {t("Export")}
            </Button>
            {canWrite && (
              <Button variant="primary" icon="plus" onClick={openCreate}>
                {t("Add customer")}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("Total customers")} value={number(customers.length)} icon="customers" loading={loading && !data} />
        <StatCard label={t("New this month")} value={number(newThisMonth)} icon="sparkles" tone="success" loading={loading && !data} />
        <StatCard label={t("Cities")} value={number(cities)} icon="mapPin" tone="warning" loading={loading && !data} />
        <StatCard label={t("Countries")} value={number(countries.length)} icon="globe" tone="info" loading={loading && !data} />
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}

      {priceListFilter && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface)" }}>
          <span className="app-text-secondary">
            {t("Showing customers on the {list} price list", { list: customers.find((customer) => String(customer.price_list_id) === priceListFilter)?.price_list_name ?? t("selected") })}
          </span>
          <Button size="sm" variant="ghost" icon="close" onClick={() => updateParams({ price_list: null })}>
            {t("Show all")}
          </Button>
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center" style={{ borderColor: "var(--border-color)" }}>
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              table.setPage(1);
            }}
            placeholder={t("Search company, contact, email, city...")}
            className="lg:w-80"
          />
          <select
            value={country}
            onChange={(event) => {
              setCountry(event.target.value);
              table.setPage(1);
            }}
            aria-label={t("Filter by country")}
            className="app-input h-10 py-0 lg:w-48"
          >
            <option value="all">{t("All countries")}</option>
            {countries.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 lg:ms-auto">
            <SegmentedControl
              label={t("Layout")}
              value={view}
              onChange={setView}
              options={[
                { value: "table", label: <Icon name="list" size={16} /> },
                { value: "grid", label: <Icon name="grid" size={16} /> },
              ]}
            />
            <Button size="icon" variant="ghost" icon="refresh" onClick={reload} aria-label={t("Refresh")} title={t("Refresh")} className={loading ? "[&_svg]:animate-spin" : ""} />
          </div>
        </div>

        {loading && !data ? (
          <TableSkeleton columns={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={searching ? "search" : "customers"}
            title={searching ? t("No matching customers") : t("No customers yet")}
            description={
              searching
                ? t("Try a different search term or country.")
                : t("Add your first customer to start building your business directory.")
            }
            action={
              searching ? (
                <Button
                  onClick={() => {
                    setSearch("");
                    setCountry("all");
                  }}
                >
                  {t("Clear filters")}
                </Button>
              ) : (
                canWrite && (
                  <Button variant="primary" icon="plus" onClick={openCreate}>
                    {t("Add your first customer")}
                  </Button>
                )
              )
            }
          />
        ) : view === "grid" ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {table.rows.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => updateParams({ view: customer.id })}
                className="group rounded-xl border p-4 text-start transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-md"
                style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface)" }}
              >
                <div className="flex items-start gap-3">
                  <Avatar label={initials(customer.company_name)} seed={customer.id} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold app-text group-hover:text-[var(--primary)]">{customer.company_name}</p>
                    <p className="truncate text-sm app-text-secondary">{customer.contact_name || "No contact"}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5 text-sm app-text-secondary">
                  <p className="flex items-center gap-2 truncate">
                    <Icon name="mail" size={14} /> {customer.email || "—"}
                  </p>
                  <p className="flex items-center gap-2 truncate">
                    <Icon name="mapPin" size={14} /> {[customer.city, customer.country].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-start text-sm">
              <TableHead>
                <SortHeader label={t("Company")} column="company" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label={t("Contact")} column="contact" sort={table.sort} onSort={table.toggleSort} />
                <Th>{t("Email & phone")}</Th>
                <SortHeader label={t("Location")} column="city" sort={table.sort} onSort={table.toggleSort} />
                <SortHeader label={t("Since")} column="created" sort={table.sort} onSort={table.toggleSort} />
                <Th align="right">{t("Actions")}</Th>
              </TableHead>
              <tbody>
                {table.rows.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => updateParams({ view: customer.id })}
                    className="cursor-pointer border-t transition-colors hover:bg-[var(--surface-hover)]"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar label={initials(customer.company_name)} seed={customer.id} />
                        <div className="min-w-0">
                          <p className="max-w-[220px] truncate font-semibold app-text">{customer.company_name}</p>
                          <p className="text-xs app-text-muted">#{customer.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 app-text">{customer.contact_name || "—"}</td>
                    <td className="px-5 py-3.5">
                      <p className="max-w-[220px] truncate app-text">{customer.email || "—"}</p>
                      <p className="text-xs app-text-muted">{customer.phone || "—"}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="app-text">{customer.city || "—"}</p>
                      <p className="text-xs app-text-muted">{customer.country}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 app-text-secondary">{formatDate(customer.created_at)}</td>
                    <td className="px-5 py-3.5" onClick={(event) => event.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <IconAction icon="eye" label={t("View profile")} onClick={() => updateParams({ view: customer.id })} />
                        {canWrite && <IconAction icon="edit" label={t("Edit customer")} onClick={() => openEdit(customer)} />}
                        {canDelete && <IconAction icon="trash" label={t("Delete customer")} tone="danger" onClick={() => handleDelete(customer)} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <Pagination
            page={table.page}
            totalPages={table.totalPages}
            total={table.total}
            pageSize={table.pageSize}
            onPageChange={table.setPage}
            label={t("customers")}
          />
        )}
      </Card>

      <CustomerDrawer
        customer={viewed ?? lastViewed}
        open={Boolean(viewed)}
        onClose={() => updateParams({ view: null })}
        onEdit={openEdit}
        onDelete={handleDelete}
        onChanged={reload}
        user={user}
      />

      <Modal
        open={formOpen || createRequested}
        onClose={closeForm}
        busy={saving}
        size="lg"
        icon={isEditing ? "edit" : "userPlus"}
        title={isEditing ? t("Edit {name}", { name: editing.company_name }) : t("Add a new customer")}
        description={isEditing ? t("Update this account's company and contact information.") : t("Create a business account to start taking orders.")}
        footer={
          <>
            <Button onClick={closeForm} disabled={saving}>
              {t("Cancel")}
            </Button>
            <Button type="submit" form="customer-form" variant="primary" loading={saving} icon="check">
              {isEditing ? t("Save changes") : t("Create customer")}
            </Button>
          </>
        }
      >
        <form id="customer-form" onSubmit={handleSubmit} className="space-y-6">
          <InlineAlert>{formError}</InlineAlert>

          <fieldset>
            <legend className="mb-3 flex items-center gap-2 text-sm font-semibold app-text">
              <Icon name="building" size={16} className="app-text-muted" /> Company & contact
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Company name")} required>
                {(id) => <input id={id} name="company_name" value={form.company_name} onChange={handleChange} required minLength={2} maxLength={150} placeholder={t("e.g. Atlas Solutions")} className="app-input" />}
              </Field>
              <Field label={t("Contact name")} required>
                {(id) => <input id={id} name="contact_name" value={form.contact_name} onChange={handleChange} required minLength={2} maxLength={150} placeholder={t("Full name")} className="app-input" />}
              </Field>
              <Field label={t("Email address")}>
                {(id) => <input id={id} name="email" type="email" value={form.email} onChange={handleChange} placeholder={t("contact@company.com")} className="app-input" />}
              </Field>
              <Field label={t("Phone number")}>
                {(id) => <input id={id} name="phone" type="tel" value={form.phone} onChange={handleChange} maxLength={30} placeholder="+212 6..." className="app-input" />}
              </Field>
            </div>
          </fieldset>

          <fieldset className="border-t pt-5" style={{ borderColor: "var(--border-color)" }}>
            <legend className="sr-only">{t("Location")}</legend>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold app-text">
              <Icon name="mapPin" size={16} className="app-text-muted" /> {t("Location")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("City")}>
                {(id) => <input id={id} name="city" value={form.city} onChange={handleChange} maxLength={100} placeholder={t("e.g. Agadir")} className="app-input" />}
              </Field>
              <Field label={t("Country")}>
                {(id) => <input id={id} name="country" value={form.country} onChange={handleChange} maxLength={100} list="country-options" className="app-input" />}
              </Field>
              <Field label={t("Full address")} className="sm:col-span-2">
                {(id) => <textarea id={id} name="address" value={form.address} onChange={handleChange} rows={2} maxLength={255} placeholder={t("Street, building, postal code...")} className="app-input resize-y" />}
              </Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label={t("Email language")} hint={t("Quotes, invoices and reminders are written in this language")}>
                {(id) => (
                  <select id={id} name="email_language" value={form.email_language} onChange={handleChange} className="app-input">
                    {EMAIL_LANGUAGES.map((language) => (
                      <option key={language.value} value={language.value}>
                        {language.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <div className="flex items-center gap-3 sm:pt-6">
                <Switch
                  checked={form.payment_reminders}
                  onChange={(checked) => setForm((previous) => ({ ...previous, payment_reminders: checked }))}
                  label={t("Send payment reminders before invoices fall due")}
                />
                <span className="text-sm app-text-secondary">{t("Send payment reminders before invoices fall due")}</span>
              </div>
            </div>
            <datalist id="country-options">
              {countries.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </fieldset>
        </form>
      </Modal>
    </div>
  );
}
