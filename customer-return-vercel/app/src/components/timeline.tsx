import React from "react";

import {
  ACCENT,
  RETURN_STEPS,
  STATUS_APPROVED,
  STATUS_INFO_REQUESTED,
  STATUS_REJECTED,
} from "../shared/constants";
import { formatDateTime } from "../shared/format";
import type { StatusEntry } from "../shared/returns-store";

/**
 * Progress of a request. The happy-path steps always render (upcoming ones
 * greyed out); anything the admin appended that is not a happy-path step —
 * Rejected, Info Requested — is shown after them so nothing in the history is
 * silently dropped (AC5).
 */
export function Timeline({
  history,
  rma,
}: {
  history: StatusEntry[];
  rma?: string | null;
}) {
  // First time each step was reached, plus the admin's message for it.
  const reached = new Map<string, StatusEntry>();
  for (const entry of history) {
    if (!reached.has(entry.label)) reached.set(entry.label, entry);
  }
  const extras = history.filter(
    (entry) => !(RETURN_STEPS as readonly string[]).includes(entry.label),
  );
  const isTerminal = history.some((entry) => entry.label === STATUS_REJECTED);

  const happyPath: StatusEntry[] = (
    isTerminal ? RETURN_STEPS.slice(0, 2) : RETURN_STEPS
  ).map((label) => {
    const entry = reached.get(label);
    return { label, at: entry?.at ?? "", message: entry?.message };
  });
  const steps: StatusEntry[] = happyPath.concat(extras);

  return (
    <ol className="space-y-4">
      {steps.map((step, index) => {
        const done = Boolean(step.at);
        const isWarning =
          step.label === STATUS_REJECTED ||
          step.label === STATUS_INFO_REQUESTED;
        return (
          <li
            key={`${step.label}-${index}`}
            className="items-start gap-3 [display:flex]"
          >
            <span
              className="mt-1 size-2.5 shrink-0 rounded-full"
              style={{
                background: done ? (isWarning ? "#DC2626" : ACCENT) : "#E4E4E7",
              }}
            />
            <div>
              <div
                className={
                  done ? "text-sm font-semibold" : "text-sm opacity-40"
                }
              >
                {step.label}
              </div>
              {done && (
                <div className="text-xs opacity-70">
                  {formatDateTime(step.at)}
                </div>
              )}
              {done && step.label === STATUS_APPROVED && rma && (
                <div className="mt-1 text-xs font-semibold">RMA {rma}</div>
              )}
              {done && step.message && (
                <div
                  className={
                    "mt-1.5 rounded-md px-2.5 py-1.5 text-xs " +
                    (isWarning ? "bg-red-50 text-red-800" : "bg-zinc-50")
                  }
                >
                  {step.message}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
