const request = require("supertest");
const app = require("../server");
const assistant = require("../assistant/assistant");
const { buildIndex, normalize, search } = require("../assistant/search");
const { parseReply } = require("../assistant/claude");
const { describe: describeAudit } = require("../audit/describe");
const staffArticles = require("../assistant/articles.staff");
const clientArticles = require("../assistant/articles.client");
const questions = require("../assistant/evalQuestions");

const manager = { userId: 1, role: "Manager" };
const employee = { userId: 2, role: "Employee" };
const client = { userId: 3, role: "Customer", customerId: 9 };

function accuracy(articles, labelled) {
    const index = buildIndex(articles);
    let first = 0;
    let topThree = 0;
    for (const [question, expected] of labelled) {
        const ids = search(index, question, { limit: 3 }).map((result) => result.article.id);
        if (ids[0] === expected) first += 1;
        if (ids.includes(expected)) topThree += 1;
    }
    return { first: first / labelled.length, topThree: topThree / labelled.length };
}

describe("help search", () => {
    test("finds the right article for real questions, including typos, French and Arabic", () => {
        const staff = accuracy(staffArticles, questions.staff);
        const portal = accuracy(clientArticles, questions.client);
        expect(staff.first).toBeGreaterThanOrEqual(0.8);
        expect(staff.topThree).toBeGreaterThanOrEqual(0.95);
        expect(portal.first).toBeGreaterThanOrEqual(0.9);
        expect(portal.topThree).toBeGreaterThanOrEqual(0.95);
    });

    test("every article has a title and body in all three languages, and a unique id", () => {
        for (const article of [...staffArticles, ...clientArticles]) {
            for (const language of ["en", "fr", "ar"]) {
                expect(article.title[language]).toBeTruthy();
                expect(article.body[language]).toBeTruthy();
            }
        }
        const ids = [...staffArticles, ...clientArticles].map((article) => article.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test("normalizes accents and Arabic letter variants", () => {
        expect(normalize("Créer une FACTURE")).toBe("creer une facture");
        expect(normalize("إضافة فاتورة")).toBe(normalize("اضافه فاتوره"));
    });
});

describe("assistant answers (search only)", () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    beforeAll(() => delete process.env.ANTHROPIC_API_KEY);
    afterAll(() => {
        if (saved) process.env.ANTHROPIC_API_KEY = saved;
    });

    test("answers with the best article in the user's language", async () => {
        const result = await assistant.ask({ user: manager, question: "comment enregistrer un paiement", language: "fr" });
        expect(result.mode).toBe("search");
        expect(result.articles[0].id).toBe("record-payment");
        expect(result.articles[0].title).toBe("Enregistrer et annuler un paiement");
    });

    test("never shows articles the user's role can't use", async () => {
        const question = "add a new employee account and reset a password";
        const forEmployee = await assistant.ask({ user: employee, question, language: "en" });
        const forAdmin = await assistant.ask({ user: { userId: 4, role: "Admin" }, question, language: "en" });
        expect(forEmployee.articles.map((article) => article.id)).not.toContain("users");
        expect(forAdmin.articles[0].id).toBe("users");
    });

    test("clients only get client articles", async () => {
        const result = await assistant.ask({ user: client, question: "how do I create a purchase order for a supplier", language: "en" });
        const clientIds = new Set(clientArticles.map((article) => article.id));
        for (const article of result.articles) expect(clientIds.has(article.id)).toBe(true);
    });

    test("says so when nothing matches instead of guessing", async () => {
        const result = await assistant.ask({ user: manager, question: "what is the weather in Rabat", language: "en" });
        expect(result.notice).toBe("not_found");
        expect(result.articles).toEqual([]);
    });

    test("suggests articles about the current page", () => {
        const result = assistant.suggestions({ user: manager, page: "/receivables", language: "en" });
        expect(result.page.map((article) => article.id)).toEqual(expect.arrayContaining(["record-payment", "late-payment-risk"]));
        expect(result.ai).toBe(false);
    });
});

describe("assistant answers with Claude", () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    beforeEach(() => {
        process.env.ANTHROPIC_API_KEY = "test-key";
        assistant._usage.day = null;
    });
    afterAll(() => {
        if (saved) process.env.ANTHROPIC_API_KEY = saved;
        else delete process.env.ANTHROPIC_API_KEY;
    });

    test("uses Claude's answer and lists the articles it used first", async () => {
        const askClaude = jest.fn().mockResolvedValue({ answer: "Open Receivables and click the wallet icon.", sources: ["record-payment"] });
        const result = await assistant.ask({ user: manager, question: "record a payment", language: "en" }, { askClaude });
        expect(result).toMatchObject({ mode: "ai", answer: "Open Receivables and click the wallet icon.", notice: null });
        expect(result.articles[0].id).toBe("record-payment");
        expect(askClaude.mock.calls[0][0]).toMatchObject({ audience: "staff", language: "en" });
    });

    test("only sends Claude articles the user may see", async () => {
        const askClaude = jest.fn().mockResolvedValue({ answer: "ok", sources: [] });
        await assistant.ask({ user: employee, question: "reset a colleague's password and add an employee account" }, { askClaude });
        const sent = askClaude.mock.calls[0][0].articles.map((article) => article.id);
        expect(sent).not.toContain("users");
    });

    test("falls back to search when Claude fails", async () => {
        const askClaude = jest.fn().mockRejectedValue(new Error("timeout"));
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});
        const result = await assistant.ask({ user: manager, question: "record a payment", language: "en" }, { askClaude });
        spy.mockRestore();
        expect(result).toMatchObject({ mode: "search", notice: "ai_unavailable" });
        expect(result.articles[0].id).toBe("record-payment");
    });

    test("stops using Claude for a user after the hourly limit", async () => {
        const askClaude = jest.fn().mockResolvedValue({ answer: "ok", sources: [] });
        const user = { userId: 77, role: "Manager" };
        const now = Date.now();
        for (let i = 0; i < 30; i += 1) await assistant.ask({ user, question: "print the invoice" }, { askClaude, now });
        const result = await assistant.ask({ user, question: "print the invoice" }, { askClaude, now });
        expect(askClaude).toHaveBeenCalledTimes(30);
        expect(result).toMatchObject({ mode: "search", notice: "ai_limit" });
    });

    test("reads the sources line and ignores unknown ids", () => {
        const articles = [{ id: "invoices" }, { id: "returns" }];
        expect(parseReply("Open the order.\nSOURCES: invoices, made-up", articles)).toEqual({ answer: "Open the order.", sources: ["invoices"] });
        expect(parseReply("No idea.", articles)).toEqual({ answer: "No idea.", sources: [] });
    });
});

describe("assistant API", () => {
    test("needs a signed-in user", async () => {
        expect((await request(app).post("/api/assistant/ask").send({ question: "hi" })).status).toBe(401);
        expect((await request(app).get("/api/assistant/suggestions")).status).toBe(401);
    });

    test("asking a question isn't written to the audit log", () => {
        expect(describeAudit({ method: "POST", path: "/api/assistant/ask", body: { question: "x" } }, { status: 200, body: {} })).toBeNull();
    });
});

describe("assistant conversations", () => {
    test("an unrelated question isn't answered with the previous topic", async () => {
        delete process.env.ANTHROPIC_API_KEY;
        const history = [{ role: "user", content: "comment faire un avoir pour un retour" }, { role: "assistant", content: "Retours et avoirs" }];
        const result = await assistant.ask({ user: manager, question: "what is the weather in Rabat", history, language: "en" });
        expect(result.notice).toBe("not_found");
    });

    test("with Claude, a short follow-up also brings the earlier topic's articles", async () => {
        process.env.ANTHROPIC_API_KEY = "test-key";
        assistant._usage.day = null;
        const askClaude = jest.fn().mockResolvedValue({ answer: "ok", sources: [] });
        const history = [{ role: "user", content: "how do I record a payment" }, { role: "assistant", content: "Open Receivables…" }];
        await assistant.ask({ user: manager, question: "and if it bounces?", history }, { askClaude });
        expect(askClaude.mock.calls[0][0].articles.map((article) => article.id)).toContain("record-payment");
        delete process.env.ANTHROPIC_API_KEY;
    });
});
