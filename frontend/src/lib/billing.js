
export const PAYMENT_STATUS = {
  Paid: { tone: "success", icon: "checkCircle" },
  "Partially paid": { tone: "info", icon: "wallet" },
  Unpaid: { tone: "neutral", icon: "clock" },
  Overdue: { tone: "danger", icon: "alert" },
  Void: { tone: "neutral", icon: "ban" },
};

export const PAYMENT_METHODS = ["Bank transfer", "Cheque", "Cash", "Card"];

export const AGEING_BUCKETS = [
  { key: "current", label: "Not yet due" },
  { key: "1-30", label: "1–30 days" },
  { key: "31-60", label: "31–60 days" },
  { key: "61-90", label: "61–90 days" },
  { key: "90+", label: "90+ days" },
];

export function paymentBadge(billing) {
  if (!billing) return { label: "—", ...PAYMENT_STATUS.Unpaid };

  if (billing.overdue) {
    return {
      ...PAYMENT_STATUS.Overdue,
      label: `Overdue ${billing.days_overdue}d`,
      detail: billing.payment_status,
    };
  }

  return { ...PAYMENT_STATUS[billing.payment_status], label: billing.payment_status };
}

export function localDateInput(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
