import { useEffect, useState } from "react";

const API_URL = "http://localhost:5000/api/customers";

const emptyForm = {
company_name: "",
contact_name: "",
email: "",
phone: "",
address: "",
city: "",
country: "Morocco",
};

const inputClass =
"app-input w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-blue-500/20";

const panelStyle = {
backgroundColor: "var(--surface)",
borderColor: "var(--border-color)",
boxShadow: "var(--card-shadow)",
};

const mutedText = { color: "var(--text-secondary)" };
const primaryText = { color: "var(--text-primary)" };

function StatCard({ label, value, description, icon, accent }) {
return ( <div
   className="rounded-2xl border p-5 transition duration-200 hover:-translate-y-0.5"
   style={panelStyle}
 > <div className="flex items-start justify-between gap-3"> <div> <p className="text-sm font-medium" style={mutedText}>
{label} </p> <p
         className="mt-3 text-3xl font-bold tracking-tight"
         style={primaryText}
       >
{value} </p> <p className="mt-2 text-xs" style={mutedText}>
{description} </p> </div>


    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
      style={{
        backgroundColor: accent.background,
        color: accent.color,
      }}
    >
      {icon}
    </div>
  </div>
</div>


);
}

function Field({ label, required = false, children }) {
return ( <div> <label className="mb-1.5 block text-sm font-medium" style={primaryText}>
{label}
{required && <span className="ml-1 text-red-500">*</span>} </label>
{children} </div>
);
}

function Notice({ type, children, onClose }) {
const isError = type === "error";

return (
<div
role={isError ? "alert" : "status"}
className="flex items-start justify-between gap-3 rounded-xl border p-4 text-sm"
style={{
backgroundColor: isError
? "var(--danger-soft)"
: "var(--success-soft)",
borderColor: isError
? "var(--danger)"
: "var(--success)",
color: isError ? "var(--danger)" : "var(--success)",
}}
> <div className="flex items-start gap-2.5"> <span className="font-bold">{isError ? "!" : "✓"}</span> <span>{children}</span> </div>


  <button
    type="button"
    onClick={onClose}
    className="shrink-0 rounded-md px-1 font-semibold opacity-70 hover:opacity-100"
    aria-label="Dismiss notification"
  >
    ×
  </button>
</div>


);
}

function EmptyState({ searching, onAdd }) {
return ( <div className="flex flex-col items-center px-5 py-14 text-center">
<div
className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
style={{
backgroundColor: "var(--primary-soft)",
color: "var(--primary)",
}}
> <svg
       width="30"
       height="30"
       viewBox="0 0 24 24"
       fill="none"
       stroke="currentColor"
       strokeWidth="1.6"
       aria-hidden="true"
     > <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /> <circle cx="10" cy="7" r="4" /> <path d="M20 8v6m3-3h-6" /> </svg> </div>


  <h3 className="text-base font-semibold" style={primaryText}>
    {searching ? "No matching customers" : "No customers yet"}
  </h3>

  <p className="mt-2 max-w-sm text-sm" style={mutedText}>
    {searching
      ? "Try a different company name, contact, email, phone, or city."
      : "Add your first customer to start building your business directory."}
  </p>

  {!searching && (
    <button
      type="button"
      onClick={onAdd}
      className="mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
      style={{ backgroundColor: "var(--primary)" }}
    >
      + Add your first customer
    </button>
  )}
</div>


);
}

export default function Customers() {
const [customers, setCustomers] = useState([]);
const [search, setSearch] = useState("");
const [form, setForm] = useState(emptyForm);
const [editingId, setEditingId] = useState(null);
const [modalOpen, setModalOpen] = useState(false);

const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [deletingId, setDeletingId] = useState(null);

const [error, setError] = useState("");
const [success, setSuccess] = useState("");

async function request(url, options = {}) {
const response = await fetch(url, {
...options,
credentials: "include",
headers: {
...(options.body
? { "Content-Type": "application/json" }
: {}),
...options.headers,
},
});


const result = await response.json();

if (!response.ok) {
  throw new Error(result.message || "Request failed.");
}

return result;


}

async function loadCustomers() {
setLoading(true);
setError("");


try {
  const result = await request(API_URL);

  setCustomers(
    Array.isArray(result)
      ? result
      : result.data ?? result.customers ?? []
  );
} catch (err) {
  setError(err.message || "Unable to load customers.");
} finally {
  setLoading(false);
}


}

useEffect(() => {
loadCustomers();
}, []);

function openCreateModal() {
setForm({ ...emptyForm });
setEditingId(null);
setModalOpen(true);
setError("");
setSuccess("");
}

function openEditModal(customer) {
setForm({
company_name: customer.company_name || "",
contact_name: customer.contact_name || "",
email: customer.email || "",
phone: customer.phone || "",
address: customer.address || "",
city: customer.city || "",
country: customer.country || "Morocco",
});


setEditingId(customer.id);
setModalOpen(true);
setError("");
setSuccess("");


}

function closeModal() {
if (saving) return;


setModalOpen(false);
setEditingId(null);
setForm({ ...emptyForm });


}

function handleChange(event) {
const { name, value } = event.target;


setForm((previous) => ({
  ...previous,
  [name]: value,
}));


}

async function handleSubmit(event) {
event.preventDefault();
setError("");
setSuccess("");
setSaving(true);


try {
  const isEditing = editingId !== null;

  await request(
    isEditing ? `${API_URL}/${editingId}` : API_URL,
    {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify({
        ...form,
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
      }),
    }
  );

  closeModal();

  setSuccess(
    isEditing
      ? "Customer updated successfully."
      : "Customer created successfully."
  );

  await loadCustomers();
} catch (err) {
  setError(err.message || "Unable to save customer.");
} finally {
  setSaving(false);
}


}

async function handleDelete(customer) {
const confirmed = window.confirm(
`Delete "${customer.company_name}"? This action cannot be undone.`
);


if (!confirmed) return;

setError("");
setSuccess("");
setDeletingId(customer.id);

try {
  await request(`${API_URL}/${customer.id}`, {
    method: "DELETE",
  });

  setSuccess("Customer deleted successfully.");
  await loadCustomers();
} catch (err) {
  setError(err.message || "Unable to delete customer.");
} finally {
  setDeletingId(null);
}


}

const normalizedSearch = search.trim().toLowerCase();

const filteredCustomers = customers.filter((customer) =>
[
customer.company_name,
customer.contact_name,
customer.email,
customer.phone,
customer.city,
customer.country,
]
.filter(Boolean)
.join(" ")
.toLowerCase()
.includes(normalizedSearch)
);

const citiesCount = new Set(
customers
.map((customer) => customer.city?.trim().toLowerCase())
.filter(Boolean)
).size;

const countriesCount = new Set(
customers
.map((customer) => customer.country?.trim().toLowerCase())
.filter(Boolean)
).size;

const formatDate = (value) =>
new Intl.DateTimeFormat("en", {
weekday: "long",
day: "numeric",
month: "long",
year: "numeric",
}).format(value);

return ( <div className="space-y-7 pb-8">
{/* Page heading */} <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"> <div>
<div
className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]"
style={{ color: "var(--primary)" }}
>
<span
className="h-2 w-2 rounded-full"
style={{ backgroundColor: "var(--primary)" }}
/>
Customer management </div>


      <h1
        className="text-3xl font-bold tracking-tight sm:text-4xl"
        style={primaryText}
      >
        Customers
      </h1>

      <p className="mt-2 text-sm sm:text-base" style={mutedText}>
        Manage your business relationships from one place.
      </p>

      <p className="mt-2 text-xs" style={mutedText}>
        {formatDate(new Date())}
      </p>
    </div>

    <button
      type="button"
      onClick={openCreateModal}
      className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:opacity-90"
      style={{ backgroundColor: "var(--primary)" }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      Add customer
    </button>
  </div>

  {/* Notifications */}
  {error && (
    <Notice type="error" onClose={() => setError("")}>
      {error}
    </Notice>
  )}

  {success && (
    <Notice type="success" onClose={() => setSuccess("")}>
      {success}
    </Notice>
  )}

  {/* Statistics */}
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <StatCard
      label="Total customers"
      value={loading ? "—" : customers.length.toLocaleString("en")}
      description="All registered customers"
      accent={{ background: "var(--primary-soft)", color: "var(--primary)" }}
      icon={
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="10" cy="7" r="4" />
          <path d="M20 8v6m3-3h-6" />
        </svg>
      }
    />

    <StatCard
      label="Search results"
      value={loading ? "—" : filteredCustomers.length.toLocaleString("en")}
      description={
        normalizedSearch
          ? "Customers matching your search"
          : "Customers currently displayed"
      }
      accent={{ background: "var(--success-soft)", color: "var(--success)" }}
      icon={
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
      }
    />

    <StatCard
      label="Cities covered"
      value={loading ? "—" : citiesCount.toLocaleString("en")}
      description="Unique customer cities"
      accent={{ background: "var(--warning-soft)", color: "var(--warning)" }}
      icon={
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
          <path d="M8 9v.01M8 12v.01M8 15v.01M8 18v.01M15 12v.01M15 16v.01" />
        </svg>
      }
    />

    <StatCard
      label="Countries"
      value={loading ? "—" : countriesCount.toLocaleString("en")}
      description="Unique customer countries"
      accent={{ background: "var(--danger-soft)", color: "var(--danger)" }}
      icon={
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </svg>
      }
    />
  </div>

  {/* Customer table */}
  <section
    className="overflow-hidden rounded-2xl border"
    style={panelStyle}
  >
    <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-center lg:justify-between"
      style={{ borderColor: "var(--border-color)" }}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold" style={primaryText}>
            Customer directory
          </h2>

          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{
              backgroundColor: "var(--primary-soft)",
              color: "var(--primary)",
            }}
          >
            {filteredCustomers.length}
          </span>
        </div>

        <p className="mt-1 text-sm" style={mutedText}>
          View, search, and manage your registered customers.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 sm:w-72">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-secondary)"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customers..."
            aria-label="Search customers"
            className={`${inputClass} pl-10`}
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-lg"
              style={mutedText}
            >
              ×
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={loadCustomers}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            borderColor: "var(--border-color)",
            color: "var(--text-primary)",
          }}
        >
          <svg
            className={loading ? "animate-spin" : ""}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M20 7v5h-5M4 17v-5h5" />
            <path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" />
          </svg>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
    </div>

    {loading && customers.length === 0 ? (
      <div className="space-y-4 p-5" aria-label="Loading customers">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-12 animate-pulse rounded-xl"
            style={{ backgroundColor: "var(--surface-muted)" }}
          />
        ))}
      </div>
    ) : filteredCustomers.length === 0 ? (
      <EmptyState
        searching={Boolean(normalizedSearch)}
        onAdd={openCreateModal}
      />
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead
            style={{
              backgroundColor: "var(--surface-muted)",
              color: "var(--text-secondary)",
            }}
          >
            <tr>
              <th className="px-5 py-4 font-semibold">Company</th>
              <th className="px-5 py-4 font-semibold">Contact</th>
              <th className="px-5 py-4 font-semibold">Email</th>
              <th className="px-5 py-4 font-semibold">Phone</th>
              <th className="px-5 py-4 font-semibold">Location</th>
              <th className="px-5 py-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredCustomers.map((customer) => (
              <tr
                key={customer.id}
                className="transition-colors hover:bg-slate-500/[0.04]"
                style={{
                  borderTop: "1px solid var(--border-color)",
                }}
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                      style={{
                        backgroundColor: "var(--primary-soft)",
                        color: "var(--primary)",
                      }}
                    >
                      {(customer.company_name || "?")
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <p className="max-w-[220px] truncate font-semibold" style={primaryText}>
                        {customer.company_name || "Unnamed company"}
                      </p>
                      <p className="mt-1 text-xs" style={mutedText}>
                        ID: {customer.id}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4" style={primaryText}>
                  {customer.contact_name || "—"}
                </td>

                <td className="px-5 py-4">
                  {customer.email ? (
                    <a
                      href={`mailto:${customer.email}`}
                      className="max-w-[200px] truncate hover:underline"
                      style={{ color: "var(--primary)" }}
                    >
                      {customer.email}
                    </a>
                  ) : (
                    <span style={mutedText}>—</span>
                  )}
                </td>

                <td className="whitespace-nowrap px-5 py-4" style={primaryText}>
                  {customer.phone || "—"}
                </td>

                <td className="px-5 py-4">
                  <p style={primaryText}>{customer.city || "—"}</p>
                  {customer.country && (
                    <p className="mt-1 text-xs" style={mutedText}>
                      {customer.country}
                    </p>
                  )}
                </td>

                <td className="px-5 py-4">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(customer)}
                      className="rounded-lg border px-3 py-2 text-xs font-semibold transition hover:opacity-75"
                      style={{
                        borderColor: "var(--primary)",
                        color: "var(--primary)",
                      }}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(customer)}
                      disabled={deletingId === customer.id}
                      className="rounded-lg border px-3 py-2 text-xs font-semibold transition hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        borderColor: "var(--danger)",
                        color: "var(--danger)",
                      }}
                    >
                      {deletingId === customer.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    <div
      className="flex flex-col gap-2 border-t px-5 py-4 text-xs sm:flex-row sm:items-center sm:justify-between"
      style={{
        borderColor: "var(--border-color)",
        color: "var(--text-secondary)",
      }}
    >
      <span>
        Showing {filteredCustomers.length} of {customers.length} customers
      </span>
      <span>Customer directory</span>
    </div>
  </section>

  {/* Create / edit modal */}
  {modalOpen && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          closeModal();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-modal-title"
        className="my-auto max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border p-5 shadow-2xl sm:p-7"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border-color)",
        }}
      >
        <div
          className="mb-6 flex items-start justify-between gap-4 border-b pb-5"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div>
            <div
              className="mb-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--primary)" }}
            >
              Customer details
            </div>

            <h2
              id="customer-modal-title"
              className="text-2xl font-bold"
              style={primaryText}
            >
              {editingId !== null ? "Edit customer" : "Add customer"}
            </h2>

            <p className="mt-1 text-sm" style={mutedText}>
              {editingId !== null
                ? "Update the information for this customer."
                : "Enter the company and contact information below."}
            </p>
          </div>

          <button
            type="button"
            onClick={closeModal}
            disabled={saving}
            aria-label="Close modal"
            className="rounded-xl border px-3 py-2 text-xl transition hover:opacity-70 disabled:opacity-40"
            style={{
              borderColor: "var(--border-color)",
              color: "var(--text-secondary)",
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <h3
              className="mb-3 text-sm font-semibold"
              style={primaryText}
            >
              Company information
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Company name" required>
                <input
                  name="company_name"
                  value={form.company_name}
                  onChange={handleChange}
                  placeholder="e.g. Atlas Solutions"
                  required
                  className={inputClass}
                />
              </Field>

              <Field label="Contact name">
                <input
                  name="contact_name"
                  value={form.contact_name}
                  onChange={handleChange}
                  placeholder="Full name"
                  className={inputClass}
                />
              </Field>

              <Field label="Email address">
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="contact@company.com"
                  className={inputClass}
                />
              </Field>

              <Field label="Phone number">
                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+212 ..."
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          <div
            className="border-t pt-5"
            style={{ borderColor: "var(--border-color)" }}
          >
            <h3
              className="mb-3 text-sm font-semibold"
              style={primaryText}
            >
              Location information
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="City">
                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="e.g. Agadir"
                  className={inputClass}
                />
              </Field>

              <Field label="Country">
                <input
                  name="country"
                  value={form.country}
                  onChange={handleChange}
                  placeholder="Country"
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Full address">
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Street, building, postal code..."
                  className={`${inputClass} resize-y`}
                />
              </Field>
            </div>
          </div>

          <div
            className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end"
            style={{ borderColor: "var(--border-color)" }}
          >
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="rounded-xl border px-5 py-2.5 text-sm font-semibold transition hover:opacity-75 disabled:opacity-50"
              style={{
                borderColor: "var(--border-color)",
                color: "var(--text-primary)",
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: "var(--primary)" }}
            >
              {saving && (
                <svg
                  className="animate-spin"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" opacity=".25" />
                  <path d="M21 12a9 9 0 0 0-9-9" />
                </svg>
              )}

              {saving
                ? "Saving..."
                : editingId !== null
                  ? "Save changes"
                  : "Create customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}
</div>


);
}
