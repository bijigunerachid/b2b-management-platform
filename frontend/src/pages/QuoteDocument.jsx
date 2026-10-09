import { useParams } from "react-router-dom";
import company from "../config/company";
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
  Draft: { label: "DRAFT", color: paper.muted },
  Sent: { label: "AWAITING APPROVAL", color: paper.accent },
  Accepted: { label: "ACCEPTED", color: paper.success },
  Converted: { label: "ACCEPTED", color: paper.success },
  Rejected: { label: "DECLINED", color: paper.danger },
  Expired: { label: "EXPIRED", color: paper.warning },
};

function QuoteSheet({ quote, customer }) {
  const lines = quote.items.map((item) => ({
    productId: item.product_id,
    description: item.product_name,
    quantity: item.quantity,
    unitPrice: Number(item.unit_price),
    listPrice: Number(item.list_price),
    amount: Number(item.subtotal),
  }));

  const listTotal = lines.reduce((sum, line) => sum + line.listPrice * line.quantity, 0);
  const savings = Math.round((listTotal - quote.total_amount) * 100) / 100;
  const hasDiscount = savings > 0.004;
  const watermark = quote.status === "Draft" ? "DRAFT" : quote.status === "Expired" ? "EXPIRED" : null;

  return (
    <Sheet label={`Quote ${quote.number}`} watermark={watermark}>
      <DocumentHeader title="QUOTE" number={quote.number} stamp={stamps[quote.status]} />

      <section className="grid gap-8 py-7 sm:grid-cols-3">
        <SellerBlock />
        <CustomerBlock title="Prepared for" customer={customer} fallbackName={quote.company_name} />
        <DetailsBlock
          rows={[
            ["Date", formatDate(quote.sent_at ?? quote.created_at)],
            ["Valid until", formatDate(`${quote.valid_until}T00:00:00`), { danger: quote.status === "Expired" }],
            ["Customer", `#${quote.customer_id}`],
            ...(quote.created_by_name ? [["Prepared by", quote.created_by_name]] : []),
          ]}
        />
      </section>

      <LineTable lines={lines} showDiscount={hasDiscount} />

      <section className="mt-6 flex flex-wrap items-start justify-between gap-8" style={{ breakInside: "avoid" }}>
        <div className="max-w-xs space-y-3 text-[12px] leading-5" style={{ color: paper.muted }}>
          {quote.notes && (
            <div>
              <Label className="mb-1">Notes</Label>
              <p style={{ color: paper.ink }}>{quote.notes}</p>
            </div>
          )}
          <div>
            <Label className="mb-1">Terms</Label>
            <p>
              Prices are in Moroccan dirhams and valid until {formatDate(`${quote.valid_until}T00:00:00`)}, subject to stock
              availability. Payment due {company.paymentTermsDays} days after invoice.
            </p>
          </div>
        </div>

        <TotalsBlock
          subtotal={quote.total_amount}
          vatRate={company.vatRate}
          vat={quote.vat}
          total={quote.total_with_vat}
          before={
            hasDiscount && (
              <div className="flex justify-between py-1.5">
                <dt style={{ color: paper.muted }}>You save</dt>
                <dd className="font-semibold tabular-nums" style={{ color: paper.success }}>
                  {money(savings)}
                </dd>
              </div>
            )
          }
        />
      </section>

      {/* Acceptance */}
      <section className="mt-10 grid gap-6 sm:grid-cols-2" style={{ breakInside: "avoid" }}>
        <div>
          <Label className="mb-2">For {company.name}</Label>
          <div className="h-24 rounded-lg border border-dashed" style={{ borderColor: paper.rule }} />
          <p className="mt-1.5 text-[11px]" style={{ color: paper.muted }}>
            {quote.created_by_name ?? "Authorized signature"}
          </p>
        </div>
        <div>
          <Label className="mb-2">Customer acceptance</Label>
          <div className="h-24 rounded-lg border border-dashed" style={{ borderColor: paper.rule }} />
          <p className="mt-1.5 text-[11px]" style={{ color: paper.muted }}>
            Name, date, signature and company stamp: “Bon pour accord”
          </p>
        </div>
      </section>

      <LegalFooter />
    </Sheet>
  );
}

export default function QuoteDocument() {
  const { id } = useParams();
  const validId = /^\d+$/.test(id ?? "");
  const quoteResource = useResource(validId ? `/quotes/${id}` : null);
  const quote = quoteResource.data?.data;
  const customerResource = useResource(quote ? `/customers/${quote.customer_id}` : null);

  return (
    <DocumentPage
      backTo={quote ? `/quotes?view=${quote.id}` : "/quotes"}
      backLabel="Back to quote"
      number={quote?.number}
      title={quote ? `${quote.number} · ${quote.company_name}` : null}
      invalid={!validId}
      error={quoteResource.error}
      onRetry={quoteResource.reload}
      ready={Boolean(quote) && !customerResource.loading}
    >
      <QuoteSheet quote={quote} customer={customerResource.data?.data} />
    </DocumentPage>
  );
}
