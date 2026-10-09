import company from "../config/company";

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

// e.g. INV-2026-000123
export function invoiceNumber(order) {
  const year = new Date(order.created_at).getFullYear() || new Date().getFullYear();
  return `INV-${year}-${String(order.id).padStart(6, "0")}`;
}

// Prices are stored without VAT; VAT is applied once on the subtotal.
export function buildInvoice(order, { vatRate = company.vatRate, termsDays = company.paymentTermsDays } = {}) {
  const lines = (order.items ?? []).map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    return {
      productId: item.product_id,
      description: item.product_name ?? `Product #${item.product_id}`,
      quantity,
      unitPrice,
      listPrice: item.list_price === null || item.list_price === undefined ? unitPrice : Number(item.list_price),
      amount: round2(quantity * unitPrice),
    };
  });

  const subtotal = round2(lines.reduce((sum, line) => sum + line.amount, 0));
  const vat = round2(subtotal * vatRate);
  const total = round2(subtotal + vat);

  const issued = new Date(order.created_at);
  const due = new Date(issued);
  due.setDate(due.getDate() + termsDays);

  const billing = order.billing;
  const state =
    order.status === "Cancelled"
      ? "void"
      : billing?.payment_status === "Credited"
        ? "credited"
        : billing?.payment_status === "Paid"
        ? "paid"
        : billing?.overdue
          ? "overdue"
          : billing?.payment_status === "Partially paid"
            ? "partial"
            : "due";

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
    amountPaid: billing?.amount_paid ?? 0,
    credited: billing?.credited ?? 0,
    refunded: billing?.refunded ?? 0,
    balance: billing?.balance ?? total,
    daysOverdue: billing?.days_overdue ?? 0,
  };
}
