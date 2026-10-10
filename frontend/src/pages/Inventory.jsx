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

import { t } from "../i18n";
const PAGE_SIZE = 25;

function ReorderSuggestions({ canWrite, onCreated }) {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useResource("/inventory/reorder-suggestions");
  const groups = data?.data ?? [];
  const orderable = groups.filter((group) => group.supplier_id);

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
      title: selected.length === 1 ? t("Create 1 draft purchase order?") : t("Create {count} draft purchase orders?", { count: selected.length }),
      message: t("One draft per supplier, {amount} in total at estimated costs. Review each one before placing it.", { amount: money(total) }),
      confirmLabel: t("Create drafts"),
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
      toast.success(result.message, { title: t("Drafts ready for review") });
      reload();
      onCreated?.();
      navigate("/purchase-orders?status=draft");
    } catch (err) {
      toast.error(err.message || t("Could not create purchase orders."));
    } finally {
      setCreating(false);
    }
  }

  const productCount = groups.reduce((sum, group) => sum + group.items.length, 0);
  const usesForecast = groups.some((group) => group.items.some((item) => item.forecast_units !== null && item.forecast_units !== undefined));

  return (
    <Card>
      <CardHeader
        title={
          <>
            {t("Reorder suggestions")}
            {productCount > 0 && <Badge tone="warning">{productCount}</Badge>}
          </>
        }
        description={
          usesForecast
            ? t("Stock plus what's on order is at or below the reorder level: forecast sales over the supplier's lead time plus safety stock, or the reorder point if higher")
            : t("At or below the reorder point, counting what's already on order")
        }
        actions={
          canWrite &&
          orderable.length > 0 && (
            <Button variant="primary" icon="truck" loading={creating} disabled={selected.length === 0} onClick={createDrafts}>
              {selected.length === 1 ? t("Create 1 draft PO") : t("Create {count} draft POs", { count: selected.length })}
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
        <EmptyState icon="checkCircle" title={t("Nothing to reorder")} />
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
                      {group.supplier_id ? ` · ${t("est. {amount}", { amount: money(group.total) })}` : ` · ${t("assign a supplier on the product to include it")}`}
                    </p>
                  </div>
                  {group.items.some((item) => item.urgency === "out") && (
                    <Badge tone="danger" icon="ban">
                      {t("{count} out of stock", { count: group.items.filter((item) => item.urgency === "out").length })}
                    </Badge>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-start text-sm">
                    <TableHead>
                      <Th className="!py-2">{t("Product")}</Th>
                      <Th className="!py-2" align="right">{t("Stock")}</Th>
                      <Th className="!py-2" align="right">{t("On order")}</Th>
                      {usesForecast && <Th className="!py-2" align="right">{t("Next 4 weeks")}</Th>}
                      <Th className="!py-2" align="right">{t("Reorder at")}</Th>
                      <Th className="!py-2" align="right">{t("Suggested")}</Th>
                    </TableHead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.product_id} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                          <td className="px-5 py-2.5">
                            <Link to={`/products?q=${encodeURIComponent(item.name)}`} className="font-medium hover:underline app-text">
                              {item.name}
                            </Link>
                          </td>
                          <td className="px-5 py-2.5 text-end font-semibold tabular-nums" style={{ color: item.stock === 0 ? "var(--danger)" : "var(--warning)" }}>
                            {item.stock}
                          </td>
                          <td className="px-5 py-2.5 text-end tabular-nums app-text-secondary">{item.on_order || "—"}</td>
                          {usesForecast && (
                            <td className="px-5 py-2.5 text-end tabular-nums app-text-secondary" title={t("Forecast sales over the next 4 weeks")}>
                              {item.forecast_units === null ? "—" : `≈ ${number(Math.round(item.forecast_units))}`}
                            </td>
                          )}
                          <td className="px-5 py-2.5 text-end tabular-nums app-text-secondary">
                            {item.reorder_level ?? item.reorder_point}
                            {item.basis === "forecast" && <span className="block text-[11px] app-text-muted">{t("from forecast")}</span>}
                          </td>
                          <td className="px-5 py-2.5 text-end">
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
      <CardHeader title={t("Stock ledger")} description={t("Newest first")} />
      <div className="border-b p-4" style={{ borderColor: "var(--border-color)" }}>
        <SegmentedControl
          label={t("Filter by movement type")}
          value={type}
          onChange={(value) => {
            setType(value);
            setPage(1);
          }}
          options={[{ value: "all", label: t("All") }, ...Object.entries(MOVEMENT_TYPES).map(([value, meta]) => ({ value, label: t(meta.label) }))]}
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
        <EmptyState icon="box" title={t("No movements")} description={t("Try another movement type.")} />
      ) : (
        <ul className={`divide-y transition-opacity ${loading ? "opacity-60" : ""}`} style={{ borderColor: "var(--border-color)" }}>
          {movements.map((movement) => (
            <MovementRow key={movement.id} movement={movement} />
          ))}
        </ul>
      )}

      {movements.length > 0 && (
        <Pagination page={page} totalPages={Math.max(1, pagination.totalPages)} total={pagination.total} pageSize={PAGE_SIZE} onPageChange={setPage} label={t("movements")} />
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
        title={t("Stock")}
        actions={
          <>
            <Link
              to="/purchase-orders"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--control-radius)] border px-4 text-sm font-semibold transition hover:bg-[var(--surface-hover)] app-text"
              style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface)" }}
            >
              <Icon name="truck" size={17} /> {t("Purchase orders")}
            </Link>
            <Button size="icon" variant="ghost" icon="refresh" onClick={() => { reload(); setVersion((value) => value + 1); }} aria-label={t("Refresh")} title={t("Refresh")} className={loading ? "[&_svg]:animate-spin" : ""} />
          </>
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("Units in stock")} value={number(summary?.units)} hint={t("{amount} at selling price", { amount: compactMoney(summary?.retail_value) })} icon="box" loading={!summary} />
        <StatCard label={t("Below reorder point")} value={number(summary?.below_reorder)} hint={t("{count} completely out of stock", { count: number(summary?.out_of_stock) })} icon="alert" tone="warning" loading={!summary} />
        <StatCard label={t("On order")} value={number(summary?.units_on_order)} hint={t("{count} open purchase orders", { count: number(summary?.open_orders) })} icon="truck" tone="info" loading={!summary} />
        <StatCard
          label={t("Overdue deliveries")}
          value={number(summary?.late_orders)}
          hint={t("Past their expected date")}
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
