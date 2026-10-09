import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { EmptyState, ErrorState } from "../components/ui/primitives";
import company from "../config/company";
import { buildInvoice } from "../lib/invoice";
import { formatDate, money, useResource } from "../lib/api";
import ThemeToggle from "../components/ThemeToggle";

// The sheet is paper: fixed light colors regardless of the app theme.
const ink = "#111827";
const muted = "#6b7280";
const rule = "#e5e7eb";
const accent = "#2563eb";

const stamps = {
  paid: { label: "PAID", color: "#15803d" },
  partial: { label: "PARTIALLY PAID", color: "#0e7490" },
  overdue: { label: "OVERDUE", color: "#b91c1c" },
  void: { label: "VOID", color: "#b91c1c" },
  due: { label: "PAYMENT DUE", color: "#b45309" },
};

function PartyBlock({ title, children }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: muted }}>
        {title}
      </p>
      <div className="space-y-0.5 text-[12.5px] leading-5" style={{ color: ink }}>
        {children}
      </div>
    </div>
  );
}

function InvoiceSheet({ order, customer, payments }) {
  const invoice = buildInvoice(order);
  const stamp = stamps[invoice.state];

  return (
    <article
      className="invoice-sheet relative mx-auto flex w-full max-w-[210mm] flex-col overflow-hidden bg-white shadow-xl print:shadow-none"
      style={{ color: ink, padding: "16mm 16mm 10mm" }}
      aria-label={`Invoice ${invoice.number}`}
    >
      {invoice.state === "void" && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-[140px] font-black tracking-widest"
          style={{ color: "rgb(185 28 28 / 7%)", transform: "rotate(-24deg)" }}
          aria-hidden="true"
        >
          VOID
        </div>
      )}

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-7" style={{ borderColor: rule }}>
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl text-white"
            style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
          >
            <Icon name="box" size={24} strokeWidth={2} />
          </div>
          <div>
            <p className="text-lg font-extrabold tracking-tight">{company.name}</p>
            <p className="text-[12px]" style={{ color: muted }}>
              {company.tagline}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[28px] font-extrabold leading-none tracking-tight" style={{ color: accent }}>
            INVOICE
          </p>
          <p className="mt-2 text-[13px] font-semibold">{invoice.number}</p>
          <span
            className="mt-3 inline-block rounded-md border-2 px-2.5 py-0.5 text-[11px] font-black tracking-[0.18em]"
            style={{ color: stamp.color, borderColor: stamp.color }}
          >
            {stamp.label}
          </span>
        </div>
      </header>

      {/* Parties and dates */}
      <section className="grid gap-8 py-7 sm:grid-cols-3">
        <PartyBlock title="From">
          <p className="font-semibold">{company.name}</p>
          <p>{company.address}</p>
          <p>{company.city}</p>
          <p>{company.phone}</p>
          <p>{company.email}</p>
        </PartyBlock>

        <PartyBlock title="Bill to">
          <p className="font-semibold">{customer?.company_name ?? order.company_name}</p>
          {customer?.contact_name && <p>Attn: {customer.contact_name}</p>}
          {customer?.address && <p>{customer.address}</p>}
          {(customer?.city || customer?.country) && (
            <p>{[customer.city, customer.country].filter(Boolean).join(", ")}</p>
          )}
          {customer?.email && <p>{customer.email}</p>}
          {customer?.phone && <p>{customer.phone}</p>}
        </PartyBlock>

        <PartyBlock title="Details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
            <dt style={{ color: muted }}>Issued</dt>
            <dd className="text-right font-medium">{formatDate(invoice.issued)}</dd>
            <dt style={{ color: muted }}>Due</dt>
            <dd className="text-right font-medium" style={invoice.state === "overdue" ? { color: "#b91c1c" } : undefined}>
              {invoice.balance > 0 && invoice.state !== "void" ? formatDate(invoice.due) : "—"}
            </dd>
            <dt style={{ color: muted }}>Order</dt>
            <dd className="text-right font-medium">#{order.id}</dd>
            <dt style={{ color: muted }}>Customer</dt>
            <dd className="text-right font-medium">#{order.customer_id}</dd>
          </dl>
        </PartyBlock>
      </section>

      {/* Lines */}
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr style={{ backgroundColor: "#f3f6fb" }}>
            <th className="rounded-l-md px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: muted }}>
              Description
            </th>
            <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: muted }}>
              Qty
            </th>
            <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: muted }}>
              Unit price (HT)
            </th>
            <th className="rounded-r-md px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: muted }}>
              Amount (HT)
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => (
            <tr key={line.productId} className="border-b" style={{ borderColor: rule, breakInside: "avoid" }}>
              <td className="px-3 py-3">
                <p className="font-semibold">{line.description}</p>
                <p className="text-[11px]" style={{ color: muted }}>
                  Ref. P-{String(line.productId).padStart(5, "0")}
                </p>
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{line.quantity}</td>
              <td className="px-3 py-3 text-right tabular-nums">{money(line.unitPrice)}</td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">{money(line.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <section className="mt-6 flex flex-wrap items-start justify-between gap-8" style={{ breakInside: "avoid" }}>
        <div className="max-w-xs text-[12px] leading-5" style={{ color: muted }}>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em]">Payment</p>
          {["due", "partial", "overdue"].includes(invoice.state) && (
            <>
              <p>
                Bank transfer to {company.bank.name}
                <br />
                RIB: <span style={{ color: ink }}>{company.bank.rib}</span>
              </p>
              <p className="mt-2">
                Please reference <span className="font-semibold" style={{ color: ink }}>{invoice.number}</span>
                {invoice.state === "overdue" ? (
                  <span className="font-semibold" style={{ color: "#b91c1c" }}>
                    . Payment is {invoice.daysOverdue} days overdue.
                  </span>
                ) : (
                  <>
                    {" "}and pay by <span className="font-semibold" style={{ color: ink }}>{formatDate(invoice.due)}</span>.
                  </>
                )}
              </p>
            </>
          )}
          {invoice.state === "paid" && <p>Paid in full. Thank you for your business.</p>}
          {invoice.state === "void" && <p>No payment is due for this document.</p>}
        </div>

        <dl className="w-full max-w-[280px] text-[13px]">
          <div className="flex justify-between py-1.5">
            <dt style={{ color: muted }}>Subtotal (HT)</dt>
            <dd className="tabular-nums">{money(invoice.subtotal)}</dd>
          </div>
          <div className="flex justify-between border-b py-1.5" style={{ borderColor: rule }}>
            <dt style={{ color: muted }}>VAT (TVA {Math.round(invoice.vatRate * 100)}%)</dt>
            <dd className="tabular-nums">{money(invoice.vat)}</dd>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-3" style={{ backgroundColor: "#eff4ff" }}>
            <dt className="font-bold">Total (TTC)</dt>
            <dd className="text-lg font-extrabold tabular-nums" style={{ color: accent }}>
              {money(invoice.total)}
            </dd>
          </div>
          {invoice.state !== "void" && invoice.amountPaid > 0 && (
            <>
              <div className="flex justify-between px-3 pt-3 text-[13px]">
                <dt style={{ color: muted }}>Amount paid</dt>
                <dd className="tabular-nums" style={{ color: "#15803d" }}>
                  − {money(invoice.amountPaid)}
                </dd>
              </div>
              <div className="flex justify-between px-3 pt-1.5 text-[14px] font-bold">
                <dt>Balance due</dt>
                <dd className="tabular-nums">{money(invoice.balance)}</dd>
              </div>
            </>
          )}
        </dl>
      </section>

      {invoice.state !== "void" && payments.length > 0 && (
        <section className="mt-8" style={{ breakInside: "avoid" }}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: muted }}>
            Payments received
          </p>
          <table className="w-full text-[12px]">
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b" style={{ borderColor: rule }}>
                  <td className="py-1.5 pr-3">{formatDate(`${payment.paid_at}T00:00:00`)}</td>
                  <td className="py-1.5 pr-3">{payment.method}</td>
                  <td className="py-1.5 pr-3" style={{ color: muted }}>
                    {payment.reference || "—"}
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{money(payment.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {invoice.state === "void" && (
        <p className="mt-6 mb-10 rounded-lg border px-4 py-3 text-[12px]" style={{ borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#991b1b" }}>
          This order was cancelled. This document is void and no payment is due.
        </p>
      )}

      <div className="min-h-10 flex-1" />

      {/* Legal footer */}
      <footer
        className="mt-auto border-t pt-4 text-center text-[10px] leading-4"
        style={{ borderColor: rule, color: muted }}
      >
        {company.name} · ICE {company.ice} · RC {company.rc} · IF {company.taxId} · Patente {company.patente}
        <br />
        {company.website} · {company.email} · {company.phone}
      </footer>
    </article>
  );
}

export default function Invoice() {
  const { id } = useParams();
  const validId = /^\d+$/.test(id ?? "");
  const orderResource = useResource(validId ? `/orders/${id}` : null);
  const order = orderResource.data?.data;
  const customerResource = useResource(order ? `/customers/${order.customer_id}` : null);
  const customer = customerResource.data?.data;
  const paymentsResource = useResource(order ? `/orders/${order.id}/payments` : null);
  // Voided payments stay in the app's history but don't belong on the invoice.
  const payments = (paymentsResource.data?.data?.payments ?? []).filter((payment) => !payment.voided_at);

  const number = order ? buildInvoice(order).number : null;

  // The document title becomes the default PDF filename.
  useEffect(() => {
    if (!number) return undefined;
    const previous = document.title;
    document.title = `${number} · ${order.company_name}`;
    return () => {
      document.title = previous;
    };
  }, [number, order?.company_name]);

  const ready = order && !customerResource.loading && !paymentsResource.loading;

  return (
    <div className="min-h-screen pb-12 print:min-h-0 print:bg-white print:pb-0" style={{ backgroundColor: "var(--app-bg)" }}>
      {/* Toolbar (screen only) */}
      <div
        className="sticky top-0 z-10 border-b backdrop-blur-md print:hidden"
        style={{ backgroundColor: "color-mix(in srgb, var(--surface) 85%, transparent)", borderColor: "var(--border-color)" }}
      >
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-3 px-4 py-3">
          <Link
            to={order ? `/orders?view=${order.id}` : "/orders"}
            className="inline-flex items-center gap-1.5 text-sm font-semibold app-text-secondary hover:text-[var(--text-primary)]"
          >
            <Icon name="chevronLeft" size={17} /> Back to order
          </Link>
          {number && <span className="hidden text-sm app-text-muted sm:inline">· {number}</span>}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button variant="primary" icon="download" onClick={() => window.print()} disabled={!ready}>
              Print / Save as PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-8 print:p-0">
        {!validId ? (
          <EmptyState icon="alert" title="Invalid invoice" description="This invoice link is not valid." />
        ) : orderResource.error ? (
          <div className="mx-auto max-w-[210mm]">
            <ErrorState message={orderResource.error} onRetry={orderResource.reload} />
          </div>
        ) : !ready ? (
          <div className="skeleton mx-auto aspect-[210/297] w-full max-w-[210mm] rounded-none" />
        ) : (
          <div className="animate-rise print:animate-none">
            <InvoiceSheet order={order} customer={customer} payments={payments} />
          </div>
        )}
      </div>
    </div>
  );
}
