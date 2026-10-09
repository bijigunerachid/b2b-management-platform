
import { useCallback, useEffect, useState } from "react";

const API = "http://localhost:5000/api";

const emptyForm = {
    name: "",
    description: "",
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

export default function Categories() {
    const [categories, setCategories] = useState([]);
    const [search, setSearch] = useState("");
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const loadCategories = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const result = await request("/categories");
            const data = result.data ?? result.categories ?? [];

            setCategories(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message || "Unable to load categories.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    function openCreateForm() {
        setEditingId(null);
        setForm({ ...emptyForm });
        setShowForm(true);
        setError("");
        setSuccess("");
    }

    function openEditForm(category) {
        setEditingId(category.id);
        setForm({
            name: category.name ?? "",
            description: category.description ?? "",
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
                    body: JSON.stringify(payload),
                });

                setSuccess("Category updated successfully.");
            } else {
                await request("/categories", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });

                setSuccess("Category created successfully.");
            }

            closeForm();
            await loadCategories();
        } catch (err) {
            setError(err.message || "Unable to save the category.");
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
        setDeletingId(category.id);

        try {
            const result = await request(`/categories/${category.id}`, {
                method: "DELETE",
            });

            setSuccess(
                result.message || "Category deleted successfully."
            );

            await loadCategories();
        } catch (err) {
            setError(
                err.message ||
                    "Unable to delete this category. Check whether products use it."
            );
        } finally {
            setDeletingId(null);
        }
    }

    const filteredCategories = categories.filter((category) => {
        const text = [
            category.name,
            category.description,
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return text.includes(search.trim().toLowerCase());
    });

    const totalProducts = categories.reduce(
        (total, category) =>
            total + (Number(category.product_count) || 0),
        0
    );

    const inputClass =
        "app-input w-full rounded-xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-blue-500/20";

    const primaryButton =
        "app-primary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

    const secondaryButton =
        "app-surface app-border inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition hover:bg-black/5 dark:hover:bg-white/5";

    return (
        <div className="space-y-6">
            {/* Page heading */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="app-text-secondary mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                        <span>Inventory</span>
                        <span>/</span>
                        <span>Categories</span>
                    </div>

                    <h1 className="app-text text-2xl font-bold tracking-tight sm:text-3xl">
                        Categories
                    </h1>

                    <p className="app-text-secondary mt-2 text-sm">
                        Organize your product catalog and manage your categories.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={openCreateForm}
                    className={primaryButton}
                >
                    <span className="text-lg leading-none">+</span>
                    Add Category
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
                        <p className="app-text-secondary text-sm">
                            Total categories
                        </p>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-lg text-blue-600 dark:text-blue-400">
                            ▦
                        </span>
                    </div>

                    <p className="app-text mt-4 text-3xl font-bold">
                        {categories.length}
                    </p>

                    <p className="app-text-secondary mt-2 text-xs">
                        Categories in your catalog
                    </p>
                </div>

                <div className="app-surface app-border rounded-2xl border p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <p className="app-text-secondary text-sm">
                            Products assigned
                        </p>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-lg text-emerald-600 dark:text-emerald-400">
                            ◈
                        </span>
                    </div>

                    <p className="app-text mt-4 text-3xl font-bold">
                        {totalProducts}
                    </p>

                    <p className="app-text-secondary mt-2 text-xs">
                        Based on category product counts
                    </p>
                </div>

                <div className="app-surface app-border rounded-2xl border p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <p className="app-text-secondary text-sm">
                            Search results
                        </p>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-lg text-violet-600 dark:text-violet-400">
                            ⌕
                        </span>
                    </div>

                    <p className="app-text mt-4 text-3xl font-bold">
                        {filteredCategories.length}
                    </p>

                    <p className="app-text-secondary mt-2 text-xs">
                        Matching categories
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
                                    ? "Edit category"
                                    : "Create category"}
                            </h2>

                            <p className="app-text-secondary mt-1 text-sm">
                                {editingId !== null
                                    ? "Update the category details below."
                                    : "Add a new category to organize your products."}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={closeForm}
                            className="app-text-secondary rounded-lg px-2 py-1 text-xl hover:bg-black/5 dark:hover:bg-white/5"
                            aria-label="Close category form"
                        >
                            ×
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div>
                                <label
                                    htmlFor="category-name"
                                    className="app-text mb-2 block text-sm font-semibold"
                                >
                                    Category name
                                    <span className="ml-1 text-red-500">*</span>
                                </label>

                                <input
                                    id="category-name"
                                    name="name"
                                    value={form.name}
                                    onChange={handleChange}
                                    required
                                    maxLength={100}
                                    placeholder="e.g. Electronics"
                                    className={inputClass}
                                />

                                <p className="app-text-secondary mt-2 text-xs">
                                    Maximum 100 characters.
                                </p>
                            </div>

                            <div>
                                <label
                                    htmlFor="category-description"
                                    className="app-text mb-2 block text-sm font-semibold"
                                >
                                    Description
                                </label>

                                <textarea
                                    id="category-description"
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    rows={3}
                                    maxLength={1000}
                                    placeholder="Describe this category..."
                                    className={`${inputClass} resize-y`}
                                />

                                <p className="app-text-secondary mt-2 text-xs">
                                    Optional. Maximum 1,000 characters.
                                </p>
                            </div>
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
                                      : "Create category"}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            {/* Category directory */}
            <section className="app-surface app-border overflow-hidden rounded-2xl border shadow-sm">
                <div className="app-border flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div>
                        <h2 className="app-text font-bold">
                            Category directory
                        </h2>
                        <p className="app-text-secondary mt-1 text-sm">
                            Browse and manage your categories.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative min-w-0 sm:w-72">
                            <span
                                aria-hidden="true"
                                className="app-text-secondary pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                            >
                                ⌕
                            </span>

                            <input
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search categories..."
                                aria-label="Search categories"
                                className={`${inputClass} pl-9`}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={loadCategories}
                            disabled={loading}
                            className={secondaryButton}
                        >
                            <span aria-hidden="true">↻</span>
                            {loading ? "Loading..." : "Refresh"}
                        </button>
                    </div>
                </div>

                {loading && categories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 p-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent app-text-secondary" />
                        <p className="app-text-secondary text-sm">
                            Loading categories...
                        </p>
                    </div>
                ) : filteredCategories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                        <span className="app-muted mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl">
                            ▦
                        </span>

                        <h3 className="app-text font-semibold">
                            {search
                                ? "No matching categories"
                                : "No categories yet"}
                        </h3>

                        <p className="app-text-secondary mt-2 max-w-sm text-sm">
                            {search
                                ? "Try a different search term."
                                : "Create your first category to start organizing your products."}
                        </p>

                        {search ? (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="mt-4 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                            >
                                Clear search
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={openCreateForm}
                                className={`${primaryButton} mt-5`}
                            >
                                + Add your first category
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
                                            Category
                                        </th>
                                        <th className="app-text-secondary px-5 py-4 font-semibold">
                                            Description
                                        </th>
                                        <th className="app-text-secondary px-5 py-4 font-semibold">
                                            Products
                                        </th>
                                        <th className="app-text-secondary px-5 py-4 text-right font-semibold">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filteredCategories.map((category) => (
                                        <tr
                                            key={category.id}
                                            className="app-border border-t transition hover:bg-black/[0.025] dark:hover:bg-white/[0.035]"
                                        >
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 font-bold text-blue-600 dark:text-blue-400">
                                                        {(category.name || "?")
                                                            .trim()
                                                            .charAt(0)
                                                            .toUpperCase()}
                                                    </span>

                                                    <span className="app-text font-semibold">
                                                        {category.name}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="app-text-secondary max-w-sm px-5 py-4">
                                                <p className="line-clamp-2">
                                                    {category.description || "No description"}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4">
                                                <span className="app-muted app-text inline-flex rounded-lg px-3 py-1.5 font-semibold">
                                                    {Number(category.product_count) || 0}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditForm(category)}
                                                        className="rounded-lg px-3 py-2 font-semibold text-blue-600 transition hover:bg-blue-500/10 dark:text-blue-400"
                                                    >
                                                        Edit
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(category)}
                                                        disabled={deletingId !== null}
                                                        className="rounded-lg px-3 py-2 font-semibold text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
                                                    >
                                                        {deletingId === category.id
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

                        {/* Mobile category cards */}
                        <div className="divide-y divide-[var(--border-color)] md:hidden">
                            {filteredCategories.map((category) => (
                                <article key={category.id} className="space-y-4 p-4">
                                    <div className="flex items-start gap-3">
                                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 font-bold text-blue-600 dark:text-blue-400">
                                            {(category.name || "?")
                                                .trim()
                                                .charAt(0)
                                                .toUpperCase()}
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <h3 className="app-text break-words font-semibold">
                                                {category.name}
                                            </h3>

                                            <p className="app-text-secondary mt-1 break-words text-sm">
                                                {category.description || "No description"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                        <span className="app-muted app-text rounded-lg px-3 py-1.5 text-xs font-semibold">
                                            {Number(category.product_count) || 0} products
                                        </span>

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => openEditForm(category)}
                                                className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
                                            >
                                                Edit
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleDelete(category)}
                                                disabled={deletingId !== null}
                                                className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
                                            >
                                                {deletingId === category.id
                                                    ? "Deleting..."
                                                    : "Delete"}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </>
                )}

                <div className="app-border app-muted flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <p className="app-text-secondary text-xs">
                        Showing {filteredCategories.length} of {categories.length} categories
                    </p>

                    {loading && categories.length > 0 && (
                        <p className="app-text-secondary text-xs">
                            Refreshing data...
                        </p>
                    )}
                </div>
            </section>
        </div>
    );
}