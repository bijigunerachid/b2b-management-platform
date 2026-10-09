const {
    ageingBucket,
    ageingReport,
    billingSummary,
    invoiceTotals,
    withBilling
} = require("../billing/billing");

const now = new Date(2026, 9, 9, 15, 0, 0); // 9 Oct 2026

describe("invoiceTotals", () => {
    test("adds 20% VAT with cent rounding, matching the printed invoice", () => {
        expect(invoiceTotals(22325.86)).toEqual({ subtotal: 22325.86, vat: 4465.17, total: 26791.03 });
        expect(invoiceTotals("9625.97")).toEqual({ subtotal: 9625.97, vat: 1925.19, total: 11551.16 });
        expect(invoiceTotals(0.05)).toEqual({ subtotal: 0.05, vat: 0.01, total: 0.06 });
    });
});

describe("billingSummary", () => {
    const base = { status: "Completed", totalAmount: 1000, createdAt: new Date(2026, 8, 1) }; // due 1 Oct

    test("unpaid past due is overdue with days counted from the due date", () => {
        const summary = billingSummary(base, now);
        expect(summary).toMatchObject({
            total_due: 1200,
            amount_paid: 0,
            balance: 1200,
            payment_status: "Unpaid",
            overdue: true,
            days_overdue: 8,
            ageing_bucket: "1-30"
        });
    });

    test("partial payment reduces the balance", () => {
        const summary = billingSummary({ ...base, paid: 500 }, now);
        expect(summary).toMatchObject({ balance: 700, payment_status: "Partially paid", overdue: true });
    });

    test("fully paid is never overdue and has no bucket", () => {
        const summary = billingSummary({ ...base, paid: "1200.00" }, now);
        expect(summary).toMatchObject({ balance: 0, payment_status: "Paid", overdue: false, days_overdue: 0, ageing_bucket: null });
    });

    test("tolerates sub-cent float noise when settling", () => {
        expect(billingSummary({ ...base, paid: 1199.996 }, now).payment_status).toBe("Paid");
    });

    test("within terms is current, not overdue", () => {
        const summary = billingSummary({ ...base, createdAt: new Date(2026, 9, 1) }, now);
        expect(summary).toMatchObject({ overdue: false, days_overdue: 0, ageing_bucket: "current" });
    });

    test("is due on the due date itself, overdue from the next day", () => {
        expect(billingSummary({ ...base, createdAt: new Date(2026, 8, 9, 18) }, now).overdue).toBe(false);
        expect(billingSummary({ ...base, createdAt: new Date(2026, 8, 8, 9) }, now).days_overdue).toBe(1);
    });

    test("cancelled orders are void with nothing owed", () => {
        const summary = billingSummary({ ...base, status: "Cancelled" }, now);
        expect(summary).toMatchObject({ payment_status: "Void", balance: 0, overdue: false, ageing_bucket: null });
    });
});

describe("ageing", () => {
    test.each([
        [0, "current"],
        [1, "1-30"],
        [30, "1-30"],
        [31, "31-60"],
        [61, "61-90"],
        [91, "90+"]
    ])("%i days overdue → %s", (days, bucket) => {
        expect(ageingBucket(days)).toBe(bucket);
    });

    test("report totals buckets, overdue amounts, and ranks debtors", () => {
        const rows = [
            { id: 1, customer_id: 7, company_name: "Atlas", status: "Completed", total_amount: 1000, created_at: new Date(2026, 5, 1), amount_paid: 0 },
            { id: 2, customer_id: 7, company_name: "Atlas", status: "Pending", total_amount: 500, created_at: new Date(2026, 9, 5), amount_paid: 100 },
            { id: 3, customer_id: 9, company_name: "Souss", status: "Completed", total_amount: 100, created_at: new Date(2026, 8, 1), amount_paid: 0 },
            { id: 4, customer_id: 9, company_name: "Souss", status: "Completed", total_amount: 100, created_at: new Date(2026, 8, 1), amount_paid: 120 },
            { id: 5, customer_id: 9, company_name: "Souss", status: "Cancelled", total_amount: 900, created_at: new Date(2026, 1, 1), amount_paid: 0 }
        ].map((row) => withBilling(row, now));

        const report = ageingReport(rows);

        expect(report.outstanding).toBe(1200 + 500 + 120);
        expect(report.overdue).toBe(1200 + 120);
        expect(report.overdue_count).toBe(2);
        expect(report.buckets["90+"]).toEqual({ amount: 1200, count: 1 });
        expect(report.buckets.current).toEqual({ amount: 500, count: 1 });
        expect(report.buckets["1-30"]).toEqual({ amount: 120, count: 1 });
        expect(report.top_debtors[0]).toMatchObject({ customer_id: 7, balance: 1700, overdue: 1200, invoices: 2 });
        expect(report.top_debtors[1]).toMatchObject({ customer_id: 9, balance: 120, invoices: 1 });
    });
});
