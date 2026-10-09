// Keep nextStatuses() in sync with updateOrderStatus in the backend.

export const ORDER_STATUS = {
  Pending: {
    tone: "warning",
    color: "var(--warning)",
    soft: "var(--warning-soft)",
    icon: "clock",
    description: "Awaiting review",
  },
  Processing: {
    tone: "primary",
    color: "var(--primary)",
    soft: "var(--primary-soft)",
    icon: "truck",
    description: "Being prepared",
  },
  Completed: {
    tone: "success",
    color: "var(--success)",
    soft: "var(--success-soft)",
    icon: "checkCircle",
    description: "Delivered and paid",
  },
  Cancelled: {
    tone: "danger",
    color: "var(--danger)",
    soft: "var(--danger-soft)",
    icon: "ban",
    description: "Stopped; stock restored",
  },
};

export const STATUS_FLOW = ["Pending", "Processing", "Completed"];

export function nextStatuses(status) {
  if (status === "Pending") return ["Processing", "Cancelled"];
  if (status === "Processing") return ["Completed", "Cancelled"];
  return [];
}
