
import { useCallback, useEffect, useState } from "react";

const API = "http://localhost:5000/api";

const emptyForm = {
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role_id: "3",
};

async function request(url, options = {}) {
    const response = await fetch(`${API}${url}`, {
        ...options,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
        throw new Error(result.message || "Request failed.");
    }

    return result;
}

function isActive(user) {
    return user.is_active === true || Number(user.is_active) === 1;
}

function getRole(user) {
    return user.role || user.role_name || user.role_id || "Unknown";
}

function getInitials(user) {
    const first = (user.first_name || "").trim().charAt(0);
    const last = (user.last_name || "").trim().charAt(0);

    return `${first}${last}`.toUpperCase() || "?";
}

export default function Users() {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [updatingStatusId, setUpdatingStatusId] = useState(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ ...emptyForm });

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const result = await request("/users");
            const data = result.data ?? result.users ?? [];

            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message || "Unable to load users.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    function openCreateForm() {
        setEditingId(null);
        setForm({ ...emptyForm });
        setShowForm(true);
        setError("");
        setSuccess("");
    }

    function openEditForm(user) {
        setEditingId(user.id);
        setForm({
            first_name: user.first_name ?? "",
            last_name: user.last_name ?? "",
            email: user.email ?? "",
            password: "",
            role_id: String(user.role_id ?? 3),
        });
        setShowForm(true);
        setError("");
        setSuccess("");
    }

    function closeForm() {
        setShowForm(false);
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

        const firstName = form.first_name.trim();
        const lastName = form.last_name.trim();
        const email = form.email.trim();

        if (!firstName || !lastName || !email) {
            setError("Please complete all required fields.");
            return;
        }

        if (!editingId && form.password.length < 8) {
            setError("Password must contain at least 8 characters.");
            return;
        }

        if (form.password && form.password.length < 8) {
            setError("A new password must contain at least 8 characters.");
            return;
        }

        setSaving(true);

        try {
            const payload = {
                first_name: firstName,
                last_name: lastName,
                email,
                role_id: Number(form.role_id),
            };

            if (form.password) {
                payload.password = form.password;
            }

            if (editingId !== null) {
                await request(`/users/${editingId}`, {
                    method: "PUT",
                    body: JSON.stringify(payload),
                });

                setSuccess("User updated successfully.");
            } else {
                await request("/users", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });

                setSuccess("User created successfully.");
            }

            closeForm();
            await loadUsers();
        } catch (err) {
            setError(err.message || "Unable to save the user.");
        } finally {
            setSaving(false);
        }
    }

    async function toggleStatus(user) {
        const nextStatus = !isActive(user);
        const fullName = `${user.first_name} ${user.last_name}`.trim();

        const confirmed = window.confirm(
            `Are you sure you want to ${
                nextStatus ? "activate" : "deactivate"
            } ${fullName}?`
        );

        if (!confirmed) return;

        setError("");
        setSuccess("");
        setUpdatingStatusId(user.id);

        try {
            const result = await request(`/users/${user.id}/status`, {
                method: "PATCH",
                body: JSON.stringify({
                    is_active: nextStatus,
                }),
            });

            setSuccess(result.message || "Account status updated.");
            await loadUsers();
        } catch (err) {
            setError(err.message || "Unable to update account status.");
        } finally {
            setUpdatingStatusId(null);
        }
    }

    const filteredUsers = users.filter((user) => {
        const text = [
            user.first_name,
            user.last_name,
            user.email,
            user.role,
            user.role_name,
            getRole(user),
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return text.includes(search.trim().toLowerCase());
    });

    const activeCount = users.filter(isActive).length;
    const inactiveCount = users.length - activeCount;

    const inputClass =
        "app-input w-full rounded-xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500/20";

    const primaryButton =
        "app-primary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

    const secondaryButton =
        "app-surface app-border inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition hover:bg-black/5 dark:hover:bg-white/5";

    function renderStatus(user) {
        const active = isActive(user);

        return (
            <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    active
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-red-500/10 text-red-700 dark:text-red-400"
                }`}
            >
                <span
                    className={`h-1.5 w-1.5 rounded-full ${
                        active ? "bg-emerald-500" : "bg-red-500"
                    }`}
                />
                {active ? "Active" : "Inactive"}
            </span>
        );
    }

    function renderActions(user) {
        const active = isActive(user);
        const updating = updatingStatusId === user.id;

        return (
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => openEditForm(user)}
                    disabled={updatingStatusId !== null}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-500/10 disabled:opacity-50 dark:text-blue-400"
                >
                    Edit
                </button>

                <button
                    type="button"
                    onClick={() => toggleStatus(user)}
                    disabled={updatingStatusId !== null}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                        active
                            ? "text-red-600 hover:bg-red-500/10 dark:text-red-400"
                            : "text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
                    }`}
                >
                    {updating
                        ? "Updating..."
                        : active
                          ? "Deactivate"
                          : "Activate"}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page heading */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="app-text-secondary mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                        <span>Administration</span>
                        <span>/</span>
                        <span>Users</span>
                    </div>

                    <h1 className="app-text text-2xl font-bold tracking-tight sm:text-3xl">
                        User Management
                    </h1>

                    <p className="app-text-secondary mt-2 text-sm">
                        Manage employee accounts, roles, and account status.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={openCreateForm}
                    className={primaryButton}
                >
                    <span className="text-lg leading-none">+</span>
                    Add User
                </button>
            </header>

            {/* Notifications */}
            {error && (
                <div
                    role="alert"
                    className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400"
                >
                    <span aria-hidden="true">!</span>
                    <p className="flex-1">{error}</p>
                    <button
                        type="button"
                        onClick={() => setError("")}
                        className="font-semibold"
                        aria-label="Dismiss error"
                    >
                        ×
                    </button>
                </div>
            )}

            {success && (
                <div
                    role="status"
                    className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400"
                >
                    <span aria-hidden="true">✓</span>
                    <p className="flex-1">{success}</p>
                    <button
                        type="button"
                        onClick={() => setSuccess("")}
                        className="font-semibold"
                        aria-label="Dismiss success message"
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Statistics */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="app-surface app-border rounded-2xl border p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <p className="app-text-secondary text-sm">Total users</p>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-lg text-blue-600 dark:text-blue-400">
                            ♙
                        </span>
                    </div>
                    <p className="app-text mt-4 text-3xl font-bold">
                        {users.length}
                    </p>
                    <p className="app-text-secondary mt-2 text-xs">
                        Registered accounts
                    </p>
                </div>

                <div className="app-surface app-border rounded-2xl border p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <p className="app-text-secondary text-sm">Active users</p>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-lg text-emerald-600 dark:text-emerald-400">
                            ✓
                        </span>
                    </div>
                    <p className="app-text mt-4 text-3xl font-bold">
                        {activeCount}
                    </p>
                    <p className="app-text-secondary mt-2 text-xs">
                        Accounts currently active
                    </p>
                </div>

                <div className="app-surface app-border rounded-2xl border p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <p className="app-text-secondary text-sm">Inactive users</p>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-lg text-amber-600 dark:text-amber-400">
                            ◷
                        </span>
                    </div>
                    <p className="app-text mt-4 text-3xl font-bold">
                        {inactiveCount}
                    </p>
                    <p className="app-text-secondary mt-2 text-xs">
                        Deactivated accounts
                    </p>
                </div>
            </section>

            {/* Create/edit form */}
            {showForm && (
                <section className="app-surface app-border rounded-2xl border p-5 shadow-sm sm:p-6">
                    <div className="mb-6 flex items-start justify-between gap-4">
                        <div>
                            <h2 className="app-text text-lg font-bold">
                                {editingId !== null
                                    ? "Edit user"
                                    : "Create user"}
                            </h2>
                            <p className="app-text-secondary mt-1 text-sm">
                                {editingId !== null
                                    ? "Update account information and permissions."
                                    : "Create an employee account and assign a role."}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={closeForm}
                            disabled={saving}
                            className="app-text-secondary rounded-lg px-2 py-1 text-xl hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                            aria-label="Close user form"
                        >
                            ×
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div>
                                <label
                                    htmlFor="first_name"
                                    className="app-text mb-2 block text-sm font-semibold"
                                >
                                    First name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="first_name"
                                    name="first_name"
                                    value={form.first_name}
                                    onChange={handleChange}
                                    required
                                    maxLength={100}
                                    autoComplete="given-name"
                                    placeholder="Enter first name"
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="last_name"
                                    className="app-text mb-2 block text-sm font-semibold"
                                >
                                    Last name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="last_name"
                                    name="last_name"
                                    value={form.last_name}
                                    onChange={handleChange}
                                    required
                                    maxLength={100}
                                    autoComplete="family-name"
                                    placeholder="Enter last name"
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="email"
                                    className="app-text mb-2 block text-sm font-semibold"
                                >
                                    Email address <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    required
                                    autoComplete="email"
                                    placeholder="name@company.com"
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="role_id"
                                    className="app-text mb-2 block text-sm font-semibold"
                                >
                                    Role <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="role_id"
                                    name="role_id"
                                    value={form.role_id}
                                    onChange={handleChange}
                                    required
                                    className={inputClass}
                                >
                                    <option value="1">Admin</option>
                                    <option value="2">Manager</option>
                                    <option value="3">Employee</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="app-text mb-2 block text-sm font-semibold"
                            >
                                {editingId !== null
                                    ? "New password (optional)"
                                    : "Password"}
                                {editingId === null && (
                                    <span className="ml-1 text-red-500">*</span>
                                )}
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                value={form.password}
                                onChange={handleChange}
                                required={editingId === null}
                                minLength={8}
                                autoComplete="new-password"
                                placeholder={
                                    editingId !== null
                                        ? "Leave empty to keep the current password"
                                        : "At least 8 characters"
                                }
                                className={inputClass}
                            />
                            <p className="app-text-secondary mt-2 text-xs">
                                {editingId !== null
                                    ? "Only enter a password if you want to change it."
                                    : "Use at least 8 characters."}
                            </p>
                        </div>

                        <div className="app-border flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={closeForm}
                                disabled={saving}
                                className={secondaryButton}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className={primaryButton}
                            >
                                {saving
                                    ? "Saving..."
                                    : editingId !== null
                                      ? "Save changes"
                                      : "Create user"}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {/* User directory */}
            <section className="app-surface app-border overflow-hidden rounded-2xl border shadow-sm">
                <div className="app-border flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div>
                        <h2 className="app-text font-bold">User directory</h2>
                        <p className="app-text-secondary mt-1 text-sm">
                            Search accounts and manage access status.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search name, email or role..."
                            aria-label="Search users"
                            className={`${inputClass} sm:w-72`}
                        />
                        <button
                            type="button"
                            onClick={loadUsers}
                            disabled={loading}
                            className={secondaryButton}
                        >
                            <span aria-hidden="true">↻</span>
                            {loading ? "Loading..." : "Refresh"}
                        </button>
                    </div>
                </div>

                {loading && users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 p-12">
                        <div className="app-text-secondary h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        <p className="app-text-secondary text-sm">
                            Loading users...
                        </p>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                        <span className="app-muted mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl">
                            ♙
                        </span>
                        <h3 className="app-text font-semibold">
                            {search ? "No matching users" : "No users found"}
                        </h3>
                        <p className="app-text-secondary mt-2 max-w-sm text-sm">
                            {search
                                ? "Try another name, email address, or role."
                                : "User accounts will appear here when available."}
                        </p>
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="mt-4 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                            >
                                Clear search
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full text-left text-sm">
                                <thead className="app-muted">
                                    <tr>
                                        <th className="app-text-secondary px-5 py-4 font-semibold">
                                            User
                                        </th>
                                        <th className="app-text-secondary px-5 py-4 font-semibold">
                                            Role
                                        </th>
                                        <th className="app-text-secondary px-5 py-4 font-semibold">
                                            Status
                                        </th>
                                        <th className="app-text-secondary px-5 py-4 text-right font-semibold">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((user) => (
                                        <tr
                                            key={user.id}
                                            className="app-border border-t transition hover:bg-black/[0.025] dark:hover:bg-white/[0.035]"
                                        >
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-sm font-bold text-blue-600 dark:text-blue-400">
                                                        {getInitials(user)}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="app-text font-semibold">
                                                            {user.first_name} {user.last_name}
                                                        </p>
                                                        <p className="app-text-secondary mt-1 break-all text-xs">
                                                            {user.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="app-text px-5 py-4">
                                                <span className="app-muted inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold">
                                                    {getRole(user)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                {renderStatus(user)}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-end">
                                                    {renderActions(user)}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile user cards */}
                        <div className="divide-y divide-[var(--border-color)] md:hidden">
                            {filteredUsers.map((user) => (
                                <article key={user.id} className="space-y-4 p-4">
                                    <div className="flex items-start gap-3">
                                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-sm font-bold text-blue-600 dark:text-blue-400">
                                            {getInitials(user)}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="app-text break-words font-semibold">
                                                {user.first_name} {user.last_name}
                                            </h3>
                                            <p className="app-text-secondary mt-1 break-all text-sm">
                                                {user.email}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="app-muted app-text rounded-lg px-3 py-1.5 text-xs font-semibold">
                                                {getRole(user)}
                                            </span>
                                            {renderStatus(user)}
                                        </div>
                                    </div>

                                    <div className="app-border border-t pt-3">
                                        {renderActions(user)}
                                    </div>
                                </article>
                            ))}
                        </div>
                    </>
                )}

                <div className="app-border app-muted flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <p className="app-text-secondary text-xs">
                        Showing {filteredUsers.length} of {users.length} users
                    </p>
                    {loading && users.length > 0 && (
                        <p className="app-text-secondary text-xs">
                            Refreshing data...
                        </p>
                    )}
                </div>
            </section>
        </div>
    );
}