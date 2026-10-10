const { pickLanguage, translate, translateList } = require("../i18n");

// Fields whose text is written for people and translated on the way out.
// `label`/`price_label` are price labels (lists like "Gold −6%, 50+ units −4%"),
// `summary` is an audit log line. Everything else (names, statuses used by
// the frontend's logic, amounts) is left alone.
const TEXT_FIELDS = new Set(["message", "summary"]);
const LIST_FIELDS = new Set(["label", "price_label"]);
const MAX_DEPTH = 6;

function localizeValue(value, language, depth) {
    if (depth > MAX_DEPTH || value === null || typeof value !== "object") return value;
    if (value instanceof Date || Buffer.isBuffer(value)) return value;
    if (Array.isArray(value)) return value.map((item) => localizeValue(item, language, depth + 1));

    // Copies instead of changing the object: it may be shared (a cached list, a constant).
    const copy = {};
    for (const [key, field] of Object.entries(value)) {
        if (typeof field === "string" && TEXT_FIELDS.has(key)) copy[key] = translate(field, language);
        else if (typeof field === "string" && LIST_FIELDS.has(key)) copy[key] = translateList(field, language);
        else copy[key] = localizeValue(field, language, depth + 1);
    }
    return copy;
}

/**
 * Picks the language from Accept-Language (the frontend sends the app's
 * language) and translates what the API says to people in every JSON response.
 */
function localize(req, res, next) {
    const language = pickLanguage(req.get("accept-language"));
    req.language = language;
    res.set("Content-Language", language);
    res.vary("Accept-Language");
    if (language === "en") return next();

    const json = res.json.bind(res);
    res.json = (body) => json(localizeValue(body, language, 0));
    return next();
}

module.exports = { localize, localizeValue };
