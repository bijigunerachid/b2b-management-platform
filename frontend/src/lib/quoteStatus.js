
export const QUOTE_STATUS = {
  Draft: { tone: "neutral", icon: "edit", description: "Being prepared" },
  Sent: { tone: "primary", icon: "send", description: "Awaiting the customer's answer" },
  Accepted: { tone: "success", icon: "checkCircle", description: "Ready to convert into an order" },
  Rejected: { tone: "danger", icon: "thumbsDown", description: "Declined by the customer" },
  Expired: { tone: "warning", icon: "clock", description: "Validity date has passed" },
  Converted: { tone: "info", icon: "orders", description: "Turned into an order" },
};

export const QUOTE_STATUS_ORDER = ["Draft", "Sent", "Accepted", "Expired", "Rejected", "Converted"];

export function validityLabel(quote) {
  if (!["Draft", "Sent", "Expired"].includes(quote.status)) return null;
  const days = quote.days_left;
  if (days > 1) return `${days} days left`;
  if (days === 1) return "1 day left";
  if (days === 0) return "Expires today";
  return `Expired ${-days} day${days === -1 ? "" : "s"} ago`;
}
