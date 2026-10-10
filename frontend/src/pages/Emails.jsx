import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import { EmailPreviewModal } from "../components/EmailPanel";
import { Badge, Card, EmptyState, ErrorState, InlineAlert, PageHeader, Pagination, SegmentedControl, TableHead, TableSkeleton, Th } from "../components/ui/primitives";
import { formatDate, timeAgo, useResource } from "../lib/api";
import { EMAIL_STATUS, EMAIL_TYPES } from "../lib/emails";

import { t } from "../i18n";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "invoice", label: "Invoices" },
  { value: "quote", label: "Quotes" },
  { value: "reminder", label: "Payment reminders" },
];

export default function Emails() {
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [previewId, setPreviewId] = useState(null);
  const query = new URLSearchParams({ page: String(page) });
  if (type !== "all") query.set("type", type);
  const { data, loading, error, reload } = useResource(`/emails?${query}`);
  const settings = useResource("/emails/settings").data?.data;
  const emails = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, totalPages: 1, limit: 25 };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Emails")}
        description={t("Quotes, invoices and payment reminders sent to clients. Click one to see it as the client received it.")}
        actions={<Button size="icon" variant="ghost" icon="refresh" onClick={reload} aria-label={t("Refresh")} title={t("Refresh")} className={loading ? "[&_svg]:animate-spin" : ""} />}
      />

      {settings && (
        <InlineAlert tone={settings.mode === "smtp" ? "success" : "info"}>
          {settings.mode === "smtp"
            ? t("Emails are sent from {from}.", { from: settings.from })
            : t("No mail server is set up: emails are saved here in the outbox and not sent. Set SMTP_HOST to send them.")}{" "}
          {settings.reminders.enabled
            ? t("Payment reminders go out {days} days before an invoice is due, once per invoice.", { days: settings.reminders.days_before })
            : t("Automatic payment reminders are off.")}
        </InlineAlert>
      )}

      <Card>
        <div className="border-b p-4" style={{ borderColor: "var(--border-color)" }}>
          <SegmentedControl
            label={t("Filter by type")}
            value={type}
            onChange={(value) => {
              setType(value);
              setPage(1);
            }}
            options={FILTERS.map((filter) => ({ value: filter.value, label: t(filter.label) }))}
          />
        </div>

        {error ? (
          <div className="p-5">
            <ErrorState message={error} onRetry={reload} />
          </div>
        ) : loading && !data ? (
          <TableSkeleton columns={5} />
        ) : emails.length === 0 ? (
          <EmptyState icon="mail" title={t("No emails yet")} description={t("Email an invoice from an order, or a quote from its page.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-start text-sm">
              <TableHead>
                <Th>{t("Email")}</Th>
                <Th>{t("Customer")}</Th>
                <Th>{t("Document")}</Th>
                <Th>{t("Status")}</Th>
                <Th>{t("Sent")}</Th>
              </TableHead>
              <tbody>
                {emails.map((email) => {
                  const status = EMAIL_STATUS[email.status];
                  return (
                    <tr
                      key={email.id}
                      onClick={() => setPreviewId(email.id)}
                      className="cursor-pointer border-t transition-colors hover:bg-[var(--surface-hover)]"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      <td className="max-w-[320px] px-5 py-3">
                        <button type="button" className="block max-w-full truncate text-start font-medium hover:underline app-text">
                          {email.subject}
                        </button>
                        <p className="truncate text-xs app-text-muted">
                          {t(EMAIL_TYPES[email.type])} · {email.recipient}
                        </p>
                      </td>
                      <td className="max-w-[200px] truncate px-5 py-3 app-text-secondary">{email.company_name ?? "—"}</td>
                      <td className="whitespace-nowrap px-5 py-3" onClick={(event) => event.stopPropagation()}>
                        {email.order_id ? (
                          <Link to={`/orders?view=${email.order_id}`} className="hover:underline" style={{ color: "var(--primary)" }}>
                            {t("Order #{id}", { id: email.order_id })}
                          </Link>
                        ) : email.quote_id ? (
                          <Link to={`/quotes?view=${email.quote_id}`} className="hover:underline" style={{ color: "var(--primary)" }}>
                            {t("Quote #{id}", { id: email.quote_id })}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={status?.tone} icon={status?.icon}>
                          {t(status?.label ?? email.status)}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-xs app-text-secondary">
                        <span title={formatDate(email.created_at, true)}>{timeAgo(email.created_at)}</span>
                        <span className="block app-text-muted">{email.sent_by_name ?? t("automatic")}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {emails.length > 0 && (
          <Pagination page={page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.limit} onPageChange={setPage} label={t("emails")} />
        )}
      </Card>

      <EmailPreviewModal emailId={previewId} onClose={() => setPreviewId(null)} />
    </div>
  );
}
