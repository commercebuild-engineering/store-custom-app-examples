/**
 * Small, natively-styled building blocks for the admin pages. The admin host
 * provides no UI kit, icon set or toast, so these are hand-rolled on the
 * recipes in ../lib/tokens.ts.
 */
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";

import { STATUS_PILLS, STATUS_REQUESTED } from "../../shared/constants";
import { initials } from "../../shared/format";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  CARD,
  CARD_TITLE,
  INPUT,
  LABEL,
  cx,
} from "../lib/tokens";

/* ---- icons (inline SVG; lucide-react is not available on the admin host) */

function Svg({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx("size-4 shrink-0", className)}
    >
      {children}
    </svg>
  );
}
export const IconSearch = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Svg>
);
export const IconArrowLeft = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </Svg>
);
export const IconX = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </Svg>
);
export const IconInbox = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5.1L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.5-6.9A2 2 0 0016.7 4H7.3a2 2 0 00-1.8 1.1z" />
  </Svg>
);

/* ---- layout ------------------------------------------------------- */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 items-start justify-between gap-4 [display:flex] [flex-wrap:wrap]">
      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#18181b]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[13.5px] text-[#6b6b73]">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="items-center gap-2 [display:flex] [flex-wrap:wrap]">
          {actions}
        </div>
      )}
    </div>
  );
}

export function Card({
  title,
  children,
  className,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cx(CARD, className)}>
      {title && <h2 className={CARD_TITLE}>{title}</h2>}
      {children}
    </section>
  );
}

/* ---- feedback ----------------------------------------------------- */

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success" | "warning";
  children: React.ReactNode;
}) {
  const tones = {
    info: "border-[#ebebe7] bg-[#f6f6f4] text-[#3f3f46]",
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "rounded-[7px] border px-3.5 py-2.5 text-[13px]",
        tones[tone],
      )}
    >
      {children}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-5 py-16 text-center text-[#6b6b73]">
      <IconInbox className="mx-auto mb-3 size-8 text-[#98989f]" />
      <div className="text-[14px] font-medium text-[#3f3f46]">{title}</div>
      {hint && <div className="mt-1 text-[13px]">{hint}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx("animate-pulse rounded-[4px] bg-[#f0f0ee]", className)}
    />
  );
}

export function TableSkeleton({
  rows = 6,
  cols = 7,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="p-4">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="items-center gap-4 py-3 [display:flex]">
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton key={col} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DataNotConfigured() {
  return (
    <Notice tone="warning">
      The returns service is not configured for this app — its{" "}
      <code>returns</code> backend connection in <code>config.json</code> has no
      usable base URL.
    </Notice>
  );
}

/* ---- data display -------------------------------------------------- */

export function StatusPill({ status }: { status: string }) {
  const [background, color] = STATUS_PILLS[status] ??
    STATUS_PILLS[STATUS_REQUESTED] ?? ["#F4F4F5", "#52525B"];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-medium"
      style={{ background, color, borderColor: `${color}33` }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: color }}
        aria-hidden="true"
      />
      {status}
    </span>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#ece7ff] text-[11px] font-semibold text-[#4a2de0]"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function CustomerCell({ name, email }: { name: string; email: string }) {
  return (
    <div className="items-center gap-2.5 [display:flex]">
      <Avatar name={name || email || "?"} />
      <div className="min-w-0">
        <div className="truncate font-medium text-[#18181b]">{name || "—"}</div>
        {email && (
          <div className="truncate text-[12px] text-[#6b6b73]">{email}</div>
        )}
      </div>
    </div>
  );
}

/* ---- controls ------------------------------------------------------ */

export interface TabDef {
  id: string;
  label: string;
  count: number;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      className="mb-3.5 items-center gap-1 overflow-x-auto border-b border-[#ebebe7] [display:flex]"
    >
      {tabs.map((tab) => {
        const on = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab.id)}
            className={cx(
              "-mb-px inline-flex cursor-pointer items-center gap-2 whitespace-nowrap border-0 border-b-2 bg-transparent px-3 pt-2 pb-3 text-[13.5px] font-medium transition-colors",
              on
                ? "border-[#18181b] text-[#18181b]"
                : "border-transparent text-[#6b6b73] hover:text-[#18181b]",
            )}
          >
            {tab.label}
            <span
              className={cx(
                "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                on ? "bg-[#18181b] text-white" : "bg-[#f0f0ee] text-[#6b6b73]",
              )}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative [display:block] w-full max-w-sm">
      <IconSearch className="absolute top-1/2 left-3 -translate-y-1/2 text-[#98989f]" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cx(INPUT, "pl-9")}
        aria-label={placeholder}
      />
    </label>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className={LABEL}>{label}</span>
      {children}
      {hint && <p className="mt-1 text-[12px] text-[#6b6b73]">{hint}</p>}
    </div>
  );
}

/* ---- cursor pagination --------------------------------------------- */

export const PAGE_SIZE_OPTIONS = [20, 50, 100];

/**
 * Footer for cursor-paged lists: the service pages forward from a cursor, so
 * there is Previous / Next but no jump-to-page or Last.
 */
export function CursorPagination({
  page,
  shown,
  total,
  pageSize,
  hasNext,
  busy,
  onPrev,
  onNext,
  onPageSize,
}: {
  /** 1-based page number. */
  page: number;
  /** Rows on this page. */
  shown: number;
  /** Total rows in the current tab, when known. */
  total?: number;
  pageSize: number;
  hasNext: boolean;
  busy?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPageSize: (size: number) => void;
}) {
  const first = shown === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = (page - 1) * pageSize + shown;
  return (
    <div className="items-center justify-between gap-3 border-t border-[#ebebe7] px-3.5 py-2.5 text-[12.5px] text-[#6b6b73] [display:flex] [flex-wrap:wrap]">
      <span className="tabular-nums">
        {shown === 0
          ? "No rows"
          : `${first}–${last}${typeof total === "number" ? ` of ${total}` : ""}`}
        {" · "}Page {page}
      </span>
      <div className="items-center gap-2 [display:flex]">
        <label className="items-center gap-1.5 [display:flex]">
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
            disabled={busy}
            className="rounded-[7px] border border-[#dcdcd6] bg-white px-2 py-1 text-[12.5px] text-[#18181b]"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onPrev}
          disabled={busy || page <= 1}
          className={BUTTON_SECONDARY}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={busy || !hasNext}
          className={BUTTON_SECONDARY}
        >
          Next
        </button>
      </div>
    </div>
  );
}

/* ---- confirm ------------------------------------------------------- */

/**
 * Destructive confirmation. When `confirmText` is given the admin has to
 * type it (e.g. the request id) before the button enables.
 */
export function ConfirmModal({
  title,
  description,
  confirmLabel,
  confirmText,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  confirmText?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const canConfirm =
    !busy && (!confirmText || typed.trim() === confirmText.trim());

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[1000] items-center justify-center bg-black/40 p-4 [display:flex]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cb-returns-confirm-title"
        className="w-full max-w-md rounded-[14px] border border-[#ebebe7] bg-white p-5 shadow-xl"
      >
        <h2
          id="cb-returns-confirm-title"
          className="text-[16px] font-semibold text-[#18181b]"
        >
          {title}
        </h2>
        <div className="mt-2 text-[13px] text-[#3f3f46]">{description}</div>
        {confirmText && (
          <label className="mt-4 [display:block]">
            <span className={LABEL}>
              Type{" "}
              <span className="font-mono font-semibold">{confirmText}</span> to
              confirm
            </span>
            <input
              autoFocus
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className={cx(INPUT, "font-mono")}
              disabled={busy}
            />
          </label>
        )}
        <div className="mt-4 justify-end gap-2 [display:flex]">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={BUTTON_SECONDARY}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className={cx(
              BUTTON_PRIMARY,
              "bg-red-600 enabled:hover:bg-red-700",
            )}
          >
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---- modal --------------------------------------------------------- */

/**
 * A message prompt for the actions that need a customer-visible note.
 * Portalled to <body> so the admin layout's overflow never clips it.
 */
export function MessageModal({
  title,
  description,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: (message: string) => void;
  onCancel: () => void;
}) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const canConfirm = message.trim().length > 0 && !busy;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[1000] items-center justify-center bg-black/40 p-4 [display:flex]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cb-returns-modal-title"
        className="w-full max-w-md rounded-[14px] border border-[#ebebe7] bg-white p-5 shadow-xl"
      >
        <div className="items-start justify-between gap-3 [display:flex]">
          <h2
            id="cb-returns-modal-title"
            className="text-[16px] font-semibold text-[#18181b]"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-[4px] p-1 text-[#6b6b73] hover:bg-[#f6f6f4]"
            aria-label="Close"
          >
            <IconX />
          </button>
        </div>
        <p className="mt-1 text-[13px] text-[#6b6b73]">{description}</p>
        <textarea
          autoFocus
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
          placeholder="This message is shown to the customer…"
          className={cx(INPUT, "mt-4")}
        />
        <div className="mt-4 justify-end gap-2 [display:flex]">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={BUTTON_SECONDARY}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(message.trim())}
            disabled={!canConfirm}
            className={cx(
              BUTTON_PRIMARY,
              danger && "bg-red-600 enabled:hover:bg-red-700",
            )}
          >
            {busy ? "Saving…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
