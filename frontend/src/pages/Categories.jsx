import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { Modal } from "../components/ui/Modal";
import { useConfirm, useToast } from "../components/ui/feedback";
import {
    Card,
    EmptyState,
    ErrorState,
    Field,
    IconAction,
    InlineAlert,
    PageHeader,
    SearchInput,
    SegmentedControl,
    StatCard,
    toneStyle,
} from "../components/ui/primitives";
import { api, can, number, toList, useResource } from "../lib/api";

const emptyForm = { name: "", description: "" };
const tones = ["primary", "success", "warning", "info", "danger"];

export default function Categories() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const confirm = useConfirm();
    const [params, setParams] = useSearchParams();

    const { data, loading, error, reload } = useResource("/categories");
    const categories = useMemo(() => toList(data, "categories"), [data]);

    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState("name");

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);

    const canWrite = can(user, "categories.write");
    const canDelete = can(user, "categories.delete");
    const createRequested = params.get("new") === "1" && canWrite;
    const isEditing = editing !== null && !createRequested;

    const totalProducts = categories.reduce((sum, category) => sum + (Number(category.product_count) || 0), 0);
    const largest = categories.reduce(
        (best, category) => (Number(category.product_count) > Number(best?.product_count ?? -1) ? category : best),
        null
    );
    const emptyCount = categories.filter((category) => !Number(category.product_count)).length;

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();
        return categories
            .filter((category) => !term || `${category.name} ${category.description ?? ""}`.toLowerCase().includes(term))
            .sort((a, b) =>
                sortBy === "products"
                    ? (Number(b.product_count) || 0) - (Number(a.product_count) || 0)
                    : a.name.localeCompare(b.name)
            );
    }, [categories, search, sortBy]);

    function clearNewParam() {
        if (!createRequested) return;
        const next = new URLSearchParams(params);
        next.delete("new");
        setParams(next, { replace: true });
    }

    function openCreate() {
        setEditing(null);
        setForm(emptyForm);
        setFormError("");
        setFormOpen(true);
    }

    function openEdit(category) {
        setEditing(category);
        setForm({ name: category.name ?? "", description: category.description ?? "" });
        setFormError("");
        setFormOpen(true);
    }

    function closeForm() {
        if (saving) return;
        setFormOpen(false);
        clearNewParam();
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setFormError("");

        const payload = { name: form.name.trim(), description: form.description.trim() };
        if (!payload.name) return setFormError("Category name is required.");

        setSaving(true);
        try {
            await api(isEditing ? `/categories/${editing.id}` : "/categories", {
                method: isEditing ? "PUT" : "POST",
                body: payload,
            });
            setFormOpen(false);
            clearNewParam();
            toast.success(`“${payload.name}” was ${isEditing ? "updated" : "created"}.`, {
                title: isEditing ? "Category updated" : "Category created",
            });
            reload();
        } catch (err) {
            setFormError(err.message || "Unable to save the category.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(category) {
        const count = Number(category.product_count) || 0;

        if (count > 0) {
            toast.warning(`Move or delete its ${count} product${count === 1 ? "" : "s"} first.`, {
                title: `“${category.name}” is in use`,
            });
            return;
        }

        const confirmed = await confirm({
            title: `Delete “${category.name}”?`,
            message: "This category has no products and will be permanently removed.",
            confirmLabel: "Delete category",
        });
        if (!confirmed) return;

        try {
            await api(`/categories/${category.id}`, { method: "DELETE" });
            toast.success(`“${category.name}” was deleted.`);
            reload();
        } catch (err) {
            toast.error(err.message || "Unable to delete this category.", { title: "Delete failed" });
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Categories"
                actions={
                    canWrite && (
                        <Button variant="primary" icon="plus" onClick={openCreate}>
                            Add category
                        </Button>
                    )
                }
            />

            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Categories" value={number(categories.length)} icon="categories" loading={loading && !data} />
                <StatCard label="Products assigned" value={number(totalProducts)} hint={largest ? `Largest: ${largest.name}` : "No products yet"} icon="products" tone="success" loading={loading && !data} />
                <StatCard label="Empty categories" value={number(emptyCount)} icon="box" tone="warning" loading={loading && !data} />
            </div>

            {error && <ErrorState message={error} onRetry={reload} />}

            <Card>
                <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center" style={{ borderColor: "var(--border-color)" }}>
                    <SearchInput value={search} onChange={setSearch} placeholder="Search categories..." className="sm:w-80" />
                    <div className="flex items-center gap-2 sm:ml-auto">
                        <span className="text-xs font-medium app-text-muted">Sort</span>
                        <SegmentedControl
                            label="Sort categories"
                            value={sortBy}
                            onChange={setSortBy}
                            options={[
                                { value: "name", label: "A–Z" },
                                { value: "products", label: "Most products" },
                            ]}
                        />
                        <Button size="icon" variant="ghost" icon="refresh" onClick={reload} aria-label="Refresh" title="Refresh" className={loading ? "[&_svg]:animate-spin" : ""} />
                    </div>
                </div>

                {loading && !data ? (
                    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map((item) => (
                            <div key={item} className="skeleton h-44 rounded-xl" />
                        ))}
                    </div>
                ) : visible.length === 0 ? (
                    <EmptyState
                        icon={search ? "search" : "categories"}
                        title={search ? "No matching categories" : "No categories yet"}
                        description={search ? "Try a different search term." : "Create your first category to start organizing products."}
                        action={
                            search ? (
                                <Button onClick={() => setSearch("")}>Clear search</Button>
                            ) : (
                                canWrite && (
                                    <Button variant="primary" icon="plus" onClick={openCreate}>
                                        Add your first category
                                    </Button>
                                )
                            )
                        }
                    />
                ) : (
                    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                        {visible.map((category) => {
                            const count = Number(category.product_count) || 0;
                            const share = totalProducts ? (count / totalProducts) * 100 : 0;
                            const tone = tones[category.id % tones.length];

                            return (
                                <article
                                    key={category.id}
                                    className="group relative flex flex-col rounded-xl border p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-md"
                                    style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface)" }}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold" style={toneStyle(tone)}>
                                            {category.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                            {canWrite && <IconAction icon="edit" label={`Edit ${category.name}`} onClick={() => openEdit(category)} />}
                                            {canDelete && <IconAction icon="trash" label={`Delete ${category.name}`} tone="danger" onClick={() => handleDelete(category)} />}
                                        </div>
                                    </div>

                                    <h3 className="mt-4 truncate text-base font-bold app-text">{category.name}</h3>
                                    <p className="mt-1 line-clamp-2 min-h-10 text-sm app-text-secondary">
                                        {category.description || <span className="italic app-text-muted">No description</span>}
                                    </p>

                                    <div className="mt-4">
                                        <div className="mb-1.5 flex items-center justify-between text-xs">
                                            <span className="font-semibold app-text">
                                                {count} product{count === 1 ? "" : "s"}
                                            </span>
                                            <span className="app-text-muted">{share.toFixed(0)}% of catalog</span>
                                        </div>
                                        <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-muted)" }}>
                                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${share}%`, backgroundColor: `var(--${tone})` }} />
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => navigate(`/products?category=${category.id}`)}
                                        className="mt-4 inline-flex items-center gap-1.5 self-start text-sm font-semibold transition hover:gap-2.5"
                                        style={{ color: "var(--primary)" }}
                                    >
                                        View products <Icon name="arrowRight" size={15} />
                                    </button>
                                </article>
                            );
                        })}
                    </div>
                )}

                {visible.length > 0 && (
                    <div className="border-t px-5 py-3.5 text-sm app-text-secondary" style={{ borderColor: "var(--border-color)" }}>
                        Showing <span className="font-semibold app-text">{visible.length}</span> of {categories.length} categories
                    </div>
                )}
            </Card>

            <Modal
                open={formOpen || createRequested}
                onClose={closeForm}
                busy={saving}
                icon={isEditing ? "edit" : "categories"}
                title={isEditing ? `Edit “${editing.name}”` : "Add a new category"}
                description={isEditing ? "Rename or describe this category." : "Categories help you organize and filter products."}
                footer={
                    <>
                        <Button onClick={closeForm} disabled={saving}>
                            Cancel
                        </Button>
                        <Button type="submit" form="category-form" variant="primary" loading={saving} icon="check">
                            {isEditing ? "Save changes" : "Create category"}
                        </Button>
                    </>
                }
            >
                <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
                    <InlineAlert>{formError}</InlineAlert>
                    <Field label="Category name" required hint={`${form.name.length}/100`}>
                        {(id) => (
                            <input
                                id={id}
                                value={form.name}
                                onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
                                required
                                maxLength={100}
                                placeholder="e.g. Office furniture"
                                className="app-input"
                            />
                        )}
                    </Field>
                    <Field label="Description" hint={`Optional · ${form.description.length}/1000`}>
                        {(id) => (
                            <textarea
                                id={id}
                                value={form.description}
                                onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
                                rows={4}
                                maxLength={1000}
                                placeholder="What kind of products belong here?"
                                className="app-input resize-y"
                            />
                        )}
                    </Field>
                </form>
            </Modal>
        </div>
    );
}
