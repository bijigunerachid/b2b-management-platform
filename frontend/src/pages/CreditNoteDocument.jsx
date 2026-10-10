import { useParams } from "react-router-dom";
import { invoiceNumber } from "../lib/invoice";
import { formatDate, money, useResource } from "../lib/api";
import company from "../config/company";
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

import { t } from "../i18n";
export function CreditNoteSheet({ note }) {
  const invoice = invoiceNumber({ id: note.order_id, created_at: note.order_created_at });
  const lines = note.items.map((item) => ({
    productId: item.product_id,
    description: item.product_name,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    amount: item.amount,
  }));
  const applied = Math.round((note.total - note.refund_amount) * 100) / 100;

  return (
    <Sheet label={t("Credit note {number}", { number: note.number })}>
      <DocumentHeader title={t("CREDIT NOTE")} number={note.number} />

      <section className="grid gap-8 py-7 sm:grid-cols-3">
        <SellerBlock />
        <CustomerBlock title={t("Credit to")} customer={note.customer} fallbackName={note.customer?.company_name} />
        <DetailsBlock
          rows={[
            ["Date", formatDate(note.created_at)],
            ["Invoice", invoice],
            ["Order", `#${note.order_id}`],
            ["Reason", t(note.reason)],
          ]}
        />
      </section>

      <LineTable lines={lines} />

      <section className="mt-6 flex flex-wrap items-start justify-between gap-8" style={{ breakInside: "avoid" }}>
        <div className="max-w-xs space-y-3 text-[12px] leading-5" style={{ color: paper.muted }}>
          {note.note && (
            <div>
              <Label className="mb-1">{t("Note")}</Label>
              <p style={{ color: paper.ink }}>{note.note}</p>
            </div>
          )}
          <div>
            <Label className="mb-1">{t("Settlement")}</Label>
            {applied > 0 && (
              <p>
                {t("{amount} is deducted from invoice {invoice}.", { amount: money(applied), invoice })}
              </p>
            )}
            {note.refund_amount > 0 && (
              <p>
                {t("{amount} refunded by {method}.", { amount: money(note.refund_amount), method: t(note.refund_method).toLowerCase() })}
              </p>
            )}
          </div>
        </div>

        <TotalsBlock subtotal={note.subtotal} vatRate={company.vatRate} vat={note.vat} total={note.total} />
      </section>

      <LegalFooter />
    </Sheet>
  );
}

export default function CreditNoteDocument() {
  const { id } = useParams();
  const validId = /^\d+$/.test(id ?? "");
  const { data, error, reload } = useResource(validId ? `/credit-notes/${id}` : null);
  const note = data?.data;

  return (
    <DocumentPage
      backTo={note ? `/orders?view=${note.order_id}` : "/credit-notes"}
      backLabel={t("Back to order")}
      number={note?.number}
      title={note ? `${note.number} · ${note.customer?.company_name}` : null}
      invalid={!validId}
      error={error}
      onRetry={reload}
      ready={Boolean(note)}
    >
      <CreditNoteSheet note={note} />
    </DocumentPage>
  );
}
