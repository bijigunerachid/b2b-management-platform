// Payment reminders: one email per invoice, a few days before it falls due.

const { loadOpenInvoices } = require("../billing/queries");
const { loadInvoice, localDay } = require("./documents");
const { publicUrl, sendEmail } = require("./mailer");
const { reminderEmail } = require("./templates");

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 60 * 60 * 1000; // hourly; each invoice is reminded once at most

function daysBefore() {
    const value = Number(process.env.EMAIL_REMINDER_DAYS);
    return Number.isInteger(value) && value >= 1 && value <= 30 ? value : 3;
}

function remindersEnabled() {
    return process.env.EMAIL_REMINDERS !== "false";
}

function startOfDay(date) {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    return day;
}

/**
 * Which open invoices should get a reminder now: money still owed, not late
 * yet, due within `days` days, and the customer has an email address and
 * hasn't turned reminders off. Pure: `invoices` come from loadOpenInvoices
 * with the customer's email settings added.
 */
function invoicesToRemind(invoices, now = new Date(), days = daysBefore()) {
    const today = startOfDay(now);
    return invoices
        .map((invoice) => {
            const due = startOfDay(invoice.billing.due_date);
            return { ...invoice, days_left: Math.round((due - today) / DAY_MS) };
        })
        .filter(
            (invoice) =>
                invoice.status !== "Cancelled" &&
                invoice.billing.balance > 0.005 &&
                invoice.days_left >= 0 &&
                invoice.days_left <= days &&
                Boolean(invoice.email) &&
                Boolean(Number(invoice.payment_reminders))
        );
}

/** Sends the reminders that are due. Returns how many were sent or saved. */
async function runReminders(pool, now = new Date(), options = {}) {
    if (!remindersEnabled()) return { checked: 0, sent: 0 };
    const open = await loadOpenInvoices(pool, now);
    if (!open.length) return { checked: 0, sent: 0 };

    const [customers] = await pool.query("SELECT id, email, payment_reminders FROM customers WHERE id IN (?)", [
        [...new Set(open.map((invoice) => invoice.customer_id))]
    ]);
    const settings = new Map(customers.map((customer) => [customer.id, customer]));
    const due = invoicesToRemind(
        open.map((invoice) => ({ ...invoice, ...settings.get(invoice.customer_id), id: invoice.id })),
        now
    );

    let sent = 0;
    for (const invoice of due) {
        const document = await loadInvoice(pool, invoice.id, now);
        if (!document?.customer?.email) continue;
        const language = document.customer.email_language || "fr";
        const email = reminderEmail(document, { language, portalUrl: publicUrl(), daysLeft: invoice.days_left });
        const result = await sendEmail(
            pool,
            email,
            {
                type: "reminder",
                to: document.customer.email,
                language,
                customerId: document.customer.id,
                orderId: invoice.id,
                // One reminder per invoice and due date (a credit note doesn't change the due date).
                dedupeKey: `reminder:${invoice.id}:${localDay(invoice.billing.due_date)}`
            },
            options
        );
        if (result) sent += 1;
    }
    return { checked: open.length, sent };
}

/** Starts the hourly check in the API process. Returns a function that stops it. */
function scheduleReminders(pool) {
    if (!remindersEnabled()) return () => {};
    const run = () =>
        runReminders(pool).catch((error) => {
            if (error.code !== "ER_NO_SUCH_TABLE") console.error("Payment reminders failed:", error.message);
        });
    const first = setTimeout(run, 60 * 1000); // let the server finish starting
    const timer = setInterval(run, CHECK_EVERY_MS);
    first.unref?.();
    timer.unref?.();
    return () => {
        clearTimeout(first);
        clearInterval(timer);
    };
}

module.exports = { daysBefore, invoicesToRemind, remindersEnabled, runReminders, scheduleReminders };
