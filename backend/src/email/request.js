// Checks the "send by email" form: recipient, language and an optional note.

const LANGUAGES = ["en", "fr", "ar"];
const MAX_NOTE = 1000;
// One address, no lists or line breaks (which could add hidden recipients).
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

/**
 * Returns { value: { to, language, note } } or { error }. Without `to` the
 * customer's address is used, without `language` the customer's email language.
 */
function parseEmailRequest(body, customer) {
    const to = typeof body?.to === "string" && body.to.trim() ? body.to.trim() : customer?.email ?? "";
    if (!to) return { error: "This customer has no email address. Add one on the customer, or type an address." };
    if (to.length > 255 || !EMAIL.test(to)) return { error: "Enter one valid email address." };

    const language = body?.language ?? customer?.email_language ?? "fr";
    if (!LANGUAGES.includes(language)) return { error: "Choose English, French or Arabic." };

    const note = typeof body?.message === "string" ? body.message.trim() : "";
    if (note.length > MAX_NOTE) return { error: "The message can be at most 1,000 characters." };

    return { value: { to, language, note } };
}

module.exports = { parseEmailRequest };
