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

import { t } from "../i18n";
// Roles and what they may do come from the API (backend/src/config/permissions.js).
const ROLE_STYLE = {
    Admin: { tone: "danger", icon: "lock" },
    Manager: { tone: "primary", icon: "customers" },
    Accountant: { tone: "success", icon: "wallet" },
    Warehouse: { tone: "warning", icon: "box" },
    Employee: { tone: "neutral", icon: "eye" },
};

const emptyForm = { first_name: "", last_name: "", email: "", password: "", role_id: "" };

function PermissionMatrix({ roles, permissions }) {
    const groups = [...new Set(permissions.map((permission) => permission.group))];
    return (
        <Card>
            <div className="border-b p-4 text-sm app-text-secondary" style={{ borderColor: "var(--border-color)" }}>
                What each role can do. The server checks these on every request; changing them is a code change, reviewed like any other.
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-start text-sm">
                    <thead>
                        <tr style={{ backgroundColor: "var(--surface-muted)" }}>
                            <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide app-text-muted">{t("Permission")}</th>
                            {roles.map((role) => (
                                <th key={role.id} scope="col" className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide app-text-muted">
                                    {t(role.name)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    {groups.map((group) => (
                        <tbody key={group}>
                            <tr className="border-t" style={{ borderColor: "var(--border-color)" }}>
                                <th scope="rowgroup" colSpan={roles.length + 1} className="px-5 pb-1.5 pt-4 text-xs font-bold app-text">
                                    {t(group)}
                                </th>
                            </tr>
                            {permissions
                                .filter((permission) => permission.group === group)
                                .map((permission) => (
                                    <tr key={permission.key} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                                        <th scope="row" className="px-5 py-2.5 font-normal app-text-secondary">
                                            {t(permission.label)}
                                        </th>
                                        {roles.map((role) => {
                                            const allowed = role.permissions.includes(permission.key);
                                            return (
                                                <td key={role.id} className="px-3 py-2.5 text-center">
                                                    {allowed ? (
                                                        <Icon name="check" size={16} strokeWidth={2.4} className="mx-auto" style={{ color: "var(--success)" }} aria-label={t("Allowed")} />
                                                    ) : (
                                                        <span className="app-text-muted" aria-label={t("Not allowed")}>–</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                        </tbody>
                    ))}
                </table>
            </div>
        </Card>
    );
}

const accessors = {
    name: (user) => `${user.first_name} ${user.last_name}`,
    role: (user) => user.role,
    status: (user) => (isActiveFlag(user.is_active) ? 0 : 1),
    created: (user) => new Date(user.created_at).getTime() || 0,
};

// Mirrors checkPasswordPolicy in backend/src/config/security.js.
function passwordProblem(password) {
    if (password.length < 10) return t("Password must contain at least 10 characters.");
    if (new TextEncoder().encode(password).length > 72) return t("Password must be at most 72 bytes long.");
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return t("Password must contain at least one letter and one number.");
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
    const rolesResource = useResource("/users/roles");
    const ROLES = useMemo(
        () => (rolesResource.data?.data?.roles ?? []).map((role) => ({ ...role, ...(ROLE_STYLE[role.name] ?? ROLE_STYLE.Employee) })),
        [rolesResource.data]
    );
    const roleByName = useMemo(() => Object.fromEntries(ROLES.map((role) => [role.name, role])), [ROLES]);
    const [tab, setTab] = useState("people");

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
        setForm({ ...emptyForm, role_id: String(roleByName.Employee?.id ?? "") });
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
            role_id: String(user.role_id ?? roleByName[user.role]?.id ?? ""),
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

        if (isEditing && editing.id === currentUser?.id && payload.role_id !== roleByName.Admin?.id) {
            const confirmed = await confirm({
                title: t("Remove your own admin access?"),
                message: t("You will lose access to user management as soon as you save. Another admin would need to restore it."),
                confirmLabel: t("Change my role"),
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
                isEditing ? t("{name} was updated.", { name: `${payload.first_name} ${payload.last_name}` }) : t("{name} can now sign in.", { name: `${payload.first_name} ${payload.last_name}` }),
                { title: isEditing ? t("User updated") : t("User created") }
            );
            reload();
        } catch (err) {
            setFormError(err.message || t("Unable to save the user."));
        } finally {
            setSaving(false);
        }
    }

    async function toggleStatus(user, nextActive) {
        const name = `${user.first_name} ${user.last_name}`;

        const confirmed = await confirm({
            title: nextActive ? t("Reactivate {name}?", { name }) : t("Deactivate {name}?", { name }),
            message: nextActive
                ? t("They will be able to sign in again with their existing password.")
                : t("They will be signed out of new requests and won't be able to sign in until reactivated."),
            confirmLabel: nextActive ? t("Activate account") : t("Deactivate account"),
            tone: nextActive ? "primary" : "danger",
            icon: nextActive ? "checkCircle" : "ban",
        });
        if (!confirmed) return;

        setTogglingId(user.id);
        try {
            const result = await api(`/users/${user.id}/status`, { method: "PATCH", body: { is_active: nextActive } });
            toast.success(result.message || (nextActive ? t("{name} is now active.", { name }) : t("{name} is now inactive.", { name })));
            reload();
        } catch (err) {
            toast.error(err.message || t("Unable to update account status."));
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
                title={t("Users & access")}
                actions={
                    <Button variant="primary" icon="userPlus" onClick={openCreate}>
                        {t("Invite user")}
                    </Button>
                }
            />

            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label={t("Team members")} value={number(users.length)} icon="customers" loading={loading && !data} />
                <StatCard label={t("Active")} value={number(activeCount)} icon="checkCircle" tone="success" loading={loading && !data} />
                <StatCard label={t("Roles")} value={number(ROLES.length)} hint={ROLES.map((role) => t(role.name)).join(", ")} icon="lock" tone="info" loading={rolesResource.loading && !rolesResource.data} onClick={() => setTab("roles")} />
            </div>

            <SegmentedControl
                label={t("Users or roles")}
                value={tab}
                onChange={setTab}
                options={[
                    { value: "people", label: t("People"), count: users.length },
                    { value: "roles", label: t("Roles & permissions") },
                ]}
            />

            {tab === "roles" ? (
                rolesResource.error ? (
                    <ErrorState message={rolesResource.error} onRetry={rolesResource.reload} />
                ) : !rolesResource.data ? (
                    <TableSkeleton columns={6} />
                ) : (
                    <PermissionMatrix roles={ROLES} permissions={rolesResource.data.data.permissions} />
                )
            ) : (
            <>

                {error && <ErrorState message={error} onRetry={reload} />}

                <Card>
                    <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center" style={{ borderColor: "var(--border-color)" }}>
                        <SearchInput
                            value={search}
                            onChange={(value) => {
                                setSearch(value);
                                table.setPage(1);
                            }}
                            placeholder={t("Search name or email...")}
                            className="lg:w-80"
                        />
                        <SegmentedControl
                            label={t("Filter by role")}
                            value={roleFilter}
                            onChange={(value) => {
                                setRoleFilter(value);
                                table.setPage(1);
                            }}
                            options={[
                                { value: "All", label: t("All"), count: users.length },
                                ...ROLES.map((role) => ({ value: role.name, label: role.name, count: roleCounts[role.name] })),
                            ]}
                        />
                        <Button size="icon" variant="ghost" icon="refresh" onClick={reload} aria-label={t("Refresh")} title={t("Refresh")} className={`lg:ms-auto ${loading ? "[&_svg]:animate-spin" : ""}`} />
                    </div>

                    {loading && !data ? (
                        <TableSkeleton columns={5} />
                    ) : filtered.length === 0 ? (
                        <EmptyState
                            icon="search"
                            title={t("No matching users")}
                            description={t("Try another name, email, or role.")}
                            action={
                                <Button
                                    onClick={() => {
                                        setSearch("");
                                        setRoleFilter("All");
                                    }}
                                >
                                    {t("Clear filters")}
                                </Button>
                            }
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-start text-sm">
                                <TableHead>
                                    <SortHeader label={t("User")} column="name" sort={table.sort} onSort={table.toggleSort} />
                                    <SortHeader label={t("Role")} column="role" sort={table.sort} onSort={table.toggleSort} />
                                    <SortHeader label={t("Joined")} column="created" sort={table.sort} onSort={table.toggleSort} />
                                    <SortHeader label={t("Active")} column="status" sort={table.sort} onSort={table.toggleSort} />
                                    <Th align="right">{t("Actions")}</Th>
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
                                                                className="absolute bottom-0 end-0 h-3 w-3 rounded-full ring-2 ring-[var(--surface)]"
                                                                style={{ backgroundColor: active ? "var(--success)" : "var(--text-muted)" }}
                                                                title={active ? t("Active") : t("Inactive")}
                                                            />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className={`flex items-center gap-2 font-semibold ${active ? "app-text" : "app-text-muted"}`}>
                                                                {user.first_name} {user.last_name}
                                                                {isSelf && <Badge tone="primary" className="!px-2 !py-0 text-[10px]">{t("You")}</Badge>}
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
                                                        label={isSelf ? t("You can't deactivate your own account") : active ? t("Deactivate {name}", { name: user.first_name }) : t("Activate {name}", { name: user.first_name })}
                                                    />
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex justify-end">
                                                        <IconAction icon="edit" label={t("Edit {name}", { name: user.first_name })} onClick={() => openEdit(user)} />
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
                        <Pagination page={table.page} totalPages={table.totalPages} total={table.total} pageSize={table.pageSize} onPageChange={table.setPage} label={t("users")} />
                    )}
                </Card>
            </>
            )}

            <Modal
                open={formOpen}
                onClose={closeForm}
                busy={saving}
                size="lg"
                icon={isEditing ? "edit" : "userPlus"}
                title={isEditing ? t("Edit {name}", { name: `${editing.first_name} ${editing.last_name}` }) : t("Invite a team member")}
                description={isEditing ? t("Update details, role, or reset the password.") : t("Create an account and choose what they can access.")}
                footer={
                    <>
                        <Button onClick={closeForm} disabled={saving}>
                            {t("Cancel")}
                        </Button>
                        <Button type="submit" form="user-form" variant="primary" loading={saving} icon="check">
                            {isEditing ? t("Save changes") : t("Create account")}
                        </Button>
                    </>
                }
            >
                <form id="user-form" onSubmit={handleSubmit} className="space-y-5">
                    <InlineAlert>{formError}</InlineAlert>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={t("First name")} required>
                            {(id) => <input id={id} name="first_name" value={form.first_name} onChange={handleChange} required maxLength={100} autoComplete="off" className="app-input" />}
                        </Field>
                        <Field label={t("Last name")} required>
                            {(id) => <input id={id} name="last_name" value={form.last_name} onChange={handleChange} required maxLength={100} autoComplete="off" className="app-input" />}
                        </Field>
                        <Field label={t("Email address")} required className="sm:col-span-2">
                            {(id) => <input id={id} name="email" type="email" value={form.email} onChange={handleChange} required autoComplete="off" placeholder={t("name@company.com")} className="app-input" />}
                        </Field>
                    </div>

                    <fieldset>
                        <legend className="mb-2 text-sm font-medium app-text">
                            {t("Role")} <span style={{ color: "var(--danger)" }}>*</span>
                        </legend>
                        <div className="grid gap-2 sm:grid-cols-2">
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
                                            {t(role.name)}
                                            {selected && <Icon name="checkCircle" size={16} className="ms-auto" style={{ color: "var(--primary)" }} />}
                                        </span>
                                        <span className="text-xs app-text-secondary">{t(role.description)}</span>
                                    </label>
                                );
                            })}
                        </div>
                        {selectedRole && isEditing && editing.role !== selectedRole.name && (
                            <p className="mt-2 text-xs font-medium" style={{ color: "var(--warning)" }}>
                                {t("Role will change from {from} to {to}.", { from: t(editing.role), to: t(selectedRole.name) })}
                            </p>
                        )}
                    </fieldset>

                    <Field
                        label={isEditing ? t("New password") : t("Password")}
                        required={!isEditing}
                        hint={isEditing ? t("Leave blank to keep the current password. A new password signs this user out everywhere.") : t("At least 10 characters with a letter and a number. Changing a password signs the user out everywhere.")}
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
                                        placeholder={isEditing ? "••••••••" : t("Create a password")}
                                        className="app-input pe-11"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((value) => !value)}
                                        aria-label={showPassword ? t("Hide password") : t("Show password")}
                                        className="absolute end-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md transition hover:bg-[var(--surface-hover)] app-text-muted"
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
                                        <span className="w-16 text-end text-xs font-semibold" style={{ color: `var(--${strength.tone})` }}>
                                            {t(strength.label)}
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
