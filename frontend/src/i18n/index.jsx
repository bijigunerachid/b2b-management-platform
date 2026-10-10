/* eslint-disable react-refresh/only-export-components */
// Translations. The English text is the key: t("Create order") returns the
// French or Arabic version, or the English text when no translation exists.
// Placeholders use braces: t("Order #{id}", { id: 12 }). A dictionary entry can
// also be a function of those values, for plurals.
//
// Run `npm run i18n:check` to list texts that are missing a translation.

import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState } from "react";
import fr from "./fr";
import ar from "./ar";

export const LANGUAGES = [
  { code: "en", label: "English", short: "EN", dir: "ltr", intl: "en-GB", numbers: "en", money: "fr-MA" },
  { code: "fr", label: "Français", short: "FR", dir: "ltr", intl: "fr-MA", numbers: "fr-MA", money: "fr-MA" },
  { code: "ar", label: "العربية", short: "ع", dir: "rtl", intl: "ar-MA", numbers: "ar-MA", money: "ar-MA" },
];

const DICTIONARIES = { en: {}, fr, ar };
const STORAGE_KEY = "b2b-locale";

function initialLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (DICTIONARIES[saved]) return saved;
  } catch {
    // Storage can be blocked; fall back to the browser language.
  }
  const browser = (navigator.language || "en").slice(0, 2);
  return DICTIONARIES[browser] ? browser : "en";
}

let current = initialLocale();

export function getLocale() {
  return current;
}

export function language(code = current) {
  return LANGUAGES.find((entry) => entry.code === code) ?? LANGUAGES[0];
}

export function t(text, values) {
  const entry = DICTIONARIES[current]?.[text];
  const template = typeof entry === "function" ? entry(values ?? {}) : entry ?? text;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (values[name] === undefined || values[name] === null ? match : String(values[name])));
}

function applyToDocument(code) {
  const { dir } = language(code);
  document.documentElement.lang = code;
  document.documentElement.dir = dir;
}

applyToDocument(current);

const LocaleContext = createContext({ locale: current, setLocale: () => {} });

/** Holds the language. Changing it re-renders the whole app in the new language. */
export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(current);

  const setLocale = useCallback((code) => {
    if (!DICTIONARIES[code]) return;
    current = code;
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // The choice still applies for this visit.
    }
    setLocaleState(code);
  }, []);

  useEffect(() => applyToDocument(locale), [locale]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  // The key remounts the app so every text, memoized or not, is rendered again.
  return (
    <LocaleContext.Provider value={value}>
      <Fragment key={locale}>{children}</Fragment>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
