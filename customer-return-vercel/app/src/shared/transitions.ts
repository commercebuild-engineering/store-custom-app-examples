/**
 * The return lifecycle as pure data, so both hosts and any test agree on it:
 *
 *   Requested → Under Review → (Info Requested) → Approved · RMA Issued
 *             → Received → Inspected → Credited          — or → Rejected
 */
import {
  STATUS_APPROVED,
  STATUS_CREDITED,
  STATUS_INFO_REQUESTED,
  STATUS_INSPECTED,
  STATUS_RECEIVED,
  STATUS_REJECTED,
  STATUS_REQUESTED,
  STATUS_UNDER_REVIEW,
} from "./constants";

export type ReturnAction =
  | "approve"
  | "requestInfo"
  | "reject"
  | "received"
  | "inspected"
  | "credit";

/** States in which the request is still being decided on. */
export const REVIEW_STATES: readonly string[] = [
  STATUS_REQUESTED,
  STATUS_UNDER_REVIEW,
  STATUS_INFO_REQUESTED,
];

/** What an admin may do next, in display order. Empty when terminal. */
export function actionsFor(status: string): ReturnAction[] {
  if (REVIEW_STATES.includes(status))
    return ["approve", "requestInfo", "reject"];
  if (status === STATUS_APPROVED) return ["received"];
  if (status === STATUS_RECEIVED) return ["inspected"];
  if (status === STATUS_INSPECTED) return ["credit"];
  return [];
}

export function isTerminal(status: string): boolean {
  return status === STATUS_CREDITED || status === STATUS_REJECTED;
}

/** Actions that need a customer-visible message before they run. */
export function actionNeedsMessage(action: ReturnAction): boolean {
  return action === "requestInfo" || action === "reject";
}

/** Source states each action is valid from — the transaction guard. */
export function allowedFrom(action: ReturnAction): readonly string[] {
  switch (action) {
    case "approve":
    case "requestInfo":
    case "reject":
      return REVIEW_STATES;
    case "received":
      return [STATUS_APPROVED];
    case "inspected":
      return [STATUS_RECEIVED];
    case "credit":
      return [STATUS_INSPECTED];
  }
}

/** Target state of each action. */
export function targetOf(action: ReturnAction): string {
  switch (action) {
    case "approve":
      return STATUS_APPROVED;
    case "requestInfo":
      return STATUS_INFO_REQUESTED;
    case "reject":
      return STATUS_REJECTED;
    case "received":
      return STATUS_RECEIVED;
    case "inspected":
      return STATUS_INSPECTED;
    case "credit":
      return STATUS_CREDITED;
  }
}
