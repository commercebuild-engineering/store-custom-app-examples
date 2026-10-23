import { RETURN_WINDOW_DAYS } from "./constants";

/** What the storefront shows when a date is absent, as formatErpDate does. */
export const NO_DATE = "\u2014";

/**
 * Platform dates arrive as `2026-07-23T00:00:00` (LocalDateTime) or
 * `2026-07-23` (LocalDate). Read the parts off the string first — the same
 * approach the core order table uses — and only fall back to Date parsing,
 * which is locale- and engine-dependent for anything non-ISO.
 */
function dateParts(
  value?: string | null,
): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const text = String(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return { year: +iso[1], month: +iso[2], day: +iso[3] };
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

/** dd/MM/yyyy, matching the storefront order list. */
export function formatDate(value?: string | null): string {
  const parts = dateParts(value);
  if (!parts) return NO_DATE;
  const dd = String(parts.day).padStart(2, "0");
  const mm = String(parts.month).padStart(2, "0");
  return `${dd}/${mm}/${parts.year}`;
}

/** "12 Aug 2026, 14:05" — used on the return timeline. */
export function formatDateTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Host-independent money formatting (the admin host has no `displayMoney`
 * helper). Falls back to a plain 2-decimal number when the currency code is
 * missing or not a valid ISO code.
 */
export function formatMoneyIntl(amount: number, currencyCode?: string): string {
  const value = Number.isFinite(amount) ? amount : 0;
  if (currencyCode && /^[A-Za-z]{3}$/.test(currencyCode)) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode.toUpperCase(),
      }).format(value);
    } catch {
      // Unknown code — fall through to the plain number.
    }
  }
  return value.toFixed(2);
}

/** "Car Factory" → "CF"; used for the customer avatar. */
export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join("") || "?"
  );
}

/** Whole days elapsed since the order date; Infinity when unparseable. */
export function daysSince(value?: string | null): number {
  const parts = dateParts(value);
  if (!parts) return Number.POSITIVE_INFINITY;
  const date = new Date(parts.year, parts.month - 1, parts.day);
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

/**
 * AC4: orders outside the return window cannot start a return — unless the
 * window is switched off (a negative `windowDays`, -1 by convention), in which
 * case every order is eligible and the date is never consulted.
 */
export function isWithinReturnWindow(
  orderDate?: string | null,
  windowDays: number = RETURN_WINDOW_DAYS,
): boolean {
  if (windowDays < 0) return true;
  return daysSince(orderDate) <= windowDays;
}
