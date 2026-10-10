// Fails when a text the API sends to people has no French or Arabic
// translation, or when a translation uses the wrong {placeholders}.
// Run with `npm run i18n:check` (CI runs it on every push).

const { extract } = require("./extract-messages");
const extraKeys = require("../src/i18n/extraKeys");
const DICTIONARIES = { fr: require("../src/i18n/fr"), ar: require("../src/i18n/ar") };

const keys = [...new Set([...extract().keys(), ...extraKeys])];
const placeholders = (text) => new Set([...String(text).matchAll(/\{(\w+)\}/g)].map((match) => match[1]));
const problems = [];

for (const [code, dictionary] of Object.entries(DICTIONARIES)) {
    const missing = keys.filter((key) => dictionary[key] === undefined);
    for (const key of missing) problems.push(`${code}: missing  ${JSON.stringify(key)}`);

    for (const [key, value] of Object.entries(dictionary)) {
        const wanted = placeholders(key);
        // Plural forms are functions: check them with a sample count.
        const sample = typeof value === "function" ? value(Object.fromEntries([...wanted].map((name) => [name, 5]))) : value;
        const unknown = [...placeholders(sample)].filter((name) => !wanted.has(name));
        if (unknown.length) problems.push(`${code}: ${JSON.stringify(key)} uses unknown {${unknown.join("}, {")}}`);
    }
    console.log(`${code}: ${keys.length - missing.length}/${keys.length} translated`);
}

if (problems.length) {
    console.error(problems.join("\n"));
    process.exitCode = 1;
}
