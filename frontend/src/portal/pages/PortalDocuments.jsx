// Printable invoice and quote for portal clients: the same documents staff
// print, loaded through the client-scoped portal API.

import { useParams } from "react-router-dom";
import { DocumentPage } from "../../components/document/Document";
import { InvoiceSheet } from "../../pages/Invoice";
import { QuoteSheet } from "../../pages/QuoteDocument";
import { buildInvoice } from "../../lib/invoice";
import { useResource } from "../../lib/api";

export function PortalInvoice() {
  const { id } = useParams();
  const validId = /^\d+$/.test(id ?? "");
  const { data, error, reload } = useResource(validId ? `/portal/orders/${id}` : null);
  const order = data?.data;
  const number = order ? buildInvoice(order).number : null;

  return (
    <DocumentPage
      backTo={order ? `/portal/orders?view=${order.id}` : "/portal/orders"}
      backLabel="Back to order"
      number={number}
      title={number ? `${number} · ${order.company_name}` : null}
      invalid={!validId}
      error={error}
      onRetry={reload}
      ready={Boolean(order)}
    >
      <InvoiceSheet order={order} customer={order?.customer} payments={order?.payments ?? []} />
    </DocumentPage>
  );
}

export function PortalQuoteDocument() {
  const { id } = useParams();
  const validId = /^\d+$/.test(id ?? "");
  const { data, error, reload } = useResource(validId ? `/portal/quotes/${id}` : null);
  const quote = data?.data;

  return (
    <DocumentPage
      backTo={quote ? `/portal/quotes?view=${quote.id}` : "/portal/quotes"}
      backLabel="Back to quote"
      number={quote?.number}
      title={quote ? `${quote.number} · ${quote.company_name}` : null}
      invalid={!validId}
      error={error}
      onRetry={reload}
      ready={Boolean(quote)}
    >
      <QuoteSheet quote={quote} customer={quote?.customer} />
    </DocumentPage>
  );
}
