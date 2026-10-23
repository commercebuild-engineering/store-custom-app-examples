/*
 * The values in this block are DEFAULTS. A store overrides them per field in
 * the returns service's settings — see settings.ts for the field names
 * (`returnWindowDays`, `maxPhotosPerLine`, `returnReasons`).
 */

/**
 * Days after the order date a return may still be started.
 *
 * -1 switches the window off entirely: every order becomes eligible for a
 * return regardless of its age (and of whether it carries a usable order date
 * at all).
 */
export const RETURN_WINDOW_DAYS = 90;

/** Max photos a customer may attach to a single return line. */
export const MAX_PHOTOS_PER_LINE = 3;

/** Reasons offered per line item, in the design's order. */
export const RETURN_REASONS = [
  "Damaged in transit",
  "Wrong item shipped",
  "Defective / faulty",
  "No longer needed",
  "Ordered by mistake",
  "Quality not as expected",
  "Other",
] as const;

export type ReturnReason = (typeof RETURN_REASONS)[number];

export const STATUS_REQUESTED = "Requested";
export const STATUS_UNDER_REVIEW = "Under Review";
export const STATUS_INFO_REQUESTED = "Info Requested";
export const STATUS_APPROVED = "Approved · RMA Issued";
export const STATUS_RECEIVED = "Received";
export const STATUS_INSPECTED = "Inspected";
export const STATUS_CREDITED = "Credited";
export const STATUS_REJECTED = "Rejected";

/**
 * History-only label (never a `status`): the customer answered an
 * "Info Requested" — the request itself goes back to Under Review.
 */
export const HISTORY_INFO_PROVIDED = "Info Provided";

/** Every status, in lifecycle order — drives the admin filter tabs. */
export const ALL_STATUSES = [
  STATUS_REQUESTED,
  STATUS_UNDER_REVIEW,
  STATUS_INFO_REQUESTED,
  STATUS_APPROVED,
  STATUS_RECEIVED,
  STATUS_INSPECTED,
  STATUS_CREDITED,
  STATUS_REJECTED,
] as const;

/** Short label for a status where space is tight (tabs). */
export const STATUS_SHORT_LABELS: Record<string, string> = {
  [STATUS_APPROVED]: "Approved",
};

/**
 * The happy path an approved return walks. Admin appends to
 * `statusHistory`; the customer timeline renders these steps and marks
 * the ones already in the history as done.
 */
export const RETURN_STEPS = [
  STATUS_REQUESTED,
  STATUS_UNDER_REVIEW,
  STATUS_APPROVED,
  STATUS_RECEIVED,
  STATUS_INSPECTED,
  STATUS_CREDITED,
] as const;

/** [background, foreground] per status, matching the design prototype. */
export const STATUS_PILLS: Record<string, [string, string]> = {
  [STATUS_REQUESTED]: ["#F4F4F5", "#52525B"],
  [STATUS_UNDER_REVIEW]: ["#FEF3C7", "#92400E"],
  [STATUS_INFO_REQUESTED]: ["#FFEDD5", "#9A3412"],
  [STATUS_APPROVED]: ["#DBEAFE", "#1D4ED8"],
  [STATUS_RECEIVED]: ["#EDE9FE", "#6D28D9"],
  [STATUS_INSPECTED]: ["#FAE8FF", "#86198F"],
  [STATUS_CREDITED]: ["#D1FAE5", "#065F46"],
  [STATUS_REJECTED]: ["#FEE2E2", "#B91C1C"],
};

/** Order statuses the platform accepts as a `getOrders` filter. */
export const ORDER_STATUS_OPTIONS = [
  "OPEN",
  "DRAFT",
  "PROCESSING",
  "RELEASED",
  "PENDING_APPROVAL",
  "PENDING_PREPAYMENT",
  "PENDING_FULFILLMENT",
  "CLOSED",
] as const;

export const PAGE_SIZES = [5, 10, 15, 20, 50, 100];

export const ACCENT = "#7C3AED";
