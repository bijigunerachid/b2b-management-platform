// Lists every text the API can send to people, as translation keys.
//
// It reads all string literals in src/ that look like a sentence or a label
// (start with a capital letter or a number, contain a space), skipping SQL,
// log lines and files whose text is translated elsewhere. Template parts like
// ${count} become {count}. `npm run i18n:check` uses it to make sure every
// message has a French and Arabic translation.
//
//   node scripts/extract-messages.js          # key <tab> file
//   node scripts/extract-messages.js --json

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "src");

// Not shown to people, or translated somewhere else: permission labels by the
// frontend, audit summaries via src/i18n/extraKeys.js, help articles are
// already written in three languages.
const SKIP_FILES = [
    /__tests__/, /[\\/]scripts[\\/]/, /[\\/]seed[\\/]/, /[\\/]i18n[\\/]/, /[\\/]assistant[\\/]/,
    /audit[\\/]describe\.js$/, /config[\\/]permissions\.js$/, /config[\\/]validateEnv\.js$/, /config[\\/]database\.js$/
];
const SQL = /^\s*(SELECT|INSERT|UPDATE|DELETE|WITH|SET|CREATE|ALTER|DROP|USE|SHOW)\b|\b(FROM|WHERE|JOIN|VALUES|GROUP BY|ORDER BY|AS)\b|DATE_FORMAT\(/;
const NOT_FOR_PEOPLE = new Set([
    "B2B Management API is running",
    // Data values (payment statuses and methods, return and stock reasons): the
    // frontend translates them, and its logic compares the English values.
    "Partially paid", "Bank transfer",
    "Damaged in transit", "Wrong item", "No longer needed",
    "Stock count correction", "Lost or stolen", "Returned by customer"
]);

function files(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (SKIP_FILES.some((pattern) => pattern.test(full))) return [];
        if (entry.isDirectory()) return files(full);
        return entry.name.endsWith(".js") ? [full] : [];
    });
}

/** `${rule.maxLength}` → {maxLength}: the last identifier in the expression. */
function placeholder(expression) {
    const names = expression.match(/[A-Za-z_]\w*/g) ?? ["value"];
    return `{${names[names.length - 1]}}`;
}

function toKey(literal) {
    return literal
        .replace(/\$\{([^}]*)\}/g, (match, expression) => placeholder(expression))
        .replace(/\\(["'`\\])/g, "$1");
}

const LITERAL = /"((?:\\.|[^"\\\n])*)"|'((?:\\.|[^'\\\n])*)'|`((?:\\.|\$\{[^}]*\}|[^`\\$]|\$(?!\{))*)`/g;

function lineOf(source, index) {
    const start = source.lastIndexOf("\n", index) + 1;
    const end = source.indexOf("\n", index);
    return source.slice(start, end === -1 ? undefined : end);
}

function extract() {
    const keys = new Map();
    for (const file of files(ROOT)) {
        // Comment lines often quote example text; they aren't messages.
        const source = fs
            .readFileSync(file, "utf8")
            .split("\n")
            .map((line) => (/^\s*(\/\/|\/\*|\*)/.test(line) ? "" : line))
            .join("\n");
        for (const match of source.matchAll(LITERAL)) {
            const text = match[1] ?? match[2] ?? match[3];
            if (!text || text.length < 4 || !text.includes(" ")) continue;
            if (!/^([A-Z]|\d|\$\{)/.test(text)) continue;
            if (SQL.test(text) || NOT_FOR_PEOPLE.has(text) || text.includes("\n")) continue;
            const line = lineOf(source, match.index);
            if (/console\.|require\(|throw new Error\(/.test(line)) continue; // logs, imports, programmer errors
            // Saved with the record (stock movement reasons) and shown as recorded, like the audit history.
            if (/^\s*(reason|notes):/.test(line)) continue;
            if (/:\s*$/.test(text)) continue; // log prefixes like "Login error:"
            const key = toKey(text);
            // Needs two real words outside the placeholders: skips formats like
            // "PO-{year}-{number}", "{first_name} {last_name}" and "03:00 UTC".
            if ((key.replace(/\{\w+\}/g, " ").match(/[A-Za-z]{2,}/g) ?? []).length < 2) continue;
            if (!keys.has(key)) keys.set(key, path.relative(ROOT, file));
        }
    }
    return keys;
}

module.exports = { extract, toKey };

if (require.main === module) {
    const keys = extract();
    if (process.argv.includes("--json")) console.log(JSON.stringify([...keys.keys()], null, 2));
    else for (const [key, file] of keys) console.log(`${key}\t${file}`);
    console.error(`${keys.size} messages`);
}
