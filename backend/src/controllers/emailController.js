const pool = require("../config/database");
const { loadInvoice } = require("../email/documents");
const { mode, publicUrl, sendEmail, fromAddress } = require("../email/mailer");
const { daysBefore, remindersEnabled } = require("../email/reminders");
const { parseEmailRequest } = require("../email/request");
const { invoiceEmail } = require("../email/templates");

const PAGE_SIZE = 25;

function parseId(value) {
    return /^\d{1,10}$/.test(String(value)) && Number(value) > 0 ? Number(value) : null;
}

/** What the UI says after sending: sent, saved to the outbox, or failed. */
function outcome(result, sentMessage, outboxMessage) {
    if (result.status === "failed") {
        return { status: 502, body: { success: false, message: `The email couldn't be sent: ${result.error}`, data: result } };
    }
    return { status: 200, body: { success: true, message: result.status === "sent" ? sentMessage : outboxMessage, data: result } };
}

// POST /api/orders/:id/email { to?, language?, message? }
const emailInvoice = async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid order ID" });

    try {
        const invoice = await loadInvoice(pool, id);
        if (!invoice) return res.status(404).json({ success: false, message: "Order not found" });
        if (invoice.status === "Cancelled") return res.status(409).json({ success: false, message: "Cancelled orders have no invoice to send." });

        const { value, error } = parseEmailRequest(req.body, invoice.customer);
        if (error) return res.status(400).json({ success: false, message: error });

        const email = invoiceEmail(invoice, { language: value.language, portalUrl: publicUrl(), note: value.note });
        const result = await sendEmail(pool, email, {
            type: "invoice",
            to: value.to,
            language: value.language,
            customerId: invoice.customer.id,
            orderId: id,
            sentBy: req.user.userId
        });
        const { status, body } = outcome(result, `Invoice emailed to ${value.to}`, "Invoice saved to the outbox (no mail server is set up)");
        return res.status(status).json(body);
    } catch (err) {
        console.error("Email invoice error:", err);
        return res.status(500).json({ success: false, message: "The email could not be prepared." });
    }
};

// GET /api/emails?type=&order_id=&quote_id=&customer_id=&page=
const listEmails = async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const conditions = [];
    const params = [];
    if (["quote", "invoice", "reminder"].includes(req.query.type)) {
        conditions.push("e.type = ?");
        params.push(req.query.type);
    }
    for (const [query, column] of [["order_id", "e.order_id"], ["quote_id", "e.quote_id"], ["customer_id", "e.customer_id"]]) {
        const value = parseId(req.query[query]);
        if (value) {
            conditions.push(`${column} = ?`);
            params.push(value);
        }
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM email_log e ${where}`, params);
        const [rows] = await pool.query(
            `SELECT e.id, e.type, e.customer_id, c.company_name, e.order_id, e.quote_id, e.recipient, e.language,
                    e.subject, e.status, e.error, e.created_at, CONCAT(u.first_name, ' ', u.last_name) AS sent_by_name
             FROM email_log e
             LEFT JOIN customers c ON c.id = e.customer_id
             LEFT JOIN users u ON u.id = e.sent_by
             ${where}
             ORDER BY e.created_at DESC, e.id DESC
             LIMIT ? OFFSET ?`,
            [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]
        );
        return res.json({
            success: true,
            data: rows,
            pagination: { page, limit: PAGE_SIZE, total: Number(total), totalPages: Math.max(1, Math.ceil(Number(total) / PAGE_SIZE)) }
        });
    } catch (error) {
        if (error.code === "ER_NO_SUCH_TABLE") return res.json({ success: true, data: [], pagination: { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 } });
        console.error("List emails error:", error);
        return res.status(500).json({ success: false, message: "Failed to load emails" });
    }
};

// GET /api/emails/:id (with the HTML and text, for the preview)
const getEmail = async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid email ID" });
    try {
        const [[row]] = await pool.query(
            `SELECT e.*, c.company_name, CONCAT(u.first_name, ' ', u.last_name) AS sent_by_name
             FROM email_log e
             LEFT JOIN customers c ON c.id = e.customer_id
             LEFT JOIN users u ON u.id = e.sent_by
             WHERE e.id = ?`,
            [id]
        );
        if (!row) return res.status(404).json({ success: false, message: "Email not found" });
        const { dedupe_key: _dedupe, ...email } = row;
        return res.json({ success: true, data: email });
    } catch (error) {
        console.error("Get email error:", error);
        return res.status(500).json({ success: false, message: "Failed to load the email" });
    }
};

// GET /api/emails/settings
const getEmailSettings = (req, res) =>
    res.json({
        success: true,
        data: { mode: mode(), from: fromAddress(), reminders: { enabled: remindersEnabled(), days_before: daysBefore() } }
    });

module.exports = { emailInvoice, getEmail, getEmailSettings, listEmails, outcome, parseId };
