import React from "react";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="w-full p-10 text-center text-sm opacity-70">{label}</div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-10 text-center text-sm opacity-70">
      {message}
    </div>
  );
}

/**
 * Shown when the app's `returns` backend connection does not resolve. Returns
 * cannot be read or written without it, so every entry point degrades to
 * this instead of throwing.
 */
export function DataNotConfigured() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Returns are not available yet — this store has not configured the returns
      data service.
    </div>
  );
}
