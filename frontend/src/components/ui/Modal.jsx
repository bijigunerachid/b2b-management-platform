import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let scrollLocks = 0;

function lockScroll() {
  scrollLocks += 1;
  if (scrollLocks === 1) {
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollbar}px`;
  }
}

function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) {
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  }
}

/**
 * Keeps an overlay mounted until its exit animation finishes.
 * Uses the "adjust state during render" pattern rather than an effect.
 */
function usePresence(open) {
  const [rendered, setRendered] = useState(open);

  if (open && !rendered) {
    setRendered(true);
  }

  return {
    rendered: rendered || open,
    onExited: () => {
      if (!open) setRendered(false);
    },
  };
}

function Overlay({ open, onClose, dismissible = true, variant, labelledBy, describedBy, panelClassName, children }) {
  const { rendered, onExited } = usePresence(open);
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);

  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    lockScroll();

    // Focus the first field (or the panel) once mounted.
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target =
        panel.querySelector("[data-autofocus]") ||
        panel.querySelector("input:not([type=hidden]), select, textarea") ||
        panel.querySelector(FOCUSABLE) ||
        panel;
      target.focus({ preventScroll: true });
    });

    function handleKeyDown(event) {
      const panel = panelRef.current;
      if (!panel) return;

      // Only the topmost overlay reacts to keys.
      const overlays = document.querySelectorAll("[data-overlay-panel]");
      if (overlays[overlays.length - 1] !== panel) return;

      if (event.key === "Escape" && dismissibleRef.current) {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }

      if (event.key === "Tab") {
        const items = [...panel.querySelectorAll(FOCUSABLE)];
        if (items.length === 0) {
          event.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      unlockScroll();
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open]);

  if (!rendered) return null;

  const isDrawer = variant === "drawer";

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div
        className={`absolute inset-0 backdrop-blur-[2px] ${open ? "animate-fade-in" : "animate-fade-out"}`}
        style={{ backgroundColor: "var(--overlay)" }}
        onMouseDown={() => dismissible && onClose?.()}
        aria-hidden="true"
      />

      <div
        className={
          isDrawer
            ? "pointer-events-none absolute inset-y-0 right-0 flex w-full justify-end"
            : "pointer-events-none absolute inset-0 flex items-end justify-center p-0 sm:items-center sm:p-6"
        }
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          tabIndex={-1}
          data-overlay-panel=""
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) onExited();
          }}
          className={`pointer-events-auto flex flex-col outline-none ${
            isDrawer
              ? `h-full w-full max-w-xl border-l ${open ? "animate-drawer-in" : "animate-drawer-out"}`
              : `max-h-[92dvh] w-full rounded-t-2xl border sm:rounded-2xl ${open ? "animate-pop-in" : "animate-pop-out"}`
          } ${panelClassName}`}
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border-color)",
            boxShadow: "var(--pop-shadow)",
          }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

function OverlayHeader({ id, icon, iconTone = "primary", eyebrow, title, description, descriptionId, onClose, closeDisabled }) {
  return (
    <header
      className="flex items-start gap-4 border-b px-5 py-4 sm:px-6 sm:py-5"
      style={{ borderColor: "var(--border-color)" }}
    >
      {icon && (
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: `var(--${iconTone}-soft)`,
            color: `var(--${iconTone})`,
          }}
        >
          <Icon name={icon} size={20} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--primary)" }}>
            {eyebrow}
          </p>
        )}
        <h2 id={id} className="text-lg font-bold tracking-tight app-text">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-0.5 text-sm app-text-secondary">
            {description}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        disabled={closeDisabled}
        aria-label="Close"
        className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition hover:bg-[var(--surface-hover)] disabled:opacity-40 app-text-secondary"
      >
        <Icon name="close" size={18} />
      </button>
    </header>
  );
}

const sizes = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
};

/**
 * Centered dialog (bottom sheet on phones).
 * Pass `footer` for a pinned action bar; `busy` blocks dismissal while saving.
 */
export function Modal({ open, onClose, title, description, eyebrow, icon, iconTone, size = "md", footer, busy = false, children }) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Overlay
      open={open}
      onClose={onClose}
      dismissible={!busy}
      labelledBy={titleId}
      describedBy={description ? descriptionId : undefined}
      panelClassName={sizes[size]}
    >
      <OverlayHeader
        id={titleId}
        descriptionId={descriptionId}
        icon={icon}
        iconTone={iconTone}
        eyebrow={eyebrow}
        title={title}
        description={description}
        onClose={onClose}
        closeDisabled={busy}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      {footer && (
        <footer
          className="flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end sm:px-6"
          style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface-muted)" }}
        >
          {footer}
        </footer>
      )}
    </Overlay>
  );
}

/** Slide-in side panel for record details. */
export function Drawer({ open, onClose, title, description, eyebrow, icon, iconTone, footer, children }) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Overlay
      open={open}
      onClose={onClose}
      variant="drawer"
      labelledBy={titleId}
      describedBy={description ? descriptionId : undefined}
    >
      <OverlayHeader
        id={titleId}
        descriptionId={descriptionId}
        icon={icon}
        iconTone={iconTone}
        eyebrow={eyebrow}
        title={title}
        description={description}
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      {footer && (
        <footer
          className="flex flex-wrap justify-end gap-2 border-t px-5 py-4 sm:px-6"
          style={{ borderColor: "var(--border-color)", backgroundColor: "var(--surface-muted)" }}
        >
          {footer}
        </footer>
      )}
    </Overlay>
  );
}

export { Overlay };
