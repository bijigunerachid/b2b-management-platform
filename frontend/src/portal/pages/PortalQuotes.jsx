import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import { Drawer } from "../../components/ui/Modal";
import { useConfirm, useToast } from "../../components/ui/feedback";
import { Badge, Card, EmptyState, ErrorState, InlineAlert, PageHeader, TableHead, TableSkeleton, Th } from "../../components/ui/primitives";
import { api, formatDate, money, toList, useResource } from "../../lib/api";
import { QUOTE_STATUS, validityLabel } from "../../lib/quoteStatus";

function QuoteDrawer({ quoteId, version, open, onClose, onDecided }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(null);
  const { data, loading, error } = useResource(quoteId ? `/portal/quotes/${quoteId}?v=${version}` : null);
  const quote = data?.data;

  // Same React Compiler issue as reorder() in PortalOrders.
  async function decide(quote, action) {
    const accepting = action === "accept";
    const confirmed = await confirm({
      title: accepting ? `Accept ${quote.number}?` : `Decline ${quote.number}?`,
      message: accepting
        ? `You agree to the prices in this quote (${money(quote.total_with_vat)} incl. VAT). We'll turn it into an order and confirm by email.`
        : "We'll mark this quote as declined.",
      confirmLabel: accepting ? "Accept quote" : "Decline quote",
      tone: accepting ? "primary" : "danger",
      icon: accepting ? "checkCircle" : "thumbsDown",
    });
    if (!confirmed) return;

    setBusy(action);
    try {
      const result = await api(`/portal/quotes/${quote.id}/${action}`, { method: "POST" });
      toast.success(result.message, { title: accepting ? "Quote accepted" : "Quote declined" });
      onDecided();
    } catch (err) {
      toast.error(err.message || "Your answer could not be recorded.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={quote?.number ?? ""}
      description={quote ? `Valid until ${formatDate(`${quote.valid_until}T00:00:00`)}` : "Loading..."}
      icon="fileText"
      footer={
        quote && (
          <>
            {quote.actions.includes("reject") && (
              <Button variant="danger-ghost" icon="thumbsDown" onClick={() => decide(quote, "reject")} loading={busy === "reject"} disabled={Boolean(busy)} className="mr-auto">
                Decline
              </Button>
            )}
            <a
              href={`/portal/quotes/${quote.id}/print`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-10 items-center gap-2 rounded-[var(--control-radius)] border px-4 text-sm font-semibold transition hover:bg-[var(--surface-hover)] app-text"
              style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface)" }}
            >
              <Icon name="download" size={17} /> PDF
            </a>
            {quote.actions.includes("accept") && (
              <Button variant="primary" icon="checkCircle" onClick={() => decide(quote, "accept")} loading={busy === "accept"} disabled={Boolean(busy)}>
                Accept quote
              </Button>
            )}
          </>
        )
      }
    >
      {error ? (
        <InlineAlert>{error}</InlineAlert>
      ) : loading && !quote ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : (
        quote && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-4" style={{ borderColor: "var(--border-color)" }}>
              <Badge tone={QUOTE_STATUS[quote.status]?.tone} icon={QUOTE_STATUS[quote.status]?.icon}>
                {quote.status === "Sent" ? "Awaiting your answer" : quote.status}
              </Badge>
              {validityLabel(quote) && <span className="text-xs font-medium app-text-secondary">{validityLabel(quote)}</span>}
              {quote.status === "Converted" && <span className="text-xs app-text-secondary">Became order #{quote.order_id}</span>}
            </div>

            <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border-color)" }}>
              <table className="w-full text-left text-sm">
                <TableHead>
                  <Th className="!px-4">Product</Th>
                  <Th className="!px-4" align="right">Qty</Th>
                  <Th className="!px-4" align="right">Amount</Th>
                </TableHead>
                <tbody>
                  {quote.items.map((item) => {
                    const discount = Number(item.list_price) > 0 ? 1 - Number(item.unit_price) / Number(item.list_price) : 0;
                    return (
                      <tr key={item.product_id} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                        <td className="px-4 py-3">
                          <p className="font-medium app-text">{item.product_name}</p>
                          <p className="text-xs app-text-muted">
                            {money(item.unit_price)} each
                            {discount > 0.0005 && (
                              <span className="ml-1.5 font-semibold" style={{ color: "var(--success)" }}>
                                −{Math.round(discount * 100)}% off list
                              </span>
                            )}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums app-text">×{item.quantity}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums app-text">{money(item.subtotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <dl className="space-y-1 border-t px-4 py-3 text-sm" style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface-muted)" }}>
                <div className="flex justify-between">
                  <dt className="app-text-secondary">Subtotal (HT)</dt>
                  <dd className="tabular-nums app-text">{money(quote.total_amount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="app-text-secondary">VAT</dt>
                  <dd className="tabular-nums app-text">{money(quote.vat)}</dd>
                </div>
                <div className="flex justify-between text-base">
                  <dt className="font-semibold app-text">Total (TTC)</dt>
                  <dd className="font-bold tabular-nums app-text">{money(quote.total_with_vat)}</dd>
                </div>
              </dl>
            </div>
            {quote.notes && <p className="rounded-xl p-4 text-sm app-muted app-text-secondary">{quote.notes}</p>}
          </div>
        )
      )}
    </Drawer>
  );
}

export default function PortalQuotes() {
  const [params, setParams] = useSearchParams();
  const [version, setVersion] = useState(0);
  const { data, loading, error, reload } = useResource(`/portal/quotes?v=${version}`);
  const quotes = useMemo(() => toList(data), [data]);
  const awaiting = quotes.filter((quote) => quote.actions.includes("accept"));

  const viewId = params.get("view");
  const [lastViewId, setLastViewId] = useState(viewId);
  if (viewId && viewId !== lastViewId) setLastViewId(viewId);

  function setView(id) {
    const next = new URLSearchParams(params);
    if (id === null) next.delete("view");
    else next.set("view", id);
    setParams(next, { replace: true });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Your quotes" />
      {error && <ErrorState message={error} onRetry={reload} />}
      {awaiting.length > 0 && (
        <InlineAlert tone="info">
          {awaiting.length} quote{awaiting.length === 1 ? " is" : "s are"} waiting for your answer.
        </InlineAlert>
      )}
      <Card>
        {loading && !data ? (
          <TableSkeleton columns={4} />
        ) : quotes.length === 0 ? (
          <EmptyState icon="fileText" title="No quotes yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <TableHead>
                <Th>Quote</Th>
                <Th>Valid until</Th>
                <Th>Status</Th>
                <Th align="right">Total (TTC)</Th>
              </TableHead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id} onClick={() => setView(quote.id)} className="cursor-pointer border-t transition-colors hover:bg-[var(--surface-hover)]" style={{ borderColor: "var(--border-color)" }}>
                    <td className="px-5 py-3.5">
                      <p className="whitespace-nowrap font-bold app-text">{quote.number}</p>
                      <p className="text-xs app-text-muted">{formatDate(quote.sent_at ?? quote.created_at)}</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <p className="app-text">{formatDate(`${quote.valid_until}T00:00:00`)}</p>
                      {quote.actions.includes("accept") && validityLabel(quote) && (
                        <p className="text-xs font-medium" style={{ color: quote.days_left <= 3 ? "var(--danger)" : "var(--text-muted)" }}>
                          {validityLabel(quote)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={QUOTE_STATUS[quote.status]?.tone} icon={QUOTE_STATUS[quote.status]?.icon}>
                        {quote.status === "Sent" ? "Awaiting your answer" : quote.status}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums app-text">{money(quote.total_with_vat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <QuoteDrawer
        quoteId={viewId ?? lastViewId}
        version={version}
        open={Boolean(viewId)}
        onClose={() => setView(null)}
        onDecided={() => {
          setVersion((value) => value + 1);
          reload();
        }}
      />
    </div>
  );
}
