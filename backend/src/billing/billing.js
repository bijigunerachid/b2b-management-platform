// Billing rules shared by orders, payments, receivables, and the dashboard.
// Pure functions: no database access, so the money math is unit tested.
//
// Keep VAT_RATE and PAYMENT_TERMS_DAYS in sync with
// frontend/src/config/company.js (printed on invoices).

const VAT_RATE = 0.2;
const PAYMENT_TERMS_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Amounts are compared with half-a-cent tolerance to absorb DECIMAL→float noise.
const EPSILON = 0.005;

const PAYMENT_METHODS = ["Bank transfer", "Cheque", "Cash", "Card"];

const AGEING_BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"];

function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** Invoice total (TTC) from the order's pre-tax total (HT). */
function invoiceTotals(totalHt) {
    const subtotal = round2(totalHt);
    const vat = round2(subtotal * VAT_RATE);
    return { subtotal, vat, total: round2(subtotal + vat) };
}

function startOfDay(date) {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    return day;
}

function dueDateFor(createdAt) {
    const due = startOfDay(createdAt);
    due.setDate(due.getDate() + PAYMENT_TERMS_DAYS);
    return due;
}

function ageingBucket(daysOverdue) {
    if (daysOverdue <= 0) return "current";
    if (daysOverdue <= 30) return "1-30";
    if (daysOverdue <= 60) return "31-60";
    if (daysOverdue <= 90) return "61-90";
    return "90+";
}

/**
 * Billing summary for one order.
 * `paid` is the sum of non-voided payments.
 */
function billingSummary({ status, totalAmount, createdAt, paid = 0 }, now = new Date()) {
    const { total } = invoiceTotals(totalAmount);
    const amountPaid = round2(paid);
    const dueDate = dueDateFor(createdAt);

    if (status === "Cancelled") {
        return {
            total_due: total,
            amount_paid: amountPaid,
            balance: 0,
            due_date: dueDate,
            payment_status: "Void",
            overdue: false,
            days_overdue: 0,
            ageing_bucket: null
        };
    }

    const balance = Math.max(0, round2(total - amountPaid));
    const settled = balance <= EPSILON;
    const daysOverdue = settled
        ? 0
        : Math.max(0, Math.floor((startOfDay(now) - dueDate) / DAY_MS));

    let paymentStatus = "Unpaid";
    if (settled) paymentStatus = "Paid";
    else if (amountPaid > EPSILON) paymentStatus = "Partially paid";

    return {
        total_due: total,
        amount_paid: amountPaid,
        balance: settled ? 0 : balance,
        due_date: dueDate,
        payment_status: paymentStatus,
        overdue: daysOverdue > 0,
        days_overdue: daysOverdue,
        ageing_bucket: settled ? null : ageingBucket(daysOverdue)
    };
}

/** Attaches `billing` to an order row that has total_amount/created_at/status/amount_paid. */
function withBilling(order, now = new Date()) {
    return {
        ...order,
        billing: billingSummary(
            {
                status: order.status,
                totalAmount: order.total_amount,
                createdAt: order.created_at,
                paid: order.amount_paid
            },
            now
        )
    };
}

/**
 * Ageing report over open invoices (rows already carrying `billing`).
 * Returns per-bucket totals and the customers who owe the most.
 */
function ageingReport(openOrders) {
    const buckets = Object.fromEntries(
        AGEING_BUCKETS.map((bucket) => [bucket, { amount: 0, count: 0 }])
    );
    const byCustomer = new Map();

    let outstanding = 0;
    let overdue = 0;
    let overdueCount = 0;

    for (const order of openOrders) {
        const { balance, ageing_bucket: bucket, overdue: isOverdue } = order.billing;
        if (!bucket || balance <= EPSILON) continue;

        buckets[bucket].amount = round2(buckets[bucket].amount + balance);
        buckets[bucket].count += 1;
        outstanding = round2(outstanding + balance);

        if (isOverdue) {
            overdue = round2(overdue + balance);
            overdueCount += 1;
        }

        const customer = byCustomer.get(order.customer_id) ?? {
            customer_id: order.customer_id,
            company_name: order.company_name,
            balance: 0,
            overdue: 0,
            invoices: 0,
            oldest_days_overdue: 0
        };
        customer.balance = round2(customer.balance + balance);
        customer.invoices += 1;
        if (isOverdue) customer.overdue = round2(customer.overdue + balance);
        customer.oldest_days_overdue = Math.max(customer.oldest_days_overdue, order.billing.days_overdue);
        byCustomer.set(order.customer_id, customer);
    }

    const topDebtors = [...byCustomer.values()]
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10);

    return { outstanding, overdue, overdue_count: overdueCount, buckets, top_debtors: topDebtors };
}

module.exports = {
    AGEING_BUCKETS,
    EPSILON,
    PAYMENT_METHODS,
    PAYMENT_TERMS_DAYS,
    VAT_RATE,
    ageingBucket,
    ageingReport,
    billingSummary,
    dueDateFor,
    invoiceTotals,
    round2,
    withBilling
};
