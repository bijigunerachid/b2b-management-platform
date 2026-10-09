import company from "../config/company";

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

/** INV-2026-000123: year of the order plus the zero-padded order id. */
export function invoiceNumber(order) {
  const year = new Date(order.created_at).getFullYear() || new Date().getFullYear();
  return `INV-${year}-${String(order.id).padStart(6, "0")}`;
}

/**
 * Builds invoice figures from an order. Stored prices exclude VAT (HT);
 * VAT is applied once on the subtotal, as on a standard Moroccan invoice.
 */
export function buildInvoice(order, { vatRate = company.vatRate, termsDays = company.paymentTermsDays } = {}) {
  const lines = (order.items ?? []).map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    return {
      productId: item.product_id,
      description: item.product_name ?? `Product #${item.product_id}`,
      quantity,
      unitPrice,
      amount: round2(quantity * unitPrice),
    };
  });

  const subtotal = round2(lines.reduce((sum, line) => sum + line.amount, 0));
  const vat = round2(subtotal * vatRate);
  const total = round2(subtotal + vat);

  const issued = new Date(order.created_at);
  const due = new Date(issued);
  due.setDate(due.getDate() + termsDays);

  const state =
    order.status === "Cancelled" ? "void" : order.status === "Completed" ? "paid" : "due";

  return {
    number: invoiceNumber(order),
    issued,
    due,
    lines,
    subtotal,
    vatRate,
    vat,
    total,
    state,
  };
}
