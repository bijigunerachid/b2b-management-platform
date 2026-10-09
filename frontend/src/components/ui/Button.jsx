import Icon from "./Icon";

const variants = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-contrast)] shadow-sm hover:bg-[var(--primary-hover)] border border-transparent",
  secondary:
    "border border-[var(--border-color)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)]",
  ghost:
    "border border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
  danger:
    "border border-transparent bg-[var(--danger)] text-white shadow-sm hover:brightness-110 dark:text-[#1a0508]",
  "danger-ghost":
    "border border-transparent text-[var(--danger)] hover:bg-[var(--danger-soft)]",
};

const sizes = {
  sm: "h-8 gap-1.5 rounded-lg px-2.5 text-xs",
  md: "h-10 gap-2 rounded-[var(--control-radius)] px-4 text-sm",
  lg: "h-11 gap-2 rounded-xl px-5 text-sm",
  icon: "h-9 w-9 justify-center rounded-lg",
  "icon-sm": "h-8 w-8 justify-center rounded-lg",
};

export function Spinner({ size = 16 }) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  );
}

export default function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  loading = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...props
}) {
  const iconSize = size === "sm" || size === "icon-sm" ? 15 : 17;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold transition-all duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? <Spinner size={iconSize - 1} /> : icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
}
