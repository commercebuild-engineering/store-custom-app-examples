import React from "react";

import { PAGE_SIZES } from "../shared/constants";

interface PaginationProps {
  /** 0-based page index currently requested. */
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}

function PageButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm enabled:hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/**
 * Mirrors the storefront account tables: record count, page position, a page
 * size selector and First/Previous/Next/Last.
 */
export function Pagination({
  page,
  size,
  totalPages,
  totalElements,
  onPage,
  onSize,
}: PaginationProps) {
  const lastPage = Math.max(0, totalPages - 1);
  const isFirst = page <= 0;
  const isLast = page >= lastPage;

  return (
    <div className="mt-4 w-full items-center justify-between gap-3 [display:flex] [flex-wrap:wrap]">
      <p className="text-sm opacity-70">
        Total: {totalElements} records. Page{" "}
        {Math.min(page + 1, totalPages || 1)} of {totalPages || 1}
      </p>
      <div className="items-center gap-2 [display:flex]">
        <select
          value={size}
          onChange={(event) => onSize(Number(event.target.value))}
          className="rounded-md border border-zinc-200 px-2 py-1.5 text-sm"
          aria-label="Records per page"
        >
          {PAGE_SIZES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <PageButton disabled={isFirst} onClick={() => onPage(0)}>
          First
        </PageButton>
        <PageButton disabled={isFirst} onClick={() => onPage(page - 1)}>
          Previous
        </PageButton>
        <PageButton disabled={isLast} onClick={() => onPage(page + 1)}>
          Next
        </PageButton>
        <PageButton disabled={isLast} onClick={() => onPage(lastPage)}>
          Last
        </PageButton>
      </div>
    </div>
  );
}
