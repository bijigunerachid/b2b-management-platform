import { useTheme } from "../context/ThemeContext";
import Icon from "./ui/Icon";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
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
