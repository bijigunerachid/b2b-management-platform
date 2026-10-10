/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
import { Modal } from "./Modal";
import Button from "./Button";

import { t } from "../../i18n";
const ToastContext = createContext(null);

const toastTones = {
  success: { icon: "checkCircle", color: "var(--success)", soft: "var(--success-soft)" },
  error: { icon: "alertCircle", color: "var(--danger)", soft: "var(--danger-soft)" },
  warning: { icon: "alert", color: "var(--warning)", soft: "var(--warning-soft)" },
  info: { icon: "info", color: "var(--primary)", soft: "var(--primary-soft)" },
};

function Toast({ toast, onDismiss }) {
  const tone = toastTones[toast.type] ?? toastTones.info;
  const [paused, setPaused] = useState(false);

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto relative w-full overflow-hidden rounded-xl border animate-toast-in"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border-color)",
        boxShadow: "var(--pop-shadow)",
      }}
    >
      <div className="flex items-start gap-3 p-3.5 pe-10">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: tone.soft, color: tone.color }}
        >
          <Icon name={tone.icon} size={18} />
        </div>
        <div className="min-w-0 pt-0.5">
          {toast.title && <p className="text-sm font-semibold app-text">{toast.title}</p>}
          <p className={`text-sm ${toast.title ? "mt-0.5 app-text-secondary" : "app-text"}`}>
            {toast.message}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={t("Dismiss notification")}
        className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-[var(--surface-hover)] app-text-secondary"
      >
        <Icon name="close" size={15} />
      </button>

      <div
        className="toast-progress absolute bottom-0 start-0 h-0.5 w-full"
        style={{
          backgroundColor: tone.color,
          animationDuration: `${toast.duration}ms`,
          animationPlayState: paused ? "paused" : "running",
        }}
        onAnimationEnd={() => onDismiss(toast.id)}
      />
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((type, message, options = {}) => {
    nextId.current += 1;
    const toast = {
      id: nextId.current,
      type,
      message,
      title: options.title,
      duration: options.duration ?? (type === "error" ? 6500 : 4000),
    };
    // Keep at most four visible.
    setToasts((current) => [...current.slice(-3), toast]);
  }, []);

  const api = useMemo(
    () => ({
      success: (message, options) => show("success", message, options),
      error: (message, options) => show("error", message, options),
      warning: (message, options) => show("warning", message, options),
      info: (message, options) => show("info", message, options),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed bottom-4 end-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
        >
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const [open, setOpen] = useState(false);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setRequest({ ...options, resolve });
        setOpen(true);
      }),
    []
  );

  function settle(value) {
    request?.resolve(value);
    setOpen(false);
  }

  const tone = request?.tone ?? "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={open}
        onClose={() => settle(false)}
        size="sm"
        icon={request?.icon ?? (tone === "danger" ? "alert" : "info")}
        iconTone={tone}
        title={request?.title ?? t("Are you sure?")}
        footer={
          <>
            <Button variant="secondary" onClick={() => settle(false)}>
              {request?.cancelLabel ?? t("Cancel")}
            </Button>
            <Button
              variant={tone === "danger" ? "danger" : "primary"}
              onClick={() => settle(true)}
              data-autofocus
            >
              {request?.confirmLabel ?? t("Confirm")}
            </Button>
          </>
        }
      >
        <div className="text-sm leading-6 app-text-secondary">{request?.message}</div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

// confirm({ title, message, confirmLabel, tone }) resolves to true or false.
export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm must be used inside ConfirmProvider");
  return context;
}
