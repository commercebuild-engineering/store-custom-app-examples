import React from "react";

import { STATUS_PILLS, STATUS_REQUESTED } from "../shared/constants";

export function StatusPill({ status }: { status: string }) {
  const [background, color] = STATUS_PILLS[status] ??
    STATUS_PILLS[STATUS_REQUESTED] ?? ["#F4F4F5", "#52525B"];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
      style={{ background, color }}
    >
      {status}
    </span>
  );
}
