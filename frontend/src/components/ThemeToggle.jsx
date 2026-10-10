import { useTheme } from "../context/ThemeContext";
import Icon from "./ui/Icon";
import { t } from "../i18n";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? t("Switch to light mode") : t("Switch to dark mode")}
      title={isDark ? t("Switch to light mode") : t("Switch to dark mode")}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition hover:bg-[var(--surface-hover)] ${className}`}
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border-color)",
        color: "var(--text-primary)",
      }}
    >
      <Icon name={isDark ? "sun" : "moon"} size={19} />
    </button>
  );
}
