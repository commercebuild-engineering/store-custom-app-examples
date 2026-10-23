import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { order_v1 } from "platform-api";

import { ORDER_STATUS_OPTIONS } from "../shared/constants";
import { formatDate, formatMoney, isWithinReturnWindow } from "../lib/format";
import { compressPhoto, type ReturnPhoto } from "../shared/image";
import { goToPage, orderDetailPath } from "../lib/nav";
import { getOrderDetail } from "../lib/order-detail";
import {
  createReturnRequest,
  listReturnsForCustomer,
  useReturnsDb,
  type ReturnItem,
  type ReturnRequest,
} from "../shared/returns-store";
import {
  isReturnWindowDisabled,
  useReturnsSettings,
  type ReturnsSettings,
} from "../shared/settings";
import { useIdentity, type Identity } from "../lib/use-identity";
import { editOrderPath, useOrderEditEnabled } from "../lib/use-order-edit";
import { Pagination } from "../components/pagination";
import { StatusPill } from "../components/status-pill";
import {
  DataNotConfigured,
  Empty,
  ErrorBox,
  Loading,
} from "../components/notices";

export const metadata = { title: "Orders" };

type OrderRow = order_v1.OrdersOrdersInterface;
type OrderDetail = order_v1.OrdersOrderInterface;
type OrderLine = order_v1.OrdersOrderLineInterface;
type OrderStatusFilter = (typeof ORDER_STATUS_OPTIONS)[number];

interface Filters {
  orderNumber: string;
  dateFrom: string;
  dateTo: string;
  status: "" | OrderStatusFilter;
}

const EMPTY_FILTERS: Filters = {
  orderNumber: "",
  dateFrom: "",
  dateTo: "",
  status: "",
};

/** Per-line draft state on the start-return screen. */
interface LineDraft {
  selected: boolean;
  returnQty: number;
  reason: string;
  photos: ReturnPhoto[];
}

/** Actions render as links, not buttons — matching the storefront table. */
const linkActionClass =
  "text-sm font-semibold whitespace-nowrap underline hover:no-underline";

const inputClass =
  "rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#7C3AED]";

/**
 * Which screen is showing, kept in the query string rather than only in
 * React state: `?order=COF000000152` is the start-return screen for that
 * order, `?order=…&submitted=RET-1001` the confirmation. Every editor
 * recompile swaps in a fresh page component (so any useState resets to its
 * initial value), and a customer's reload would do the same — reading the
 * URL on mount means both land back on the screen they were on.
 */
interface ViewState {
  view: "list" | "start" | "submitted";
  orderNumber: string;
  requestId: string;
}

function readViewState(): ViewState {
  if (typeof window === "undefined") {
    return { view: "list", orderNumber: "", requestId: "" };
  }
  const params = new URLSearchParams(window.location.search);
  const orderNumber = params.get("order") ?? "";
  const requestId = params.get("submitted") ?? "";
  if (orderNumber && requestId)
    return { view: "submitted", orderNumber, requestId };
  if (orderNumber) return { view: "start", orderNumber, requestId: "" };
  return { view: "list", orderNumber: "", requestId: "" };
}

function writeViewState(state: ViewState): void {
  const params = new URLSearchParams(window.location.search);
  params.delete("order");
  params.delete("submitted");
  if (state.view !== "list") params.set("order", state.orderNumber);
  if (state.view === "submitted") params.set("submitted", state.requestId);
  const search = params.toString();
  window.history.replaceState(
    null,
    "",
    window.location.pathname + (search ? `?${search}` : ""),
  );
}

export default function OrdersPage() {
  const [viewState, setViewState] = useState<ViewState>(readViewState);
  /** Bumped after a submission so the list re-reads the return statuses. */
  const [returnsVersion, setReturnsVersion] = useState(0);

  const navigate = (next: ViewState) => {
    writeViewState(next);
    setViewState(next);
  };
  const backToList = () =>
    navigate({ view: "list", orderNumber: "", requestId: "" });

  const {
    identity,
    loading: identityLoading,
    error: identityError,
  } = useIdentity();
  const db = useReturnsDb();
  // Store overrides (return window, reasons, photo cap) from
  // app-returns-config/settings, on top of the constants.ts defaults.
  const { settings, loading: settingsLoading } = useReturnsSettings(db);

  if (identityLoading || settingsLoading) return <Loading />;
  if (identityError) {
    return (
      <Shell>
        <ErrorBox message={identityError} />
      </Shell>
    );
  }

  if (viewState.view === "start") {
    return (
      <StartReturn
        orderNumber={viewState.orderNumber}
        db={db}
        settings={settings}
        identity={identity}
        onCancel={backToList}
        onSubmitted={(requestId, orderNumber) => {
          setReturnsVersion((version) => version + 1);
          navigate({ view: "submitted", orderNumber, requestId });
        }}
      />
    );
  }

  if (viewState.view === "submitted") {
    return (
      <Submitted
        requestId={viewState.requestId}
        orderNumber={viewState.orderNumber}
        onBackToOrders={backToList}
      />
    );
  }

  return (
    <OrderList
      db={db}
      settings={settings}
      customerCode={identity?.customerCode ?? ""}
      isB2b={identity?.isB2b ?? false}
      returnsVersion={returnsVersion}
      onStartReturn={(orderNumber) =>
        navigate({ view: "start", orderNumber, requestId: "" })
      }
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-10">{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Orders list                                                         */
/* ------------------------------------------------------------------ */

function OrderList({
  db,
  settings,
  customerCode,
  isB2b,
  returnsVersion,
  onStartReturn,
}: {
  db: ReturnType<typeof useReturnsDb>;
  settings: ReturnsSettings;
  customerCode: string;
  isB2b: boolean;
  returnsVersion: number;
  onStartReturn: (orderNumber: string) => void;
}) {
  // Order edit/cancel is B2B-only and store-configurable — same gate the
  // core Orders table applies before showing its Edit link.
  const canEditOrders = useOrderEditEnabled() && isB2b;
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [totals, setTotals] = useState({ totalPages: 0, totalElements: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [returnsError, setReturnsError] = useState("");

  // Debounce the typed filters so each keystroke doesn't hit the platform.
  useEffect(() => {
    const timer = setTimeout(() => {
      setApplied(filters);
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const result = await cb.platform.order().getOrders({
          page,
          size,
          sort: "orderDate,desc",
          ...(applied.orderNumber ? { orderNumber: applied.orderNumber } : {}),
          ...(applied.dateFrom ? { dateFrom: applied.dateFrom } : {}),
          ...(applied.dateTo ? { dateTo: applied.dateTo } : {}),
          ...(applied.status ? { status: applied.status } : {}),
        });
        if (!active) return;
        setOrders(result.orders ?? []);
        setTotals({
          totalPages: result.totalPages ?? 0,
          totalElements: result.totalElements ?? 0,
        });
      } catch (e: any) {
        if (active) setError(e?.message ?? "Could not load your orders.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [page, size, applied]);

  // One query covers every order on the page (and My Returns) — see
  // returns-store.ts for why it is equality-only.
  useEffect(() => {
    let active = true;
    if (!db || !customerCode) return;
    (async () => {
      try {
        const result = await listReturnsForCustomer(db, customerCode);
        if (active) {
          setReturns(result);
          setReturnsError("");
        }
      } catch (e: any) {
        // A returns-lookup failure must not take the order list down — the
        // Actions column just falls back to "Return Items" — but it is worth
        // saying so, since it usually means the returns service is unreachable.
        if (active) {
          setReturnsError(
            e?.message ?? "Return statuses could not be loaded right now.",
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [db, customerCode, returnsVersion]);

  const returnByOrder = useMemo(() => {
    const map = new Map<string, ReturnRequest>();
    // listReturnsForCustomer is newest-first, so the first hit wins.
    for (const request of returns) {
      if (!map.has(request.orderNumber)) map.set(request.orderNumber, request);
    }
    return map;
  }, [returns]);

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm opacity-70">
          A list of orders in your account.{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => goToPage("ReturnsPage")}
          >
            View my returns
          </button>
        </p>
      </div>

      {!db && (
        <div className="mb-4">
          <DataNotConfigured />
        </div>
      )}

      <div className="mb-4 items-end gap-3 [display:flex] [flex-wrap:wrap]">
        <label className="[display:block]">
          <span className="mb-1 [display:block] text-xs font-semibold opacity-70">
            Order No.
          </span>
          <input
            value={filters.orderNumber}
            onChange={(event) =>
              setFilters({ ...filters, orderNumber: event.target.value })
            }
            placeholder="Filter Order No…."
            className={inputClass}
          />
        </label>
        <label className="[display:block]">
          <span className="mb-1 [display:block] text-xs font-semibold opacity-70">
            From
          </span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) =>
              setFilters({ ...filters, dateFrom: event.target.value })
            }
            className={inputClass}
          />
        </label>
        <label className="[display:block]">
          <span className="mb-1 [display:block] text-xs font-semibold opacity-70">
            To
          </span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              setFilters({ ...filters, dateTo: event.target.value })
            }
            className={inputClass}
          />
        </label>
        <label className="[display:block]">
          <span className="mb-1 [display:block] text-xs font-semibold opacity-70">
            Status
          </span>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters({
                ...filters,
                status: event.target.value as Filters["status"],
              })
            }
            className={inputClass}
          >
            <option value="">All Status</option>
            {ORDER_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setFilters(EMPTY_FILTERS)}
          className="rounded-md border border-zinc-200 px-3 py-2 text-sm opacity-70 hover:bg-zinc-50"
        >
          Clear
        </button>
      </div>

      {error && <ErrorBox message={error} />}
      {returnsError && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Return statuses are unavailable: {returnsError}
        </div>
      )}

      {loading ? (
        <Loading label="Loading orders…" />
      ) : orders.length === 0 ? (
        <Empty message="No orders match these filters." />
      ) : (
        <div className="w-full overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase opacity-70">
              <tr>
                <th className="px-4 py-3">Order No.</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const existing = returnByOrder.get(order.orderNumber);
                const orderDate = orderDateOf(order);
                const canReturn = isWithinReturnWindow(
                  orderDate,
                  settings.returnWindowDays,
                );
                return (
                  <tr
                    key={order.orderNumber}
                    className="border-t border-zinc-100"
                  >
                    <td className="px-4 py-3">
                      <a
                        href={orderDetailPath(order.orderNumber)}
                        className="font-semibold underline"
                      >
                        {order.orderNumber}
                      </a>
                    </td>
                    <td className="px-4 py-3 opacity-80">
                      {formatDate(orderDate)}
                    </td>
                    <td className="px-4 py-3 opacity-80">{order.status}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatMoney(
                        order.totalAmountIncludingTax,
                        order.currencyCode,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="items-center justify-end gap-4 [display:flex] [flex-wrap:wrap]">
                        {canEditOrders && !order.isCancelled && (
                          <a
                            href={editOrderPath(
                              order.orderNumber,
                              order.processId,
                            )}
                            className={linkActionClass}
                          >
                            Edit Order
                          </a>
                        )}
                        {canReturn ? (
                          <button
                            type="button"
                            onClick={() => onStartReturn(order.orderNumber)}
                            className={linkActionClass}
                          >
                            Return Items
                          </button>
                        ) : (
                          <span
                            className="text-sm whitespace-nowrap opacity-40"
                            title={`Returns are accepted within ${settings.returnWindowDays} days of the order date`}
                          >
                            Return window closed
                          </span>
                        )}
                        {existing && (
                          <button
                            type="button"
                            onClick={() =>
                              goToPage(
                                "ReturnsPage",
                                `id=${encodeURIComponent(existing.requestId)}`,
                              )
                            }
                            title={`Return ${existing.requestId}`}
                          >
                            <StatusPill status={existing.status} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        size={size}
        totalPages={totals.totalPages}
        totalElements={totals.totalElements}
        onPage={setPage}
        onSize={(next) => {
          setSize(next);
          setPage(0);
        }}
      />
      {!isReturnWindowDisabled(settings) && (
        <p className="mt-2 text-xs opacity-70">
          Returns accepted within {settings.returnWindowDays} days of the order
          date.
        </p>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Start a return                                                      */
/* ------------------------------------------------------------------ */

function StartReturn({
  orderNumber,
  db,
  settings,
  identity,
  onCancel,
  onSubmitted,
}: {
  orderNumber: string;
  db: ReturnType<typeof useReturnsDb>;
  settings: ReturnsSettings;
  identity: Identity | null;
  onCancel: () => void;
  onSubmitted: (requestId: string, orderNumber: string) => void;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [drafts, setDrafts] = useState<Record<number, LineDraft>>({});
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await getOrderDetail(orderNumber);
        if (!active) return;
        if (!result) {
          setLoadError(`Order ${orderNumber} could not be found.`);
          return;
        }
        setOrder(result);
        const initial: Record<number, LineDraft> = {};
        (result.orderLines ?? []).forEach((_line, index) => {
          initial[lineKeyOf(index)] = {
            selected: false,
            returnQty: 1,
            reason: "",
            photos: [],
          };
        });
        setDrafts(initial);
      } catch (e: any) {
        if (active) setLoadError(e?.message ?? "Could not load this order.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [orderNumber]);

  const lines = order?.orderLines ?? [];

  const updateDraft = useCallback(
    (sequence: number, patch: Partial<LineDraft>) => {
      setDrafts((current) => ({
        ...current,
        [sequence]: { ...current[sequence], ...patch },
      }));
    },
    [],
  );

  const selectedLines = lines
    .map((line, index) => ({ line, key: lineKeyOf(index) }))
    .filter(({ key }) => drafts[key]?.selected);
  const estimatedCredit = selectedLines.reduce((total, { line, key }) => {
    const draft = drafts[key];
    return total + (draft?.returnQty ?? 0) * unitPriceOf(line);
  }, 0);

  const missingReason = selectedLines.some(({ key }) => !drafts[key]?.reason);
  const cannotSubmit =
    submitting || !db || selectedLines.length === 0 || missingReason;

  const addPhotos = useCallback(
    async (sequence: number, fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setError("");
      const existing = drafts[sequence]?.photos ?? [];
      const room = settings.maxPhotosPerLine - existing.length;
      if (room <= 0) {
        setError(
          `You can attach up to ${settings.maxPhotosPerLine} photos per item.`,
        );
        return;
      }
      const accepted: ReturnPhoto[] = [];
      for (const file of Array.from(fileList).slice(0, room)) {
        try {
          accepted.push(await compressPhoto(file));
        } catch (e: any) {
          setError(e?.message ?? "That image could not be attached.");
        }
      }
      if (accepted.length > 0) {
        updateDraft(sequence, { photos: [...existing, ...accepted] });
      }
    },
    [drafts, updateDraft, settings.maxPhotosPerLine],
  );

  const submit = async () => {
    if (!db || !order) return;
    if (selectedLines.length === 0) {
      setError("Select at least one item to return.");
      return;
    }
    if (missingReason) {
      setError("Choose a reason for every item you are returning.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const items: ReturnItem[] = selectedLines.map(({ line, key }) => {
        const draft = drafts[key];
        return {
          // The line's position in the order — unique per line, unlike the
          // platform's own `sequence`, and what the photos are filed under.
          sequence: key,
          itemCode: line.itemCode,
          displayItemCode: line.displayItemCode || line.itemCode,
          itemDesc: line.itemDesc,
          uom: line.uom,
          unitPrice: unitPriceOf(line),
          purchasedQty: line.qty,
          returnQty: draft.returnQty,
          reason: draft.reason,
          photoCount: draft.photos.length,
        };
      });
      const photosByLine: Record<number, ReturnPhoto[]> = {};
      for (const { key } of selectedLines) {
        photosByLine[key] = drafts[key].photos;
      }

      const requestId = await createReturnRequest(db, {
        orderNumber: order.orderNumber,
        orderDate: order.orderDate || order.lastModifiedDate || "",
        currencyCode: order.currencyCode,
        customerCode: identity?.customerCode || order.customerCode,
        customerName:
          identity?.customerName || order.billingDetails?.name || "",
        customerEmail:
          identity?.customerEmail || order.billingDetails?.email || "",
        userId: identity?.userId ?? null,
        userName: identity?.userName || order.username || "",
        comment,
        items,
        photosByLine,
      });
      onSubmitted(requestId, order.orderNumber);
    } catch (e: any) {
      setError(e?.message ?? "The return request could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading label="Loading order…" />;
  if (loadError) {
    return (
      <Shell>
        <BackLink label="← Back to orders" onClick={onCancel} />
        <ErrorBox message={loadError} />
      </Shell>
    );
  }

  return (
    <Shell>
      <BackLink label="← Back to orders" onClick={onCancel} />
      <h1 className="text-2xl font-bold tracking-tight">Start a return</h1>
      <p className="mt-1 mb-6 text-sm opacity-70">
        Order <span className="font-semibold">{order?.orderNumber}</span> ·
        placed {formatDate(order?.orderDate || order?.lastModifiedDate)}. Select
        the items you want to return.
      </p>

      {!db && (
        <div className="mb-4">
          <DataNotConfigured />
        </div>
      )}

      <div className="w-full overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase opacity-70">
            <tr>
              <th className="px-4 py-3" />
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-center">Purchased</th>
              <th className="px-4 py-3 text-center">Return qty</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Photos</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => {
              const key = lineKeyOf(index);
              const draft = drafts[key] ?? {
                selected: false,
                returnQty: 1,
                reason: "",
                photos: [],
              };
              return (
                <tr key={key} className="border-t border-zinc-100">
                  <td className="px-4 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={draft.selected}
                      onChange={(event) =>
                        updateDraft(key, {
                          selected: event.target.checked,
                        })
                      }
                      aria-label={`Return ${line.itemDesc}`}
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold">{line.itemDesc}</div>
                    <div className="text-xs opacity-70">
                      {line.displayItemCode || line.itemCode} ·{" "}
                      {formatMoney(unitPriceOf(line), order?.currencyCode)} each
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center align-top opacity-80">
                    {line.qty}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="items-center justify-center gap-2 [display:flex]">
                      <StepButton
                        label="−"
                        disabled={!draft.selected || draft.returnQty <= 1}
                        onClick={() =>
                          updateDraft(key, {
                            returnQty: Math.max(1, draft.returnQty - 1),
                          })
                        }
                      />
                      <span className="w-6 text-center font-semibold">
                        {draft.returnQty}
                      </span>
                      <StepButton
                        label="+"
                        // AC2: return qty can never exceed the purchased qty.
                        disabled={
                          !draft.selected || draft.returnQty >= line.qty
                        }
                        onClick={() =>
                          updateDraft(key, {
                            returnQty: Math.min(line.qty, draft.returnQty + 1),
                          })
                        }
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <select
                      value={draft.reason}
                      disabled={!draft.selected}
                      onChange={(event) =>
                        updateDraft(key, {
                          reason: event.target.value,
                        })
                      }
                      className={`${inputClass} w-full disabled:bg-zinc-50 disabled:opacity-40`}
                    >
                      <option value="">Select a reason…</option>
                      {settings.returnReasons.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {draft.selected ? (
                      <div className="items-center gap-2 [display:flex] [flex-wrap:wrap]">
                        {draft.photos.map((photo) => (
                          <span
                            key={photo.id}
                            className="relative [display:inline-block]"
                          >
                            <img
                              src={photo.dataUrl}
                              alt={photo.name}
                              className="size-12 rounded-md border border-zinc-200 object-cover"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateDraft(key, {
                                  photos: draft.photos.filter(
                                    (candidate) => candidate.id !== photo.id,
                                  ),
                                })
                              }
                              className="absolute -top-2 -right-2 size-5 rounded-full bg-zinc-900 text-xs text-white"
                              aria-label={`Remove ${photo.name}`}
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                        {draft.photos.length < settings.maxPhotosPerLine && (
                          <label
                            className="cursor-pointer rounded-md border border-dashed border-zinc-300 px-3 py-2 text-xs opacity-70 hover:bg-zinc-50"
                            title="Optional"
                          >
                            Add photo
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="w-0 opacity-0 [position:absolute]"
                              onChange={(event) => {
                                void addPhotos(key, event.target.files);
                                event.target.value = "";
                              }}
                            />
                          </label>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs opacity-40">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 gap-6 [display:grid] [grid-template-columns:1fr] md:[grid-template-columns:1fr_320px]">
        <div>
          <label className="mb-1 [display:block] text-sm font-semibold opacity-80">
            Comments <span className="font-normal opacity-60">(optional)</span>
          </label>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={5}
            placeholder="Add any details that will help us process the return…"
            className={`${inputClass} w-full`}
          />
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="mb-3 text-sm font-bold">Return summary</div>
          <div className="justify-between [display:flex] text-sm opacity-80">
            <span>Items selected</span>
            <span className="font-semibold opacity-100">
              {selectedLines.length}
            </span>
          </div>
          <div className="mt-1 justify-between [display:flex] text-sm opacity-80">
            <span>Estimated credit</span>
            <span className="font-semibold opacity-100">
              {formatMoney(estimatedCredit, order?.currencyCode)}
            </span>
          </div>
          {error && (
            <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
          <button
            type="button"
            disabled={cannotSubmit}
            onClick={submit}
            data-btn-variant="primary"
            className="button-scheme-default relative mt-4 inline-flex h-auto min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-base font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit return request"}
          </button>
          <p className="mt-2 text-xs opacity-70">
            Your account manager will be notified and you'll receive an RMA
            number once approved.
          </p>
        </div>
      </div>
    </Shell>
  );
}

/**
 * The date to show and to measure the return window against.
 *
 * `orderDate` is the ERP order date and the list DTO omits it entirely when it
 * is null (`@JsonInclude(NON_NULL)`) — which is the case for orders that have
 * not been given one by the ERP yet. Those still carry `startedOn` (when the
 * order was placed) and `updatedOn`, so fall back through them rather than
 * showing a blank cell.
 */
function orderDateOf(order: OrderRow): string {
  return order.orderDate || order.startedOn || order.updatedOn || "";
}

/**
 * The key a line's draft (and later its photos) is filed under: its 1-based
 * position in the order. NOT `line.sequence` — the platform returns the same
 * sequence for every line on some orders, which made every row share one
 * checkbox, quantity and reason.
 */
function lineKeyOf(index: number): number {
  return index + 1;
}

/** `unitPriceDisplay` is the customer-facing price; fall back for old orders. */
function unitPriceOf(line: OrderLine): number {
  return line.unitPriceDisplay ?? line.unitPrice ?? line.price ?? 0;
}

function StepButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="size-7 rounded-md border border-zinc-200 text-sm enabled:hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {label}
    </button>
  );
}

function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 text-sm font-semibold underline hover:no-underline"
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Confirmation                                                        */
/* ------------------------------------------------------------------ */

function Submitted({
  requestId,
  orderNumber,
  onBackToOrders,
}: {
  requestId: string;
  orderNumber: string;
  onBackToOrders: () => void;
}) {
  return (
    <Shell>
      <div className="mx-auto max-w-xl rounded-lg border border-zinc-200 p-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary text-2xl text-primary-foreground">
          ✓
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          Return request submitted
        </h1>
        <p className="mt-3 text-sm opacity-80">
          Request <strong>{requestId}</strong> for order{" "}
          <strong>{orderNumber}</strong> has been sent for review.
        </p>
        <div className="mt-6 items-center justify-center gap-3 [display:flex]">
          <button
            type="button"
            onClick={() => goToPage("ReturnsPage")}
            data-btn-variant="primary"
            className="button-scheme-default relative inline-flex h-auto min-h-[44px] items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-base font-medium text-primary-foreground shadow-xs transition-all hover:bg-primary/90 hover:opacity-90"
          >
            Track my returns
          </button>
          <button
            type="button"
            onClick={onBackToOrders}
            className="rounded-md border border-zinc-200 px-4 py-2.5 text-sm font-semibold opacity-80 hover:bg-zinc-50"
          >
            Back to orders
          </button>
        </div>
      </div>
    </Shell>
  );
}
