import { useParams } from "react-router-dom";
import company from "../config/company";
import { buildInvoice } from "../lib/invoice";
import { formatDate, money, useResource } from "../lib/api";
import {
  CustomerBlock,
  DetailsBlock,
  DocumentHeader,
  DocumentPage,
  Label,
  LegalFooter,
  LineTable,
  SellerBlock,
  Sheet,
  TotalsBlock,
  paper,
} from "../components/document/Document";

const stamps = {
  paid: { label: "PAID", color: paper.success },
  partial: { label: "PARTIALLY PAID", color: paper.info },
  overdue: { label: "OVERDUE", color: paper.danger },
  void: { label: "VOID", color: paper.danger },
  due: { label: "PAYMENT DUE", color: paper.warning },
};

function InvoiceSheet({ order, customer, payments }) {
  const invoice = buildInvoice(order);

  return (
    <Sheet label={`Invoice ${invoice.number}`} watermark={invoice.state === "void" ? "VOID" : null}>
      <DocumentHeader title="INVOICE" number={invoice.number} stamp={stamps[invoice.state]} />

      <section className="grid gap-8 py-7 sm:grid-cols-3">
        <SellerBlock />
        <CustomerBlock title="Bill to" customer={customer} fallbackName={order.company_name} />
        <DetailsBlock
          rows={[
            ["Issued", formatDate(invoice.issued)],
            ["Due", invoice.balance > 0 && invoice.state !== "void" ? formatDate(invoice.due) : "—", { danger: invoice.state === "overdue" }],
            ["Order", `#${order.id}`],
            ["Customer", `#${order.customer_id}`],
          ]}
        />
      </section>

      <LineTable lines={invoice.lines} />

      <section className="mt-6 flex flex-wrap items-start justify-between gap-8" style={{ breakInside: "avoid" }}>
        <div className="max-w-xs text-[12px] leading-5" style={{ color: paper.muted }}>
          <Label className="mb-1">Payment</Label>
          {["due", "partial", "overdue"].includes(invoice.state) && (
            <>
              <p>
                Bank transfer to {company.bank.name}
                <br />
                RIB: <span style={{ color: paper.ink }}>{company.bank.rib}</span>
              </p>
              <p className="mt-2">
                Please reference <span className="font-semibold" style={{ color: paper.ink }}>{invoice.number}</span>
                {invoice.state === "overdue" ? (
                  <span className="font-semibold" style={{ color: paper.danger }}>
                    . Payment is {invoice.daysOverdue} days overdue.
                  </span>
                ) : (
                  <>
                    {" "}and pay by <span className="font-semibold" style={{ color: paper.ink }}>{formatDate(invoice.due)}</span>.
                  </>
                )}
              </p>
            </>
          )}
          {invoice.state === "paid" && <p>Paid in full. Thank you for your business.</p>}
          {invoice.state === "void" && <p>No payment is due for this document.</p>}
        </div>

        <TotalsBlock
          subtotal={invoice.subtotal}
          vatRate={invoice.vatRate}
          vat={invoice.vat}
          total={invoice.total}
          after={
            invoice.state !== "void" &&
            invoice.amountPaid > 0 && (
              <>
                <div className="flex justify-between px-3 pt-3 text-[13px]">
                  <dt style={{ color: paper.muted }}>Amount paid</dt>
                  <dd className="tabular-nums" style={{ color: paper.success }}>
                    − {money(invoice.amountPaid)}
                  </dd>
                </div>
                <div className="flex justify-between px-3 pt-1.5 text-[14px] font-bold">
                  <dt>Balance due</dt>
                  <dd className="tabular-nums">{money(invoice.balance)}</dd>
                </div>
              </>
            )
          }
        />
      </section>

      {invoice.state !== "void" && payments.length > 0 && (
        <section className="mt-8" style={{ breakInside: "avoid" }}>
          <Label className="mb-2">Payments received</Label>
          <table className="w-full text-[12px]">
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b" style={{ borderColor: paper.rule }}>
                  <td className="py-1.5 pr-3">{formatDate(`${payment.paid_at}T00:00:00`)}</td>
                  <td className="py-1.5 pr-3">{payment.method}</td>
                  <td className="py-1.5 pr-3" style={{ color: paper.muted }}>
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

      <LegalFooter />
    </Sheet>
  );
}

export default function Invoice() {
  const { id } = useParams();
  const validId = /^\d+$/.test(id ?? "");
  const orderResource = useResource(validId ? `/orders/${id}` : null);
  const order = orderResource.data?.data;
  const customerResource = useResource(order ? `/customers/${order.customer_id}` : null);
  const paymentsResource = useResource(order ? `/orders/${order.id}/payments` : null);
  // Voided payments stay in the app's history but don't belong on the invoice.
  const payments = (paymentsResource.data?.data?.payments ?? []).filter((payment) => !payment.voided_at);
  const number = order ? buildInvoice(order).number : null;

  return (
    <DocumentPage
      backTo={order ? `/orders?view=${order.id}` : "/orders"}
      backLabel="Back to order"
      number={number}
      title={number ? `${number} · ${order.company_name}` : null}
      invalid={!validId}
      error={orderResource.error}
      onRetry={orderResource.reload}
      ready={Boolean(order) && !customerResource.loading && !paymentsResource.loading}
    >
      <InvoiceSheet order={order} customer={customerResource.data?.data} payments={payments} />
    </DocumentPage>
  );
}
