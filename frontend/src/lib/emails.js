// Labels for emails sent to clients (statuses and kinds of email).

export const EMAIL_STATUS = {
  sent: { label: "Sent", tone: "success", icon: "checkCircle" },
  outbox: { label: "In the outbox", tone: "neutral", icon: "clock" },
  failed: { label: "Failed", tone: "danger", icon: "alert" },
};

export const EMAIL_TYPES = { quote: "Quote", invoice: "Invoice", reminder: "Payment reminder" };
