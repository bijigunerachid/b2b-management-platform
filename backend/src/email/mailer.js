// Sends emails through SMTP and records every one in email_log.
//
// Without SMTP_HOST (or in demo mode, where visitors could otherwise email
// anyone) nothing leaves the server: the email is saved with status "outbox"
// and can be read in the app. That keeps local development, tests and the
// public demo safe while showing exactly what a client would receive.

const nodemailer = require("nodemailer");
const company = require("../config/company");
const { isDemoMode } = require("../config/demo");

let transport = null;

function smtpConfigured() {
    return Boolean(process.env.SMTP_HOST) && !isDemoMode();
}

function mode() {
    return smtpConfigured() ? "smtp" : "outbox";
}

function getTransport() {
    if (!transport) {
        transport = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            // Port 465 uses TLS from the start; 587 and 25 upgrade with STARTTLS.
            secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : Number(process.env.SMTP_PORT) === 465,
            auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
        });
    }
    return transport;
}

/** Address emails come from: MAIL_FROM, or the company's billing address. */
function fromAddress() {
    return process.env.MAIL_FROM || `"${company.name}" <${company.email}>`;
}

/** Where links in emails point (the client portal). */
function publicUrl() {
    const url = process.env.PUBLIC_URL || (process.env.CORS_ORIGIN || "http://localhost:5173").split(",")[0];
    return url.trim().replace(/\/+$/, "");
}

/**
 * Sends (or saves) one email and records it. `email`: { subject, html, text };
 * `meta`: { type, to, language, customerId, orderId, quoteId, sentBy, dedupeKey }.
 * Resolves to the log row's { id, status, error }. With a dedupeKey that was
 * already used, nothing is sent and it resolves to null.
 */
async function sendEmail(connection, email, meta, { transportImpl = null } = {}) {
    const base = [
        meta.type, meta.customerId ?? null, meta.orderId ?? null, meta.quoteId ?? null,
        meta.to, meta.language, email.subject.slice(0, 255), email.html, email.text
    ];

    // Claim the dedupe key first, so two instances can't both send a reminder.
    let logId = null;
    if (meta.dedupeKey) {
        try {
            const [claim] = await connection.query(
                `INSERT INTO email_log (type, customer_id, order_id, quote_id, recipient, language, subject, html, text_body, status, sent_by, dedupe_key)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'outbox', ?, ?)`,
                [...base, meta.sentBy ?? null, meta.dedupeKey]
            );
            logId = claim.insertId;
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") return null;
            throw error;
        }
    }

    let status = "outbox";
    let errorMessage = null;
    let messageId = null;
    if (transportImpl || smtpConfigured()) {
        try {
            const info = await (transportImpl ?? getTransport()).sendMail({
                from: fromAddress(),
                to: meta.to,
                subject: email.subject,
                html: email.html,
                text: email.text
            });
            status = "sent";
            messageId = info?.messageId ?? null;
        } catch (error) {
            status = "failed";
            errorMessage = String(error.message || error).slice(0, 500);
        }
    }

    if (logId) {
        await connection.query("UPDATE email_log SET status = ?, error = ?, message_id = ? WHERE id = ?", [status, errorMessage, messageId, logId]);
    } else {
        const [insert] = await connection.query(
            `INSERT INTO email_log (type, customer_id, order_id, quote_id, recipient, language, subject, html, text_body, status, error, message_id, sent_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [...base, status, errorMessage, messageId, meta.sentBy ?? null]
        );
        logId = insert.insertId;
    }
    return { id: logId, status, error: errorMessage };
}

module.exports = { fromAddress, mode, publicUrl, sendEmail, smtpConfigured };
