const request = require("supertest");
const app = require("../server");
const { pickLanguage, translate, translateList } = require("../i18n");
const { localizeValue } = require("../middleware/localize");
const { extract } = require("../../scripts/extract-messages");
const extraKeys = require("../i18n/extraKeys");
const fr = require("../i18n/fr");
const ar = require("../i18n/ar");

describe("picking the language", () => {
    test.each([
        ["fr", "fr"],
        ["fr-MA,fr;q=0.9,en;q=0.8", "fr"],
        ["ar-MA", "ar"],
        ["de-DE,ar;q=0.5", "ar"],
        ["en-GB,fr;q=0.5", "en"],
        ["de-DE", "en"],
        ["", "en"],
        [undefined, "en"]
    ])("%j → %s", (header, language) => {
        expect(pickLanguage(header)).toBe(language);
    });
});

describe("translating messages", () => {
    test("exact messages", () => {
        expect(translate("Order not found", "fr")).toBe("Commande introuvable");
        expect(translate("Order not found", "ar")).toBe("الطلبية غير موجودة");
        expect(translate("Order not found", "en")).toBe("Order not found");
    });

    test("messages with values, and values that are themselves translatable", () => {
        expect(translate("Amount exceeds the balance due (120.00 MAD).", "fr")).toBe("Le montant dépasse le solde dû (120.00 MAD).");
        expect(translate("Cannot change order status from Pending to Completed", "fr")).toBe(
            "Impossible de passer la commande de « En attente » à « Terminée »"
        );
        expect(translate("Company name must be at most 150 characters.", "fr")).toBe("Nom de l'entreprise : 150 caractères au maximum.");
    });

    test("Arabic plural forms follow the count", () => {
        expect(translate("Created 2 draft purchase orders", "ar")).toBe("تم إنشاء مسودتي أمر شراء");
        expect(translate("Created 5 draft purchase orders", "ar")).toBe("تم إنشاء 5 مسودات أوامر شراء");
        expect(translate("Created 12 draft purchase orders", "ar")).toBe("تم إنشاء 12 مسودة أمر شراء");
    });

    test("unknown text comes back unchanged", () => {
        expect(translate("Something new", "fr")).toBe("Something new");
    });

    test("price labels are translated part by part, price list names kept", () => {
        expect(translateList("Gold −6%, 50+ units −4%", "fr")).toBe("Gold −6%, 50+ unités −4%");
        expect(translateList("Contract price", "ar")).toBe("سعر العقد");
    });

    test("every message the API can send has a French and Arabic translation", () => {
        const keys = [...new Set([...extract().keys(), ...extraKeys])];
        expect(keys.filter((key) => fr[key] === undefined)).toEqual([]);
        expect(keys.filter((key) => ar[key] === undefined)).toEqual([]);
    });
});

describe("translating responses", () => {
    test("translates messages, field errors and audit summaries, and leaves data alone", () => {
        const body = {
            success: false,
            message: "Validation failed.",
            errors: [{ field: "company_name", message: "Company name is required." }],
            data: [{ status: "Pending", summary: "Created order #12", name: "Order not found" }]
        };
        const out = localizeValue(body, "fr", 0);
        expect(out.message).toBe("Certaines informations sont invalides.");
        expect(out.errors[0]).toEqual({ field: "company_name", message: "Le nom de l'entreprise est obligatoire." });
        expect(out.data[0]).toEqual({ status: "Pending", summary: "A créé la commande n° 12", name: "Order not found" });
    });

    test("never changes the original object, which may be shared", () => {
        const shared = { message: "Order not found" };
        localizeValue(shared, "ar", 0);
        expect(shared.message).toBe("Order not found");
    });

    test("API errors come back in the language the request asked for", async () => {
        const french = await request(app).get("/api/does-not-exist").set("Accept-Language", "fr-FR,fr;q=0.9");
        expect(french.body.message).toBe("Page introuvable.");
        expect(french.headers["content-language"]).toBe("fr");

        const arabic = await request(app).get("/api/customers").set("Accept-Language", "ar");
        expect(arabic.status).toBe(401);
        expect(arabic.body.message).toBe("يلزم تسجيل الدخول. يرجى تسجيل الدخول.");

        const english = await request(app).get("/api/customers");
        expect(english.body.message).toBe("Authentication required. Please log in.");
    });
});
