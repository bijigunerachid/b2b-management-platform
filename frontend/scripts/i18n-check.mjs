// Checks the translations.
//
//   node scripts/i18n-check.mjs            fails if a t("...") text has no French or Arabic version
//   node scripts/i18n-check.mjs --strict   also lists visible text that isn't wrapped in t()
//
// Texts are found by reading the source, so they must be plain string
// literals: t("Order #{id}", { id }), never t(`Order #${id}`).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("../src", import.meta.url));
const strict = process.argv.includes("--strict");

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "i18n" ? [] : files(path);
    return /\.(jsx?|mjs)$/.test(name) ? [path] : [];
  });
}

function unquote(literal) {
  return JSON.parse(literal[0] === "'" ? `"${literal.slice(1, -1).replace(/"/g, '\\"').replace(/\\'/g, "'")}"` : literal);
}

const used = new Map();
const unwrapped = [];
const STRING = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/;
const CALL = new RegExp(`\\bt\\(\\s*(${STRING.source})`, "g");

for (const file of files(src)) {
  const code = readFileSync(file, "utf8");
  for (const match of code.matchAll(CALL)) {
    const text = unquote(match[1]);
    if (!used.has(text)) used.set(text, relative(src, file));
  }
  if (strict) {
    const lines = code.split("\n");
    lines.forEach((line, index) => {
      // Text between JSX tags, and a few attributes that are always visible.
      const jsxText = line.match(/>\s*([^<>{}=;]*[A-Za-z]{2,}[^<>{}=;]*?)\s*(?:<|$)/);
      const attribute = line.match(/\b(title|placeholder|label|description|aria-label|hint|alt)="([^"]*[A-Za-z]{2,}[^"]*)"/);
      const candidate = (jsxText && !/^\s*(\/\/|\*|import|export|const|return|if|function)/.test(line) && jsxText[1].trim()) || (attribute && attribute[2]);
      // Code fragments (arrow functions, calls, comparisons) aren't text.
      if (candidate && /\s/.test(candidate) && !/[()=;&?[\]|]|=>/.test(candidate)) {
        unwrapped.push(`${relative(src, file)}:${index + 1}  ${candidate.trim().slice(0, 80)}`);
      }
    });
  }
}

// Values translated with t(variable) are listed in i18n/dynamic.js.
for (const text of (await import(new URL("../src/i18n/dynamic.js", import.meta.url))).default) {
  if (!used.has(text)) used.set(text, "i18n/dynamic.js");
}

const dictionaries = {
  fr: (await import(new URL("../src/i18n/fr.js", import.meta.url))).default,
  ar: (await import(new URL("../src/i18n/ar.js", import.meta.url))).default,
};

let missingCount = 0;
for (const [code, dictionary] of Object.entries(dictionaries)) {
  const missing = [...used.keys()].filter((text) => !(text in dictionary));
  const unused = Object.keys(dictionary).filter((text) => !used.has(text));
  missingCount += missing.length;
  console.log(`${code}: ${used.size - missing.length}/${used.size} translated${unused.length ? `, ${unused.length} unused` : ""}`);
  for (const text of missing) console.log(`  missing  ${JSON.stringify(text)}  (${used.get(text)})`);
  if (strict) for (const text of unused) console.log(`  unused   ${JSON.stringify(text)}`);
}

if (strict && unwrapped.length) {
  console.log(`\n${unwrapped.length} possibly untranslated texts:`);
  for (const line of unwrapped) console.log(`  ${line}`);
}

process.exitCode = missingCount > 0 ? 1 : 0;
