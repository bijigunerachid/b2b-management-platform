/* eslint-disable react-refresh/only-export-components */
// Shared building blocks for printable business documents (invoices,
// quotes). The sheet is paper: fixed light colors regardless of app theme.

import { useEffect } from "react";
import { Link } from "react-router-dom";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { EmptyState, ErrorState } from "../ui/primitives";
import ThemeToggle from "../ThemeToggle";
import company from "../../config/company";
import { money } from "../../lib/api";

export const paper = {
  ink: "#111827",
  muted: "#6b7280",
  rule: "#e5e7eb",
  accent: "#2563eb",
  danger: "#b91c1c",
  success: "#15803d",
  warning: "#b45309",
  info: "#0e7490",
};

export function Label({ children, className = "" }) {
  return (
    <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${className}`} style={{ color: paper.muted }}>
      {children}
    </p>
  );
}

export function PartyBlock({ title, children }) {
  return (
    <div>
      <Label className="mb-2">{title}</Label>
      <div className="space-y-0.5 text-[12.5px] leading-5" style={{ color: paper.ink }}>
        {children}
      </div>
    </div>
  );
}

export function SellerBlock() {
  return (
    <PartyBlock title="From">
      <p className="font-semibold">{company.name}</p>
      <p>{company.address}</p>
      <p>{company.city}</p>
      <p>{company.phone}</p>
      <p>{company.email}</p>
    </PartyBlock>
  );
}

export function CustomerBlock({ title, customer, fallbackName }) {
  return (
    <PartyBlock title={title}>
      <p className="font-semibold">{customer?.company_name ?? fallbackName}</p>
      {customer?.contact_name && <p>Attn: {customer.contact_name}</p>}
      {customer?.address && <p>{customer.address}</p>}
      {(customer?.city || customer?.country) && <p>{[customer.city, customer.country].filter(Boolean).join(", ")}</p>}
      {customer?.email && <p>{customer.email}</p>}
      {customer?.phone && <p>{customer.phone}</p>}
    </PartyBlock>
  );
}

/** rows: [label, value, { danger }?] */
export function DetailsBlock({ rows }) {
  return (
    <PartyBlock title="Details">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {rows.map(([label, value, options]) => (
          <div key={label} className="contents">
            <dt style={{ color: paper.muted }}>{label}</dt>
            <dd className="text-right font-medium" style={options?.danger ? { color: paper.danger } : undefined}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </PartyBlock>
  );
}

/** A4 sheet with optional diagonal watermark (e.g. VOID). */
export function Sheet({ label, watermark, children }) {
  return (
    <article
      className="invoice-sheet relative mx-auto flex w-full max-w-[210mm] flex-col overflow-hidden bg-white shadow-xl print:shadow-none"
      style={{ color: paper.ink, padding: "16mm 16mm 10mm" }}
      aria-label={label}
    >
      {watermark && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-[120px] font-black tracking-widest"
          style={{ color: "rgb(185 28 28 / 7%)", transform: "rotate(-24deg)" }}
          aria-hidden="true"
        >
          {watermark}
        </div>
      )}
      {children}
    </article>
  );
}

export function DocumentHeader({ title, number, stamp }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-7" style={{ borderColor: paper.rule }}>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl text-white" style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}>
          <Icon name="box" size={24} strokeWidth={2} />
        </div>
        <div>
          <p className="text-lg font-extrabold tracking-tight">{company.name}</p>
          <p className="text-[12px]" style={{ color: paper.muted }}>
            {company.tagline}
          </p>
        </div>
      </div>

      <div className="text-right">
        <p className="text-[28px] font-extrabold leading-none tracking-tight" style={{ color: paper.accent }}>
          {title}
        </p>
        <p className="mt-2 text-[13px] font-semibold">{number}</p>
        {stamp && (
          <span
            className="mt-3 inline-block rounded-md border-2 px-2.5 py-0.5 text-[11px] font-black tracking-[0.18em]"
            style={{ color: stamp.color, borderColor: stamp.color }}
          >
            {stamp.label}
          </span>
        )}
      </div>
    </header>
  );
}

const th = "px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em]";

/**
 * lines: { productId, description, quantity, unitPrice, amount, listPrice? }.
 * When `showDiscount` is set, a column shows the discount vs list price.
 */
export function LineTable({ lines, showDiscount = false }) {
  return (
    <table className="w-full border-collapse text-[12.5px]">
      <thead>
        <tr style={{ backgroundColor: "#f3f6fb" }}>
          <th className={`${th} rounded-l-md text-left`} style={{ color: paper.muted }}>
            Description
          </th>
          <th className={`${th} text-right`} style={{ color: paper.muted }}>
            Qty
          </th>
          {showDiscount && (
            <th className={`${th} text-right`} style={{ color: paper.muted }}>
              List price
            </th>
          )}
          <th className={`${th} text-right`} style={{ color: paper.muted }}>
            Unit price (HT)
          </th>
          <th className={`${th} rounded-r-md text-right`} style={{ color: paper.muted }}>
            Amount (HT)
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => {
          const discount = line.listPrice > 0 ? 1 - line.unitPrice / line.listPrice : 0;
          return (
            <tr key={line.productId} className="border-b" style={{ borderColor: paper.rule, breakInside: "avoid" }}>
              <td className="px-3 py-3">
                <p className="font-semibold">{line.description}</p>
                <p className="text-[11px]" style={{ color: paper.muted }}>
                  Ref. P-{String(line.productId).padStart(5, "0")}
                </p>
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{line.quantity}</td>
              {showDiscount && (
                <td className="px-3 py-3 text-right tabular-nums" style={{ color: paper.muted }}>
                  {discount > 0.0005 ? (
                    <>
                      <span className="line-through">{money(line.listPrice)}</span>
                      <span className="ml-1.5 font-semibold" style={{ color: paper.success }}>
                        −{Math.round(discount * 100)}%
                      </span>
                    </>
                  ) : (
                    money(line.listPrice)
                  )}
                </td>
              )}
              <td className="px-3 py-3 text-right tabular-nums">{money(line.unitPrice)}</td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">{money(line.amount)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Subtotal, VAT, and highlighted total; `after` renders extra rows below. */
export function TotalsBlock({ subtotal, vatRate, vat, total, before, after }) {
  return (
    <dl className="w-full max-w-[280px] text-[13px]">
      {before}
      <div className="flex justify-between py-1.5">
        <dt style={{ color: paper.muted }}>Subtotal (HT)</dt>
        <dd className="tabular-nums">{money(subtotal)}</dd>
      </div>
      <div className="flex justify-between border-b py-1.5" style={{ borderColor: paper.rule }}>
        <dt style={{ color: paper.muted }}>VAT (TVA {Math.round(vatRate * 100)}%)</dt>
        <dd className="tabular-nums">{money(vat)}</dd>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-3" style={{ backgroundColor: "#eff4ff" }}>
        <dt className="font-bold">Total (TTC)</dt>
        <dd className="text-lg font-extrabold tabular-nums" style={{ color: paper.accent }}>
          {money(total)}
        </dd>
      </div>
      {after}
    </dl>
  );
}

export function LegalFooter() {
  return (
    <>
      <div className="min-h-10 flex-1" />
      <footer className="mt-auto border-t pt-4 text-center text-[10px] leading-4" style={{ borderColor: paper.rule, color: paper.muted }}>
        {company.name} · ICE {company.ice} · RC {company.rc} · IF {company.taxId} · Patente {company.patente}
        <br />
        {company.website} · {company.email} · {company.phone}
      </footer>
    </>
  );
}

/**
 * Full-page shell: toolbar with back link and print button (hidden when
 * printing), plus loading/error states. `title` becomes the PDF file name.
 */
export function DocumentPage({ backTo, backLabel, number, title, invalid, error, onRetry, ready, children }) {
  useEffect(() => {
    if (!title) return undefined;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <div className="min-h-screen pb-12 print:min-h-0 print:bg-white print:pb-0" style={{ backgroundColor: "var(--app-bg)" }}>
      <div
        className="sticky top-0 z-10 border-b backdrop-blur-md print:hidden"
        style={{ backgroundColor: "color-mix(in srgb, var(--surface) 85%, transparent)", borderColor: "var(--border-color)" }}
      >
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-3 px-4 py-3">
          <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm font-semibold app-text-secondary hover:text-[var(--text-primary)]">
            <Icon name="chevronLeft" size={17} /> {backLabel}
          </Link>
          {number && <span className="hidden text-sm app-text-muted sm:inline">· {number}</span>}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button variant="primary" icon="download" onClick={() => window.print()} disabled={!ready}>
              Print / Save as PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-8 print:p-0">
        {invalid ? (
          <EmptyState icon="alert" title="Invalid link" description="This document link is not valid." />
        ) : error ? (
          <div className="mx-auto max-w-[210mm]">
            <ErrorState message={error} onRetry={onRetry} />
          </div>
        ) : !ready ? (
          <div className="skeleton mx-auto aspect-[210/297] w-full max-w-[210mm] rounded-none" />
        ) : (
          <div className="animate-rise print:animate-none">{children}</div>
        )}
      </div>
    </div>
  );
}
