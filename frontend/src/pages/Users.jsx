
import { useCallback, useEffect, useState } from "react";

const API = "http://localhost:5000/api";

const emptyForm = {
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role_id: "3"
};

async function request(url, options = {}) {
    const response = await fetch(`${API}${url}`, {
        ...options,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Request failed.");
    }

    return result;
}

export default function Users() {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const result = await request("/users");
            setUsers(result.data ?? result.users ?? []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    function openCreateForm() {
        setEditingId(null);
        setForm(emptyForm);
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
            role_id: String(user.role_id ?? 3)
        });
        setShowForm(true);
        setError("");
        setSuccess("");
    }

    function handleChange(event) {
        const { name, value } = event.target;

        setForm(previous => ({
            ...previous,
            [name]: value
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");
        setSuccess("");

        if (!form.first_name.trim() ||
            !form.last_name.trim() ||
            !form.email.trim()) {
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
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                email: form.email.trim(),
                role_id: Number(form.role_id)
            };

            if (form.password) {
                payload.password = form.password;
            }

            if (editingId) {
                await request(`/users/${editingId}`, {
                    method: "PUT",
                    body: JSON.stringify(payload)
                });
                setSuccess("User updated successfully.");
            } else {
                await request("/users", {
                    method: "POST",
                    body: JSON.stringify(payload)
                });
                setSuccess("User created successfully.");
            }

            setShowForm(false);
            setForm(emptyForm);
            setEditingId(null);
            await loadUsers();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function toggleStatus(user) {
        const currentlyActive =
            user.is_active === true ||
            Number(user.is_active) === 1;

        const nextStatus = !currentlyActive;

        const confirmed = window.confirm(
            `Are you sure you want to ${
                nextStatus ? "activate" : "deactivate"
            } ${user.first_name} ${user.last_name}?`
        );

        if (!confirmed) return;

        setError("");
        setSuccess("");

        try {
            const result = await request(
                `/users/${user.id}/status`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        is_active: nextStatus
                    })
                }
            );

            setSuccess(result.message || "Account status updated.");
            await loadUsers();
        } catch (err) {
            setError(err.message);
        }
    }

    const filteredUsers = users.filter(user => {
        const text = [
            user.first_name,
            user.last_name,
            user.email,
            user.role,
            user.role_name
        ].filter(Boolean).join(" ").toLowerCase();

        return text.includes(search.toLowerCase());
    });

    function isActive(user) {
        return user.is_active === true ||
            Number(user.is_active) === 1;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        User Management
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Manage employees, permissions and account status.
                    </p>
                </div>

                <button
                    onClick={openCreateForm}
                    className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700"
                >
                    + Add User
                </button>
            </div>

            {error && (
                <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {success && (
                <div role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                    {success}
                </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <input
                    type="search"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Search by name, email or role..."
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
            </div>

            {showForm && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-5 text-lg font-semibold text-slate-900">
                        {editingId ? "Edit User" : "Create User"}
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                                <label htmlFor="first_name" className="mb-1 block text-sm font-medium">
                                    First name
                                </label>
                                <input
                                    id="first_name"
                                    name="first_name"
                                    value={form.first_name}
                                    onChange={handleChange}
                                    required
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                />
                            </div>

                            <div>
                                <label htmlFor="last_name" className="mb-1 block text-sm font-medium">
                                    Last name
                                </label>
                                <input
                                    id="last_name"
                                    name="last_name"
                                    value={form.last_name}
                                    onChange={handleChange}
                                    required
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                />
                            </div>

                            <div>
                                <label htmlFor="email" className="mb-1 block text-sm font-medium">
                                    Email
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    required
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                />
                            </div>

                            <div>
                                <label htmlFor="role_id" className="mb-1 block text-sm font-medium">
                                    Role
                                </label>
                                <select
                                    id="role_id"
                                    name="role_id"
                                    value={form.role_id}
                                    onChange={handleChange}
                                    required
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                >
                                    <option value="1">Admin</option>
                                    <option value="2">Manager</option>
                                    <option value="3">Employee</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="mb-1 block text-sm font-medium">
                                {editingId
                                    ? "New password (optional)"
                                    : "Password"}
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                value={form.password}
                                onChange={handleChange}
                                required={!editingId}
                                minLength={8}
                                autoComplete="new-password"
                                placeholder={
                                    editingId
                                        ? "Leave empty to keep current password"
                                        : "At least 8 characters"
                                }
                                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                            />
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                type="submit"
                                disabled={saving}
                                className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                                {saving
                                    ? "Saving..."
                                    : editingId
                                        ? "Save Changes"
                                        : "Create User"}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setShowForm(false);
                                    setEditingId(null);
                                    setForm(emptyForm);
                                }}
                                className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">
                        Loading users...
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        No users found.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="px-5 py-3 font-semibold">User</th>
                                    <th className="px-5 py-3 font-semibold">Email</th>
                                    <th className="px-5 py-3 font-semibold">Role</th>
                                    <th className="px-5 py-3 font-semibold">Status</th>
                                    <th className="px-5 py-3 font-semibold">Actions</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {filteredUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50">
                                        <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">
                                            {user.first_name} {user.last_name}
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                                            {user.email}
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4">
                                            {user.role || user.role_name || user.role_id}
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4">
                                            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                                isActive(user)
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-red-100 text-red-700"
                                            }`}>
                                                {isActive(user) ? "Active" : "Inactive"}
                                            </span>
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4">
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => openEditForm(user)}
                                                    className="font-medium text-blue-600 hover:text-blue-800"
                                                >
                                                    Edit
                                                </button>

                                                <button
                                                    onClick={() => toggleStatus(user)}
                                                    className={`font-medium ${
                                                        isActive(user)
                                                            ? "text-red-600 hover:text-red-800"
                                                            : "text-green-600 hover:text-green-800"
                                                    }`}
                                                >
                                                    {isActive(user) ? "Deactivate" : "Activate"}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <p className="text-sm text-slate-500">
                Showing {filteredUsers.length} of {users.length} users.
            </p>
        </div>
    );
}