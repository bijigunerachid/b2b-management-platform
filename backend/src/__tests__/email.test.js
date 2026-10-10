const request = require("supertest");
const app = require("../server");
const { can } = require("../config/permissions");
const { invoiceEmail, quoteEmail, reminderEmail, whenText } = require("../email/templates");
const { parseEmailRequest } = require("../email/request");
const { invoicesToRemind } = require("../email/reminders");
const { sendEmail, mode } = require("../email/mailer");

const invoice = {
    number: "INV-2026-000012",
    order_id: 12,
    customer: { id: 3, company_name: "Atlas <b>SARL</b>", contact_name: "Youssef" },
    due_date: "2026-10-13",
    items: [{ product_name: "Toner <script>alert(1)</script>", quantity: 3, unit_price: 120 }],
    subtotal: 360,
    vat: 72,
    total: 432,
    credited: 0,
    paid: 100,
    balance: 332
};

describe("email templates", () => {
    test.each([
        ["en", "Invoice INV-2026-000012 from B2B Platform SARL", 'dir="ltr"'],
        ["fr", "Facture INV-2026-000012 de B2B Platform SARL", 'dir="ltr"'],
        ["ar", "الفاتورة INV-2026-000012 من B2B Platform SARL", 'dir="rtl"']
    ])("invoice in %s", (language, subject, dir) => {
        const email = invoiceEmail(invoice, { language, portalUrl: "https://demo.example" });
        expect(email.subject).toBe(subject);
        expect(email.html).toContain(dir);
        expect(email.html).toContain("https://demo.example/portal/orders?view=12");
        expect(email.text).toContain("INV-2026-000012");
    });

    test("names from the database can't inject HTML", () => {
        const email = invoiceEmail(invoice, { language: "en", note: "<img src=x onerror=alert(1)>" });
        expect(email.html).not.toContain("<script>");
        expect(email.html).not.toContain("<img");
        expect(email.html).toContain("&lt;script&gt;");
    });

    test("an unpaid invoice says how to pay, a paid one says thank you", () => {
        expect(invoiceEmail(invoice, { language: "en" }).text).toContain("Payment by bank transfer");
        expect(invoiceEmail({ ...invoice, paid: 432, balance: 0 }, { language: "en" }).text).toContain("already paid in full");
    });

    test("quote email links to the portal to accept it", () => {
        const email = quoteEmail(
            { number: "QUO-2026-000004", customer: invoice.customer, valid_until: "2026-11-09", items: invoice.items, subtotal: 360, vat: 72, total: 432 },
            { language: "fr", portalUrl: "https://demo.example" }
        );
        expect(email.subject).toBe("Devis QUO-2026-000004 de B2B Platform SARL");
        expect(email.text).toContain("https://demo.example/portal/quotes");
    });

    test("reminders say when, with Arabic's number forms", () => {
        expect(whenText(0, "en")).toBe("today");
        expect(whenText(1, "fr")).toBe("demain");
        expect(whenText(2, "ar")).toBe("بعد يومين");
        expect(whenText(3, "ar")).toBe("بعد 3 أيام");
        expect(reminderEmail(invoice, { language: "en", daysLeft: 3 }).subject).toBe("Reminder: invoice INV-2026-000012 is due on 13 October 2026");
    });
});

describe("the send-by-email form", () => {
    const customer = { email: "buyer@atlas.ma", email_language: "ar" };

    test("defaults to the customer's address and language", () => {
        expect(parseEmailRequest({}, customer)).toEqual({ value: { to: "buyer@atlas.ma", language: "ar", note: "" } });
    });

    test("takes one address only, so no hidden recipients can be added", () => {
        expect(parseEmailRequest({ to: "a@x.ma, b@y.ma" }, customer).error).toBeTruthy();
        expect(parseEmailRequest({ to: "a@x.ma\nBcc: b@y.ma" }, customer).error).toBeTruthy();
        expect(parseEmailRequest({ to: "accounts@client.ma" }, customer).value.to).toBe("accounts@client.ma");
    });

    test("needs an address and a supported language", () => {
        expect(parseEmailRequest({}, { email: null }).error).toMatch(/no email address/);
        expect(parseEmailRequest({ language: "de" }, customer).error).toMatch(/English, French or Arabic/);
    });
});

describe("which invoices get a reminder", () => {
    const now = new Date(2026, 9, 10, 9, 0);
    const base = { status: "Completed", email: "a@b.ma", payment_reminders: 1, billing: { balance: 500, due_date: new Date(2026, 9, 12) } };

    test("only unpaid invoices due within the window, for customers who want them", () => {
        const invoices = [
            { ...base, id: 1 },
            { ...base, id: 2, billing: { balance: 500, due_date: new Date(2026, 9, 20) } }, // too early
            { ...base, id: 3, billing: { balance: 500, due_date: new Date(2026, 9, 8) } }, // already late
            { ...base, id: 4, billing: { balance: 0, due_date: new Date(2026, 9, 12) } }, // paid
            { ...base, id: 5, payment_reminders: 0 }, // opted out
            { ...base, id: 6, email: null }, // no address
            { ...base, id: 7, status: "Cancelled" }
        ];
        const due = invoicesToRemind(invoices, now, 3);
        expect(due.map((invoice) => invoice.id)).toEqual([1]);
        expect(due[0].days_left).toBe(2);
    });
});

describe("sending", () => {
    const email = { subject: "Hello", html: "<p>Hi</p>", text: "Hi" };
    const meta = { type: "invoice", to: "a@b.ma", language: "fr", orderId: 1 };
    const saved = { host: process.env.SMTP_HOST, demo: process.env.DEMO_MODE };
    afterEach(() => {
        if (saved.host === undefined) delete process.env.SMTP_HOST;
        else process.env.SMTP_HOST = saved.host;
        if (saved.demo === undefined) delete process.env.DEMO_MODE;
        else process.env.DEMO_MODE = saved.demo;
    });

    function fakeConnection() {
        const rows = [];
        return {
            rows,
            query: jest.fn(async (sql, params) => {
                if (sql.startsWith("INSERT")) {
                    if (params.at(-1) === "dup") throw Object.assign(new Error("dup"), { code: "ER_DUP_ENTRY" });
                    rows.push(params);
                    return [{ insertId: rows.length }];
                }
                return [{ affectedRows: 1 }];
            })
        };
    }

    test("without a mail server, emails are kept in the outbox", async () => {
        delete process.env.SMTP_HOST;
        const connection = fakeConnection();
        expect(mode()).toBe("outbox");
        await expect(sendEmail(connection, email, meta)).resolves.toMatchObject({ status: "outbox" });
        expect(connection.rows).toHaveLength(1);
    });

    test("with a mail server, emails are sent and the message id kept", async () => {
        const transport = { sendMail: jest.fn().mockResolvedValue({ messageId: "<abc@mail>" }) };
        const result = await sendEmail(fakeConnection(), email, meta, { transportImpl: transport });
        expect(result.status).toBe("sent");
        expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "a@b.ma", subject: "Hello" }));
    });

    test("a refused email is recorded as failed with the reason", async () => {
        const transport = { sendMail: jest.fn().mockRejectedValue(new Error("Mailbox unavailable")) };
        await expect(sendEmail(fakeConnection(), email, meta, { transportImpl: transport })).resolves.toMatchObject({ status: "failed", error: "Mailbox unavailable" });
    });

    test("the public demo never sends real email", () => {
        process.env.SMTP_HOST = "smtp.example.com";
        process.env.DEMO_MODE = "true";
        expect(mode()).toBe("outbox");
    });

    test("a reminder that was already sent is not sent again", async () => {
        const transport = { sendMail: jest.fn() };
        await expect(sendEmail(fakeConnection(), email, { ...meta, dedupeKey: "dup" }, { transportImpl: transport })).resolves.toBeNull();
        expect(transport.sendMail).not.toHaveBeenCalled();
    });
});

describe("who can email clients", () => {
    test("accountants and managers can; the warehouse and employees can't", () => {
        expect(can({ role: "Accountant" }, "emails.send")).toBe(true);
        expect(can({ role: "Manager" }, "emails.send")).toBe(true);
        expect(can({ role: "Warehouse" }, "emails.send")).toBe(false);
        expect(can({ role: "Employee" }, "emails.view")).toBe(false);
    });

    test("sending needs a signed-in user", async () => {
        expect((await request(app).post("/api/orders/1/email").send({})).status).toBe(401);
        expect((await request(app).post("/api/quotes/1/email").send({})).status).toBe(401);
        expect((await request(app).get("/api/emails")).status).toBe(401);
    });
});

describe("email layout details", () => {
    test("every placeholder is filled in, in every language", () => {
        for (const language of ["en", "fr", "ar"]) {
            const html = invoiceEmail(invoice, { language, portalUrl: "https://demo.example", note: "x" }).html;
            expect(html).not.toMatch(/\{[a-z]+\}/);
        }
    });

    test("Arabic emails keep invoice numbers in one piece", () => {
        const html = invoiceEmail(invoice, { language: "ar" }).html;
        expect(html).toContain('<bdi dir="ltr" style="white-space:nowrap">INV-2026-000012</bdi>');
        expect(invoiceEmail(invoice, { language: "fr" }).html).not.toContain("<bdi");
        // Escaping still works inside the isolated runs (an apostrophe stays an entity).
        const named = invoiceEmail({ ...invoice, customer: { company_name: "x", contact_name: "L'Atelier <b>" } }, { language: "ar" }).html;
        expect(named).toContain('<bdi dir="ltr" style="white-space:nowrap">L&#39;Atelier</bdi>');
        expect(named).not.toContain("<b>");
    });
});
