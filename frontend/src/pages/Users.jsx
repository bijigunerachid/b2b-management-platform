import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
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
import { api, formatDate, initials, isActiveFlag, number, toList, useResource } from "../lib/api";
import useTable from "../lib/useTable";

const ROLES = [
    { id: 1, name: "Admin", tone: "danger", icon: "users", description: "Full access, including user management." },
    { id: 2, name: "Manager", tone: "primary", icon: "customers", description: "Manage customers, products, and orders." },
    { id: 3, name: "Employee", tone: "neutral", icon: "eye", description: "Read-only access to business data." },
];

const roleByName = Object.fromEntries(ROLES.map((role) => [role.name, role]));

const emptyForm = { first_name: "", last_name: "", email: "", password: "", role_id: "3" };

const accessors = {
    name: (user) => `${user.first_name} ${user.last_name}`,
    role: (user) => user.role,
    status: (user) => (isActiveFlag(user.is_active) ? 0 : 1),
    created: (user) => new Date(user.created_at).getTime() || 0,
};

// Mirrors checkPasswordPolicy in backend/src/config/security.js.
function passwordProblem(password) {
    if (password.length < 10) return "Password must contain at least 10 characters.";
    if (new TextEncoder().encode(password).length > 72) return "Password must be at most 72 bytes long.";
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Password must contain at least one letter and one number.";
    return null;
}

function passwordStrength(password) {
    if (!password) return null;
    let score = 0;
    if (password.length >= 10) score += 1;
    if (password.length >= 14) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (passwordProblem(password)) return { score: 1, label: "Too weak", tone: "danger" };
    if (score <= 2) return { score: 2, label: "Weak", tone: "warning" };
    if (score <= 3) return { score: 3, label: "Good", tone: "primary" };
    return { score: 4, label: "Strong", tone: "success" };
}

export default function Users() {
    const { user: currentUser } = useAuth();
    const toast = useToast();
    const confirm = useConfirm();

    const { data, loading, error, reload } = useResource("/users");
    const users = useMemo(() => toList(data, "users"), [data]);

    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("All");
    const [togglingId, setTogglingId] = useState(null);

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [showPassword, setShowPassword] = useState(false);
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return users.filter(
            (user) =>
                (roleFilter === "All" || user.role === roleFilter) &&
                (!term || `${user.first_name} ${user.last_name} ${user.email}`.toLowerCase().includes(term))
        );
    }, [users, search, roleFilter]);

    const table = useTable(filtered, { accessors, initialSort: { key: "name", direction: "asc" } });

    const activeCount = users.filter((user) => isActiveFlag(user.is_active)).length;
    const roleCounts = Object.fromEntries(ROLES.map((role) => [role.name, users.filter((user) => user.role === role.name).length]));

    function openCreate() {
        setEditing(null);
        setForm(emptyForm);
        setShowPassword(false);
        setFormError("");
        setFormOpen(true);
    }

    function openEdit(user) {
        setEditing(user);
        setForm({
            first_name: user.first_name ?? "",
            last_name: user.last_name ?? "",
            email: user.email ?? "",
            password: "",
            role_id: String(user.role_id ?? roleByName[user.role]?.id ?? 3),
        });
        setShowPassword(false);
        setFormError("");
        setFormOpen(true);
    }

    function closeForm() {
        if (!saving) setFormOpen(false);
    }

    function handleChange(event) {
        const { name, value } = event.target;
        setForm((previous) => ({ ...previous, [name]: value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setFormError("");

        const isEditing = editing !== null;

        if (!isEditing || form.password) {
            const problem = passwordProblem(form.password);
            if (problem) return setFormError(problem);
        }

        const payload = {
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            email: form.email.trim(),
            role_id: Number(form.role_id),
            ...(form.password ? { password: form.password } : {}),
        };

        if (isEditing && editing.id === currentUser?.id && payload.role_id !== 1) {
            const confirmed = await confirm({
                title: "Remove your own admin access?",
                message: "You will lose access to user management as soon as you save. Another admin would need to restore it.",
                confirmLabel: "Change my role",
                tone: "warning",
            });
            if (!confirmed) return;
        }

        setSaving(true);
        try {
            await api(isEditing ? `/users/${editing.id}` : "/users", {
                method: isEditing ? "PUT" : "POST",
                body: payload,
            });
            setFormOpen(false);
            toast.success(
                `${payload.first_name} ${payload.last_name} ${isEditing ? "was updated" : "can now sign in"}.`,
                { title: isEditing ? "User updated" : "User created" }
            );
            reload();
        } catch (err) {
            setFormError(err.message || "Unable to save the user.");
        } finally {
            setSaving(false);
        }
    }

    async function toggleStatus(user, nextActive) {
        const name = `${user.first_name} ${user.last_name}`;

        const confirmed = await confirm({
            title: nextActive ? `Reactivate ${name}?` : `Deactivate ${name}?`,
            message: nextActive
                ? "They will be able to sign in again with their existing password."
                : "They will be signed out of new requests and won't be able to sign in until reactivated.",
            confirmLabel: nextActive ? "Activate account" : "Deactivate account",
            tone: nextActive ? "primary" : "danger",
            icon: nextActive ? "checkCircle" : "ban",
        });
        if (!confirmed) return;

        setTogglingId(user.id);
        try {
            const result = await api(`/users/${user.id}/status`, { method: "PATCH", body: { is_active: nextActive } });
            toast.success(result.message || `${name} is now ${nextActive ? "active" : "inactive"}.`);
            reload();
        } catch (err) {
            toast.error(err.message || "Unable to update account status.");
        } finally {
            setTogglingId(null);
        }
    }

    const isEditing = editing !== null;
    const strength = passwordStrength(form.password);
    const selectedRole = ROLES.find((role) => String(role.id) === form.role_id);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Users & access"
                actions={
                    <Button variant="primary" icon="userPlus" onClick={openCreate}>
                        Invite user
                    </Button>
                }
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Team members" value={number(users.length)} hint={`${number(activeCount)} active`} icon="customers" loading={loading && !data} />
                {ROLES.map((role) => (
                    <StatCard
                        key={role.name}
                        label={`${role.name}s`}
                        value={number(roleCounts[role.name])}
                        hint={role.description}
                        icon={role.icon}
                        tone={role.tone === "neutral" ? "info" : role.tone}
                        loading={loading && !data}
                        onClick={() => setRoleFilter(role.name)}
                    />
                ))}
            </div>

            {error && <ErrorState message={error} onRetry={reload} />}

            <Card>
                <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center" style={{ borderColor: "var(--border-color)" }}>
                    <SearchInput
                        value={search}
                        onChange={(value) => {
                            setSearch(value);
                            table.setPage(1);
                        }}
                        placeholder="Search name or email..."
                        className="lg:w-80"
                    />
                    <SegmentedControl
                        label="Filter by role"
                        value={roleFilter}
                        onChange={(value) => {
                            setRoleFilter(value);
                            table.setPage(1);
                        }}
                        options={[
                            { value: "All", label: "All", count: users.length },
                            ...ROLES.map((role) => ({ value: role.name, label: role.name, count: roleCounts[role.name] })),
                        ]}
                    />
                    <Button size="icon" variant="ghost" icon="refresh" onClick={reload} aria-label="Refresh" title="Refresh" className={`lg:ml-auto ${loading ? "[&_svg]:animate-spin" : ""}`} />
                </div>

                {loading && !data ? (
                    <TableSkeleton columns={5} />
                ) : filtered.length === 0 ? (
                    <EmptyState
                        icon="search"
                        title="No matching users"
                        description="Try another name, email, or role."
                        action={
                            <Button
                                onClick={() => {
                                    setSearch("");
                                    setRoleFilter("All");
                                }}
                            >
                                Clear filters
                            </Button>
                        }
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-sm">
                            <TableHead>
                                <SortHeader label="User" column="name" sort={table.sort} onSort={table.toggleSort} />
                                <SortHeader label="Role" column="role" sort={table.sort} onSort={table.toggleSort} />
                                <SortHeader label="Joined" column="created" sort={table.sort} onSort={table.toggleSort} />
                                <SortHeader label="Active" column="status" sort={table.sort} onSort={table.toggleSort} />
                                <Th align="right">Actions</Th>
                            </TableHead>
                            <tbody>
                                {table.rows.map((user) => {
                                    const active = isActiveFlag(user.is_active);
                                    const isSelf = user.id === currentUser?.id;
                                    const role = roleByName[user.role];

                                    return (
                                        <tr key={user.id} className="border-t transition-colors hover:bg-[var(--surface-hover)]" style={{ borderColor: "var(--border-color)" }}>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <Avatar label={initials(user.first_name, user.last_name)} seed={user.id} rounded="rounded-full" />
                                                        <span
                                                            className="absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-[var(--surface)]"
                                                            style={{ backgroundColor: active ? "var(--success)" : "var(--text-muted)" }}
                                                            title={active ? "Active" : "Inactive"}
                                                        />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className={`flex items-center gap-2 font-semibold ${active ? "app-text" : "app-text-muted"}`}>
                                                            {user.first_name} {user.last_name}
                                                            {isSelf && <Badge tone="primary" className="!px-2 !py-0 text-[10px]">You</Badge>}
                                                        </p>
                                                        <p className="truncate text-xs app-text-muted">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <Badge tone={role?.tone} icon={role?.icon}>
                                                    {user.role}
                                                </Badge>
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-3.5 app-text-secondary">{formatDate(user.created_at)}</td>
                                            <td className="px-5 py-3.5">
                                                <Switch
                                                    size="sm"
                                                    checked={active}
                                                    disabled={isSelf || togglingId === user.id}
                                                    onChange={(next) => toggleStatus(user, next)}
                                                    label={isSelf ? "You can't deactivate your own account" : active ? `Deactivate ${user.first_name}` : `Activate ${user.first_name}`}
                                                />
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex justify-end">
                                                    <IconAction icon="edit" label={`Edit ${user.first_name}`} onClick={() => openEdit(user)} />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {filtered.length > 0 && (
                    <Pagination page={table.page} totalPages={table.totalPages} total={table.total} pageSize={table.pageSize} onPageChange={table.setPage} label="users" />
                )}
            </Card>

            <Modal
                open={formOpen}
                onClose={closeForm}
                busy={saving}
                size="lg"
                icon={isEditing ? "edit" : "userPlus"}
                title={isEditing ? `Edit ${editing.first_name} ${editing.last_name}` : "Invite a team member"}
                description={isEditing ? "Update details, role, or reset the password." : "Create an account and choose what they can access."}
                footer={
                    <>
                        <Button onClick={closeForm} disabled={saving}>
                            Cancel
                        </Button>
                        <Button type="submit" form="user-form" variant="primary" loading={saving} icon="check">
                            {isEditing ? "Save changes" : "Create account"}
                        </Button>
                    </>
                }
            >
                <form id="user-form" onSubmit={handleSubmit} className="space-y-5">
                    <InlineAlert>{formError}</InlineAlert>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="First name" required>
                            {(id) => <input id={id} name="first_name" value={form.first_name} onChange={handleChange} required maxLength={100} autoComplete="off" className="app-input" />}
                        </Field>
                        <Field label="Last name" required>
                            {(id) => <input id={id} name="last_name" value={form.last_name} onChange={handleChange} required maxLength={100} autoComplete="off" className="app-input" />}
                        </Field>
                        <Field label="Email address" required className="sm:col-span-2">
                            {(id) => <input id={id} name="email" type="email" value={form.email} onChange={handleChange} required autoComplete="off" placeholder="name@company.com" className="app-input" />}
                        </Field>
                    </div>

                    <fieldset>
                        <legend className="mb-2 text-sm font-medium app-text">
                            Role <span style={{ color: "var(--danger)" }}>*</span>
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-3">
                            {ROLES.map((role) => {
                                const selected = form.role_id === String(role.id);
                                return (
                                    <label
                                        key={role.id}
                                        className="relative flex cursor-pointer flex-col gap-1 rounded-xl border p-3.5 transition hover:border-[var(--border-strong)]"
                                        style={{
                                            borderColor: selected ? "var(--primary)" : "var(--border-color)",
                                            backgroundColor: selected ? "var(--primary-soft)" : "var(--surface)",
                                            boxShadow: selected ? "0 0 0 1px var(--primary)" : undefined,
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="role_id"
                                            value={role.id}
                                            checked={selected}
                                            onChange={handleChange}
                                            className="sr-only"
                                        />
                                        <span className="flex items-center gap-2 text-sm font-semibold app-text">
                                            <Icon name={role.icon} size={16} />
                                            {role.name}
                                            {selected && <Icon name="checkCircle" size={16} className="ml-auto" style={{ color: "var(--primary)" }} />}
                                        </span>
                                        <span className="text-xs app-text-secondary">{role.description}</span>
                                    </label>
                                );
                            })}
                        </div>
                        {selectedRole && isEditing && editing.role !== selectedRole.name && (
                            <p className="mt-2 text-xs font-medium" style={{ color: "var(--warning)" }}>
                                Role will change from {editing.role} to {selectedRole.name}.
                            </p>
                        )}
                    </fieldset>

                    <Field
                        label={isEditing ? "New password" : "Password"}
                        required={!isEditing}
                        hint={isEditing ? "Leave blank to keep the current password. A new password signs this user out everywhere." : "At least 10 characters with a letter and a number. Changing a password signs the user out everywhere."}
                    >
                        {(id) => (
                            <>
                                <div className="relative">
                                    <input
                                        id={id}
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        value={form.password}
                                        onChange={handleChange}
                                        required={!isEditing}
                                        minLength={10}
                                        maxLength={72}
                                        autoComplete="new-password"
                                        placeholder={isEditing ? "••••••••" : "Create a password"}
                                        className="app-input pr-11"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((value) => !value)}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md transition hover:bg-[var(--surface-hover)] app-text-muted"
                                    >
                                        <Icon name={showPassword ? "eyeOff" : "eye"} size={16} />
                                    </button>
                                </div>
                                {strength && (
                                    <div className="mt-2 flex items-center gap-3">
                                        <div className="flex flex-1 gap-1">
                                            {[1, 2, 3, 4].map((step) => (
                                                <span
                                                    key={step}
                                                    className="h-1.5 flex-1 rounded-full transition-colors"
                                                    style={{ backgroundColor: step <= strength.score ? `var(--${strength.tone})` : "var(--surface-hover)" }}
                                                />
                                            ))}
                                        </div>
                                        <span className="w-16 text-right text-xs font-semibold" style={{ color: `var(--${strength.tone})` }}>
                                            {strength.label}
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </Field>
                </form>
            </Modal>
        </div>
    );
}
