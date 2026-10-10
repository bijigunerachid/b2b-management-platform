import Icon from "./ui/Icon";
import { Popover } from "./ui/primitives";
import { LANGUAGES, language, t, useLocale } from "../i18n";

export default function LanguageMenu({ className = "" }) {
  const { locale, setLocale } = useLocale();

  return (
    <Popover
      label={t("Language")}
      width={200}
      trigger={({ props }) => (
        <button
          type="button"
          {...props}
          aria-label={t("Language: {name}", { name: language(locale).label })}
          title={t("Language")}
          className={`flex h-10 items-center gap-1.5 rounded-[var(--control-radius)] px-2.5 text-sm font-semibold transition hover:bg-[var(--surface-hover)] app-text-secondary ${className}`}
        >
          <Icon name="globe" size={18} />
          <span>{language(locale).short}</span>
        </button>
      )}
    >
      {({ close }) => (
        <ul className="min-w-40 p-1" role="menu">
          {LANGUAGES.map((entry) => (
            <li key={entry.code} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={entry.code === locale}
                lang={entry.code}
                onClick={() => {
                  close();
                  setLocale(entry.code);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm transition hover:bg-[var(--surface-hover)] app-text"
              >
                <span className="flex-1">{entry.label}</span>
                {entry.code === locale && <Icon name="check" size={16} style={{ color: "var(--primary)" }} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}
