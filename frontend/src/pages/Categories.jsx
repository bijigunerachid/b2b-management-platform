
import { useCallback, useEffect, useState } from "react";

const API = "http://localhost:5000/api";

const emptyForm = {
    name: "",
    description: ""
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

export default function Categories() {
    const [categories, setCategories] = useState([]);
    const [search, setSearch] = useState("");
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const loadCategories = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const result = await request("/categories");
            setCategories(result.data ?? result.categories ?? []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    function openCreateForm() {
        setEditingId(null);
        setForm(emptyForm);
        setShowForm(true);
        setError("");
        setSuccess("");
    }

    function openEditForm(category) {
        setEditingId(category.id);
        setForm({
            name: category.name ?? "",
            description: category.description ?? ""
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

        const name = form.name.trim();
        const description = form.description.trim();

        if (!name) {
            setError("Category name is required.");
            return;
        }

        setSaving(true);

        try {
            const payload = { name, description };

            if (editingId !== null) {
                await request(`/categories/${editingId}`, {
                    method: "PUT",
                    body: JSON.stringify(payload)
                });
                setSuccess("Category updated successfully.");
            } else {
                await request("/categories", {
                    method: "POST",
                    body: JSON.stringify(payload)
                });
                setSuccess("Category created successfully.");
            }

            setShowForm(false);
            setEditingId(null);
            setForm(emptyForm);

            await loadCategories();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(category) {
        const confirmed = window.confirm(
            `Delete category "${category.name}"?`
        );

        if (!confirmed) return;

        setError("");
        setSuccess("");

        try {
            const result = await request(
                `/categories/${category.id}`,
                { method: "DELETE" }
            );

            setSuccess(result.message || "Category deleted successfully.");
            await loadCategories();
        } catch (err) {
            setError(
                err.message ||
                "Unable to delete this category. Check whether products use it."
            );
        }
    }

    const filteredCategories = categories.filter(category => {
        const text = [
            category.name,
            category.description
        ].filter(Boolean).join(" ").toLowerCase();

        return text.includes(search.toLowerCase());
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        Categories
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Organize your products into categories.
                    </p>
                </div>

                <button
                    onClick={openCreateForm}
                    className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700"
                >
                    + Add Category
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">Total categories</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">
                        {categories.length}
                    </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">Matching search</p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">
                        {filteredCategories.length}
                    </p>
                </div>
            </div>

            {showForm && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-5 text-lg font-semibold text-slate-900">
                        {editingId !== null
                            ? "Edit Category"
                            : "Create Category"}
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label
                                htmlFor="name"
                                className="mb-1 block text-sm font-medium text-slate-700"
                            >
                                Category name
                            </label>
                            <input
                                id="name"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                required
                                maxLength={100}
                                placeholder="e.g. Electronics"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="description"
                                className="mb-1 block text-sm font-medium text-slate-700"
                            >
                                Description
                            </label>
                            <textarea
                                id="description"
                                name="description"
                                value={form.description}
                                onChange={handleChange}
                                rows={3}
                                maxLength={1000}
                                placeholder="Describe this category..."
                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                                    : editingId !== null
                                        ? "Save Changes"
                                        : "Create Category"}
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
                <div className="border-b border-slate-200 p-4">
                    <input
                        type="search"
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        placeholder="Search categories..."
                        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                </div>

                {loading ? (
                    <div className="p-8 text-center text-slate-500">
                        Loading categories...
                    </div>
                ) : filteredCategories.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        No categories found.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="px-5 py-3 font-semibold">Name</th>
                                    <th className="px-5 py-3 font-semibold">Description</th>
                                    <th className="px-5 py-3 font-semibold">Products</th>
                                    <th className="px-5 py-3 font-semibold">Actions</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {filteredCategories.map(category => (
                                    <tr key={category.id} className="hover:bg-slate-50">
                                        <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">
                                            {category.name}
                                        </td>

                                        <td className="max-w-xs px-5 py-4 text-slate-600">
                                            {category.description || "—"}
                                        </td>

                                        <td className="px-5 py-4">
                                            {category.product_count ?? 0}
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4">
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => openEditForm(category)}
                                                    className="font-medium text-blue-600 hover:text-blue-800"
                                                >
                                                    Edit
                                                </button>

                                                <button
                                                    onClick={() => handleDelete(category)}
                                                    className="font-medium text-red-600 hover:text-red-800"
                                                >
                                                    Delete
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
                Showing {filteredCategories.length} of {categories.length} categories.
            </p>
        </div>
    );
}