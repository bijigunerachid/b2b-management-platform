
export const PO_STATUS = {
  Draft: { tone: "neutral", icon: "edit", description: "Being prepared" },
  Ordered: { tone: "primary", icon: "truck", description: "Sent to the supplier, awaiting delivery" },
  Received: { tone: "success", icon: "checkCircle", description: "Delivered and added to stock" },
  Cancelled: { tone: "danger", icon: "ban", description: "Not going ahead" },
};

export const PO_STATUS_ORDER = ["Draft", "Ordered", "Received", "Cancelled"];

export const MOVEMENT_TYPES = {
  opening: { label: "Opening balance", tone: "neutral", icon: "box" },
  sale: { label: "Sale", tone: "primary", icon: "orders" },
  sale_cancelled: { label: "Sale cancelled", tone: "warning", icon: "refresh" },
  purchase_receipt: { label: "Purchase receipt", tone: "success", icon: "truck" },
  adjustment: { label: "Adjustment", tone: "info", icon: "edit" },
};

// Mirrors ADJUSTMENT_REASONS in backend/src/services/inventory.js.
export const ADJUSTMENT_REASONS = [
  "Stock count correction",
  "Damaged",
  "Lost or stolen",
  "Expired",
  "Returned by customer",
  "Found",
  "Other",
];

export function estimatedCost(price) {
  return Math.round(Number(price) * 0.6 * 100) / 100;
}
