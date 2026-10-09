import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { useConfirm, useToast } from "../components/ui/feedback";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SegmentedControl,
  StatCard,
  TableHead,
  Th,
} from "../components/ui/primitives";
import { MovementRow } from "../components/StockHistory";
import { api, can, compactMoney, money, number, useResource } from "../lib/api";
import { MOVEMENT_TYPES } from "../lib/purchasing";

const PAGE_SIZE = 25;

function ReorderSuggestions({ canWrite, onCreated }) {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useResource("/inventory/reorder-suggestions");
  const groups = data?.data ?? [];
  const orderable = groups.filter((group) => group.supplier_id);

  // Every supplier group starts selected; unticking excludes it.
  const [excluded, setExcluded] = useState(() => new Set());
  const [creating, setCreating] = useState(false);
  const selected = orderable.filter((group) => !excluded.has(group.supplier_id));

  function toggle(supplierId) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(supplierId)) next.delete(supplierId);
      else next.add(supplierId);
      return next;
    });
  }

  async function createDrafts() {
    const total = selected.reduce((sum, group) => sum + group.total, 0);
    const confirmed = await confirm({
      title: `Create ${selected.length} draft purchase order${selected.length === 1 ? "" : "s"}?`,
      message: `One draft per supplier, ${money(total)} in total at estimated costs. Review each one before placing it.`,
      confirmLabel: "Create drafts",
      tone: "primary",
      icon: "truck",
    });
    if (!confirmed) return;

    setCreating(true);
    try {
      const result = await api("/inventory/reorder-suggestions/purchase-orders", {
        method: "POST",
        body: { supplier_ids: selected.map((group) => group.supplier_id) },
      });
      toast.success(result.message, { title: "Drafts ready for review" });
      reload();
      onCreated?.();
      navigate("/purchase-orders?status=draft");
    } catch (err) {
      toast.error(err.message || "Could not create purchase orders.");
    } finally {
      setCreating(false);
    }
  }

  const productCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <Card>
      <CardHeader
        title={
          <>
            Reorder suggestions
            {productCount > 0 && <Badge tone="warning">{productCount}</Badge>}
          </>
        }
        description="Products at or below their reorder point, counting stock already on order. Quantities top up to 3× the reorder point."
        actions={
          canWrite &&
          orderable.length > 0 && (
            <Button variant="primary" icon="truck" loading={creating} disabled={selected.length === 0} onClick={createDrafts}>
              Create {selected.length} draft PO{selected.length === 1 ? "" : "s"}
            </Button>
          )
        }
      />

      {error ? (
        <div className="p-5">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : loading && !data ? (
        <div className="space-y-3 p-5">
          {[1, 2].map((item) => (
            <div key={item} className="skeleton h-32 rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState icon="checkCircle" title="Nothing to reorder" description="Every product is above its reorder point, or already on order." />
      ) : (
        <div className="space-y-4 p-4">
          {groups.map((group) => {
            const isSelected = group.supplier_id && !excluded.has(group.supplier_id);
            return (
              <div
                key={group.supplier_id ?? "none"}
                className="overflow-hidden rounded-xl border transition"
                style={{ borderColor: isSelected ? "color-mix(in srgb, var(--primary) 45%, var(--border-color))" : "var(--border-color)" }}
              >
                <div className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ backgroundColor: "var(--surface-muted)" }}>
                  {group.supplier_id && canWrite && (
                    <input type="checkbox" checked={isSelected} onChange={() => toggle(group.supplier_id)} aria-label={`Include ${group.supplier_name}`} className="h-4 w-4" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold app-text">{group.supplier_name ?? "No preferred supplier"}</p>
                    <p className="text-xs app-text-muted">
                      {group.items.length} product{group.items.length === 1 ? "" : "s"}
                      {group.supplier_id ? ` · est. ${money(group.total)}` : " · assign a supplier on the product to include it"}
                    </p>
                  </div>
                  {group.items.some((item) => item.urgency === "out") && (
                    <Badge tone="danger" icon="ban">
                      {group.items.filter((item) => item.urgency === "out").length} out of stock
                    </Badge>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <TableHead>
                      <Th className="!py-2">Product</Th>
                      <Th className="!py-2" align="right">Stock</Th>
                      <Th className="!py-2" align="right">On order</Th>
                      <Th className="!py-2" align="right">Reorder at</Th>
                      <Th className="!py-2" align="right">Suggested</Th>
                    </TableHead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.product_id} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                          <td className="px-5 py-2.5">
                            <Link to={`/products?q=${encodeURIComponent(item.name)}`} className="font-medium hover:underline app-text">
                              {item.name}
                            </Link>
                          </td>
                          <td className="px-5 py-2.5 text-right font-semibold tabular-nums" style={{ color: item.stock === 0 ? "var(--danger)" : "var(--warning)" }}>
                            {item.stock}
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums app-text-secondary">{item.on_order || "—"}</td>
                          <td className="px-5 py-2.5 text-right tabular-nums app-text-secondary">{item.reorder_point}</td>
                          <td className="px-5 py-2.5 text-right">
                            <span className="font-bold tabular-nums app-text">+{item.quantity}</span>
                            <span className="block text-[11px] app-text-muted">@ {money(item.unit_cost)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function MovementsLedger({ version }) {
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), v: String(version) });
  if (type !== "all") query.set("type", type);
  const { data, loading, error, reload } = useResource(`/inventory/movements?${query}`);
  const movements = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, totalPages: 1 };

  return (
    <Card>
      <CardHeader title="Stock ledger" description="Every change to stock, newest first. Stock only changes through these entries." />
      <div className="border-b p-4" style={{ borderColor: "var(--border-color)" }}>
        <SegmentedControl
          label="Filter by movement type"
          value={type}
          onChange={(value) => {
            setType(value);
            setPage(1);
          }}
          options={[{ value: "all", label: "All" }, ...Object.entries(MOVEMENT_TYPES).map(([value, meta]) => ({ value, label: meta.label }))]}
        />
      </div>

      {error ? (
        <div className="p-5">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : loading && !data ? (
        <div className="space-y-2 p-4">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="skeleton h-14 rounded-lg" />
          ))}
        </div>
      ) : movements.length === 0 ? (
        <EmptyState icon="box" title="No movements" description="Try another movement type." />
      ) : (
        <ul className={`divide-y transition-opacity ${loading ? "opacity-60" : ""}`} style={{ borderColor: "var(--border-color)" }}>
          {movements.map((movement) => (
            <MovementRow key={movement.id} movement={movement} />
          ))}
        </ul>
      )}

      {movements.length > 0 && (
        <Pagination page={page} totalPages={Math.max(1, pagination.totalPages)} total={pagination.total} pageSize={PAGE_SIZE} onPageChange={setPage} label="movements" />
      )}
    </Card>
  );
}

export default function Inventory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canWrite = can(user, "purchasing.write");
  const [version, setVersion] = useState(0);
  const { data, loading, error, reload } = useResource(`/inventory/summary?v=${version}`);
  const summary = data?.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory"
        title="Stock"
        description="What's in stock, what needs reordering, and every movement that changed it."
        actions={
          <>
            <Link
              to="/purchase-orders"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--control-radius)] border px-4 text-sm font-semibold transition hover:bg-[var(--surface-hover)] app-text"
              style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface)" }}
            >
              <Icon name="truck" size={17} /> Purchase orders
            </Link>
            <Button size="icon" variant="ghost" icon="refresh" onClick={() => { reload(); setVersion((value) => value + 1); }} aria-label="Refresh" title="Refresh" className={loading ? "[&_svg]:animate-spin" : ""} />
          </>
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Units in stock" value={number(summary?.units)} hint={`${compactMoney(summary?.retail_value)} at selling price`} icon="box" loading={!summary} />
        <StatCard label="Below reorder point" value={number(summary?.below_reorder)} hint={`${number(summary?.out_of_stock)} completely out of stock`} icon="alert" tone="warning" loading={!summary} />
        <StatCard label="On order" value={number(summary?.units_on_order)} hint={`${number(summary?.open_orders)} open purchase orders`} icon="truck" tone="info" loading={!summary} />
        <StatCard
          label="Overdue deliveries"
          value={number(summary?.late_orders)}
          hint="Past their expected date"
          icon="clock"
          tone={summary?.late_orders ? "danger" : "success"}
          loading={!summary}
          onClick={() => navigate("/purchase-orders?status=late")}
        />
      </div>

      <ReorderSuggestions canWrite={canWrite} onCreated={() => setVersion((value) => value + 1)} />
      <MovementsLedger version={version} />
    </div>
  );
}
