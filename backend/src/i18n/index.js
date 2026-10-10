// Translates what the API says to people (messages, validation errors, price
// labels, audit summaries) into French or Arabic, picked from the request's
// Accept-Language header. Same idea as the frontend: the English text is the
// key, so untranslated text falls back to readable English.
//
// Controllers keep writing plain English, including messages with values in
// them ("Amount exceeds the balance due (120.00 MAD)."). The dictionaries list
// those as templates ("Amount exceeds the balance due ({amount} MAD)."), and
// a message that matches a template is translated with its values filled in.
// Values that are themselves translatable (a status, a field name) are
// translated too.

const fr = require("./fr");
const ar = require("./ar");
const { plural } = require("./plural");

const LANGUAGES = ["en", "fr", "ar"];
const DICTIONARIES = { fr, ar };

/** Best supported language from an Accept-Language header ("fr-MA,fr;q=0.9,en;q=0.8"). */
function pickLanguage(header) {
    if (typeof header !== "string" || !header.trim()) return "en";
    const ranked = header
        .split(",")
        .map((part, index) => {
            const [tag, ...params] = part.trim().split(";");
            const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
            return { code: tag.trim().toLowerCase().slice(0, 2), q: q ? Number(q.slice(2)) : 1, index };
        })
        .filter((entry) => LANGUAGES.includes(entry.code) && entry.q > 0)
        .sort((a, b) => b.q - a.q || a.index - b.index);
    return ranked[0]?.code ?? "en";
}

const PLACEHOLDER = /\{(\w+)\}/g;
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Templates (keys with placeholders) compiled to regexes, longest literal text first. */
function compile(dictionary) {
    return Object.keys(dictionary)
        .filter((key) => PLACEHOLDER.test(key) && !(PLACEHOLDER.lastIndex = 0))
        .map((key) => {
            const names = [...key.matchAll(PLACEHOLDER)].map((match) => match[1]);
            const pattern = key.split(PLACEHOLDER).map((part, index) => (index % 2 ? "(.+?)" : escape(part))).join("");
            return { key, names, regex: new RegExp(`^${pattern}$`, "s"), weight: key.replace(PLACEHOLDER, "").length };
        })
        .sort((a, b) => b.weight - a.weight);
}

const TEMPLATES = { fr: compile(fr), ar: compile(ar) };

function render(entry, values) {
    const text = typeof entry === "function" ? entry(values) : entry;
    return text.replace(PLACEHOLDER, (match, name) => (values[name] === undefined ? match : String(values[name])));
}

/** Translates one English message into `language`; unknown text comes back unchanged. */
function translate(message, language) {
    if (typeof message !== "string" || language === "en" || !DICTIONARIES[language]) return message;
    const dictionary = DICTIONARIES[language];
    if (dictionary[message] !== undefined) return render(dictionary[message], {});

    for (const { key, names, regex } of TEMPLATES[language]) {
        const match = message.match(regex);
        if (!match) continue;
        const values = {};
        names.forEach((name, index) => {
            const value = match[index + 1];
            const own = dictionary[value];
            values[name] = typeof own === "string" ? own : value;
        });
        return render(dictionary[key], values);
    }
    return message;
}

/** Price labels are lists ("Gold −6%, 50+ units −4%"): translate each part. */
function translateList(text, language) {
    if (typeof text !== "string" || language === "en") return text;
    const separator = language === "ar" ? "، " : ", ";
    return text.split(", ").map((part) => translate(part, language)).join(separator);
}

module.exports = { LANGUAGES, pickLanguage, plural, translate, translateList };
