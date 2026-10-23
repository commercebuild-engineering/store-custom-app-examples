import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ALL_STATUSES,
  HISTORY_INFO_PROVIDED,
  STATUS_REQUESTED,
  STATUS_SHORT_LABELS,
} from "../../shared/constants";
import {
  formatDate,
  formatDateTime,
  formatMoneyIntl,
} from "../../shared/format";

import {
  addNote,
  applyReturnAction,
  countReturnsByStatus,
  deleteReturnPermanently,
  fetchReturnsPage,
  findReturnByRequestId,
  listNotes,
  listPhotos,
  markUnderReview,
  searchReturns,
  StaleStatusError,
  subscribeReturn,
  useReturnsDb,
  type InternalNote,
  type ReturnRequest,
  type StoredPhoto,
} from "../../shared/returns-store";
import {
  actionNeedsMessage,
  actionsFor,
  isTerminal,
  type ReturnAction,
} from "../../shared/transitions";
import {
  Card,
  ConfirmModal,
  CursorPagination,
  CustomerCell,
  DataNotConfigured,
  EmptyState,
  IconArrowLeft,
  MessageModal,
  Notice,
  PageHeader,
  SearchBox,
  Skeleton,
  StatusPill,
  TableSkeleton,
  Tabs,
  type TabDef,
} from "../components/kit";
import {
  BUTTON_DANGER,
  BUTTON_LINK,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  INPUT,
  ROW_CLICKABLE,
  TABLE,
  TABLE_WRAP,
  TD,
  TH,
  cx,
} from "../lib/tokens";
import { useAdminIdentity } from "../lib/use-admin-identity";
import { pushSelectedId, readSelectedId, usePopstate } from "../lib/view-state";
import { Lightbox } from "../../shared/ui-lightbox";

export const metadata = { title: "Returns" };

const PAGE_NAME = "Returns";
const TAB_ALL = "all";

type Db = NonNullable<ReturnType<typeof useReturnsDb>>;

export default function ReturnsAdminPage() {
  const db = useReturnsDb();
  const [selectedId, setSelectedId] = useState(readSelectedId);
  usePopstate(setSelectedId);

  const select = useCallback((requestId: string) => {
    pushSelectedId(PAGE_NAME, requestId);
    setSelectedId(requestId);
  }, []);

  if (!db) {
    return (
      <div>
        <PageHeader title="Returns" />
        <DataNotConfigured />
      </div>
    );
  }

  return selectedId ? (
    <ReturnDetail db={db} requestId={selectedId} onBack={() => select("")} />
  ) : (
    <ReturnList db={db} onOpen={select} />
  );
}

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */

function ReturnList({
  db,
  onOpen,
}: {
  db: Db;
  onOpen: (requestId: string) => void;
}) {
  const [tab, setTab] = useState(TAB_ALL);
  const [pageSize, setPageSize] = useState(20);
  // The service pages forward from a cursor; `cursors[i]` is the cursor that
  // starts page i+2, so Previous just drops the last one and refetches.
  const [cursors, setCursors] = useState<string[]>([]);
  const [items, setItems] = useState<ReturnRequest[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ReturnRequest[] | null>(
    null,
  );
  const [searching, setSearching] = useState(false);

  const status = tab === TAB_ALL ? undefined : tab;
  const page = cursors.length + 1;

  // Tab counts — aggregation queries, refreshed with each visit to the list.
  useEffect(() => {
    let active = true;
    countReturnsByStatus(db)
      .then((result) => active && setCounts(result))
      .catch(() => active && setCounts(null));
    return () => {
      active = false;
    };
  }, [db]);

  // One page for the current tab / cursor / size.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchReturnsPage(db, {
      status,
      pageSize,
      after: cursors[cursors.length - 1] ?? null,
    })
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setNextCursor(result.cursor);
      })
      .catch((e: any) => {
        if (!active) return;
        setItems([]);
        setNextCursor(null);
        setError(e?.message ?? "Could not load return requests.");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [db, status, pageSize, cursors]);

  // Search (debounced): the service matches request #, order # and customer
  // code.
  useEffect(() => {
    const term = search.trim();
    if (!term) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      searchReturns(db, term)
        .then((result) => active && setSearchResults(result))
        .catch((e: any) => {
          if (!active) return;
          setSearchResults([]);
          setError(e?.message ?? "Search failed.");
        })
        .finally(() => active && setSearching(false));
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [db, search]);

  const changeTab = (next: string) => {
    setTab(next);
    setCursors([]);
  };
  const changePageSize = (size: number) => {
    setPageSize(size);
    setCursors([]);
  };

  const tabs: TabDef[] = useMemo(
    () => [
      { id: TAB_ALL, label: "All", count: counts?.[""] ?? 0 },
      ...ALL_STATUSES.map((entry) => ({
        id: entry,
        label: STATUS_SHORT_LABELS[entry] ?? entry,
        count: counts?.[entry] ?? 0,
      })),
    ],
    [counts],
  );

  const isSearch = search.trim().length > 0;
  const rows = isSearch
    ? (searchResults ?? []).filter(
        (entry) => !status || entry.status === status,
      )
    : (items ?? []);
  const busy = isSearch ? searching : loading;
  const total = counts?.[tab === TAB_ALL ? "" : tab];

  return (
    <div>
      <PageHeader
        title="Returns"
        subtitle={
          counts
            ? `${counts[""] ?? 0} return request${counts[""] === 1 ? "" : "s"}`
            : "Loading…"
        }
      />

      {error && (
        <div className="mb-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      <Tabs tabs={tabs} active={tab} onChange={changeTab} />

      <div className="mb-3.5 items-center justify-between gap-3 [display:flex] [flex-wrap:wrap]">
        <span className="text-[12px] text-[#6b6b73]">
          {isSearch
            ? `${rows.length} match${rows.length === 1 ? "" : "es"} — exact on request #, order #, email, customer code; customer names by prefix`
            : ""}
        </span>
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search request #, order #, customer…"
        />
      </div>

      <div className={TABLE_WRAP}>
        {busy && rows.length === 0 ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState
            title={
              isSearch
                ? "No requests match"
                : (total ?? 0) === 0
                  ? tab === TAB_ALL
                    ? "No return requests yet"
                    : "Nothing in this status"
                  : "No rows on this page"
            }
            hint={
              isSearch
                ? "Search matches request #, order #, customer code and email exactly, and the start of a customer name."
                : tab === TAB_ALL
                  ? "Requests customers submit from the storefront appear here."
                  : undefined
            }
          />
        ) : (
          <div className={cx("w-full overflow-x-auto", busy && "opacity-60")}>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Request #</th>
                  <th className={TH}>Customer</th>
                  <th className={TH}>Order #</th>
                  <th className={TH}>Date</th>
                  <th className={cx(TH, "text-center")}>Items</th>
                  <th className={cx(TH, "text-right")}>Value</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((request) => (
                  <tr
                    key={request.docId}
                    className={ROW_CLICKABLE}
                    onClick={() => onOpen(request.requestId)}
                  >
                    <td
                      className={cx(
                        TD,
                        "font-mono text-[13px] font-medium text-[#18181b]",
                      )}
                    >
                      {request.requestId}
                    </td>
                    <td className={TD}>
                      <CustomerCell
                        name={request.customerName}
                        email={request.customerEmail}
                      />
                    </td>
                    <td className={cx(TD, "font-mono text-[13px]")}>
                      {request.orderNumber}
                    </td>
                    <td className={cx(TD, "whitespace-nowrap")}>
                      {formatDate(request.createdAtIso)}
                    </td>
                    <td className={cx(TD, "text-center tabular-nums")}>
                      {request.itemCount}
                    </td>
                    <td
                      className={cx(
                        TD,
                        "text-right font-mono text-[13px] tabular-nums text-[#18181b]",
                      )}
                    >
                      {formatMoneyIntl(
                        request.estimatedCredit,
                        request.currencyCode,
                      )}
                    </td>
                    <td className={TD}>
                      <StatusPill status={request.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isSearch && (
          <CursorPagination
            page={page}
            shown={items?.length ?? 0}
            total={total}
            pageSize={pageSize}
            hasNext={nextCursor !== null}
            busy={loading}
            onPrev={() => setCursors((current) => current.slice(0, -1))}
            onNext={() =>
              nextCursor && setCursors((current) => [...current, nextCursor])
            }
            onPageSize={changePageSize}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

const ACTION_LABELS: Record<ReturnAction, string> = {
  approve: "Approve & issue RMA",
  requestInfo: "Request info",
  reject: "Reject",
  received: "Mark received",
  inspected: "Mark inspected",
  credit: "Issue credit",
};

function ReturnDetail({
  db,
  requestId,
  onBack,
}: {
  db: Db;
  requestId: string;
  onBack: () => void;
}) {
  const { identity, loading: identityLoading } = useAdminIdentity();
  const [docId, setDocId] = useState<string | null>(null);
  const [request, setRequest] = useState<ReturnRequest | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [pending, setPending] = useState<ReturnAction | null>(null);
  const [prompt, setPrompt] = useState<ReturnAction | null>(null);
  const [actionError, setActionError] = useState("");
  const [preview, setPreview] = useState<{ src: string; label: string } | null>(
    null,
  );
  const [lastRma, setLastRma] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const reviewedRef = useRef<Set<string>>(new Set());
  const deletingRef = useRef(false);

  // 1. requestId → docId (one lookup), then a live subscription.
  useEffect(() => {
    let active = true;
    setDocId(null);
    setRequest(null);
    setNotFound(false);
    setError("");
    (async () => {
      try {
        const found = await findReturnByRequestId(db, requestId);
        if (!active) return;
        if (!found) {
          setNotFound(true);
          return;
        }
        setDocId(found.docId);
        setRequest(found);
      } catch (e: any) {
        if (active) setError(e?.message ?? "Could not load this return.");
      }
    })();
    return () => {
      active = false;
    };
  }, [db, requestId]);

  useEffect(() => {
    if (!docId) return;
    const unsubscribe = subscribeReturn(
      db,
      docId,
      (next) => {
        if (next) setRequest(next);
        else if (!deletingRef.current) setNotFound(true);
      },
      (e) => setError(e.message),
    );
    return unsubscribe;
  }, [db, docId]);

  // 2. Photos + notes, once per request.
  useEffect(() => {
    if (!docId) return;
    let active = true;
    listPhotos(db, docId)
      .then((result) => active && setPhotos(result))
      .catch(() => active && setPhotos([]));
    listNotes(db, docId)
      .then((result) => active && setNotes(result))
      .catch(() => active && setNotes([]));
    return () => {
      active = false;
    };
  }, [db, docId]);

  // 3. Opening a Requested return puts it Under Review — once per request,
  //    after the admin identity has settled so the entry is attributed.
  useEffect(() => {
    if (!docId || !request || identityLoading) return;
    if (request.status !== STATUS_REQUESTED) return;
    if (reviewedRef.current.has(docId)) return;
    reviewedRef.current.add(docId);
    markUnderReview(db, docId, identity.name).catch((e: any) =>
      setActionError(
        e?.message ?? "Could not mark this return as under review.",
      ),
    );
  }, [db, docId, request, identityLoading, identity.name]);

  const run = async (action: ReturnAction, message?: string) => {
    if (!docId) return;
    setPending(action);
    setActionError("");
    try {
      const rma = await applyReturnAction(db, docId, action, {
        by: identity.name,
        message,
      });
      if (rma) setLastRma(rma);
      setPrompt(null);
    } catch (e: any) {
      setActionError(
        e instanceof StaleStatusError
          ? e.message
          : (e?.message ?? "The action could not be applied."),
      );
    } finally {
      setPending(null);
    }
  };

  const remove = async () => {
    if (!docId) return;
    setDeleting(true);
    deletingRef.current = true;
    setActionError("");
    try {
      await deleteReturnPermanently(db, docId);
      setConfirmDelete(false);
      onBack();
    } catch (e: any) {
      deletingRef.current = false;
      setActionError(e?.message ?? "The return could not be deleted.");
      setDeleting(false);
    }
  };

  const onAction = (action: ReturnAction) => {
    if (actionNeedsMessage(action)) setPrompt(action);
    else void run(action);
  };

  const submitNote = async (text: string) => {
    if (!docId || !text.trim()) return;
    await addNote(db, docId, {
      text,
      authorName: identity.name,
      authorEmail: identity.email,
    });
    setNotes(await listNotes(db, docId));
  };

  if (notFound) {
    return (
      <div>
        <BackLink onClick={onBack} />
        <Notice tone="error">Return {requestId} was not found.</Notice>
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <BackLink onClick={onBack} />
        <Notice tone="error">{error}</Notice>
      </div>
    );
  }
  if (!request) {
    return (
      <div>
        <BackLink onClick={onBack} />
        <Skeleton className="mb-2 h-7 w-48" />
        <Skeleton className="mb-6 h-4 w-72" />
        <div className="gap-5 [display:grid] [grid-template-columns:minmax(0,1fr)] lg:[grid-template-columns:minmax(0,1fr)_320px]">
          <Card>
            <TableSkeleton rows={3} cols={4} />
          </Card>
          <Card>
            <Skeleton className="mb-3 h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </Card>
        </div>
      </div>
    );
  }

  const actions = actionsFor(request.status);
  const creditLabel = formatMoneyIntl(
    request.estimatedCredit,
    request.currencyCode,
  );
  const photosByLine = new Map<number, StoredPhoto[]>();
  for (const photo of photos) {
    const list = photosByLine.get(photo.lineSequence) ?? [];
    list.push(photo);
    photosByLine.set(photo.lineSequence, list);
  }
  const history = [...request.statusHistory].reverse();

  return (
    <div>
      <BackLink onClick={onBack} />

      <PageHeader
        title={
          <span className="items-center gap-3 [display:flex] [flex-wrap:wrap]">
            <span className="font-mono">{request.requestId}</span>
            <StatusPill status={request.status} />
            {request.rma && (
              <span className="rounded-[7px] border border-[#ebebe7] bg-[#f6f6f4] px-2 py-0.5 font-mono text-[12.5px] font-medium text-[#18181b]">
                {request.rma}
              </span>
            )}
          </span>
        }
        subtitle={
          <>
            Requested {formatDateTime(request.createdAtIso)} · order{" "}
            <span className="font-mono text-[#18181b]">
              {request.orderNumber}
            </span>
            {isTerminal(request.status) && " · closed"}
          </>
        }
        actions={
          <>
            {actions.length > 0 && (
              <>
                {actions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    disabled={pending !== null}
                    onClick={() => onAction(action)}
                    className={
                      action === "reject"
                        ? BUTTON_DANGER
                        : action === "requestInfo"
                          ? BUTTON_SECONDARY
                          : BUTTON_PRIMARY
                    }
                  >
                    {pending === action
                      ? "Saving…"
                      : action === "credit"
                        ? `${ACTION_LABELS.credit} ${creditLabel}`
                        : ACTION_LABELS[action]}
                  </button>
                ))}
                <span
                  className="mx-1 h-6 w-px bg-[#dcdcd6]"
                  aria-hidden="true"
                />
              </>
            )}
            <button
              type="button"
              disabled={pending !== null || deleting}
              onClick={() => setConfirmDelete(true)}
              className={BUTTON_DANGER}
              title="Permanently delete this return request"
            >
              Delete
            </button>
          </>
        }
      />

      {actionError && (
        <div className="mb-4">
          <Notice tone="error">{actionError}</Notice>
        </div>
      )}
      {lastRma && request.rma === lastRma && (
        <div className="mb-4">
          <Notice tone="success">
            Approved — RMA <strong>{lastRma}</strong> issued. The customer can
            see it on their return.
          </Notice>
        </div>
      )}

      <div className="gap-5 [display:grid] [grid-template-columns:minmax(0,1fr)] lg:[grid-template-columns:minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className={TABLE_WRAP}>
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>Item</th>
                  <th className={cx(TH, "text-center")}>Qty</th>
                  <th className={cx(TH, "text-right")}>Value</th>
                  <th className={TH}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {request.items.map((item) => (
                  <tr key={`${item.sequence}-${item.itemCode}`}>
                    <td className={TD}>
                      <div className="font-medium text-[#18181b]">
                        {item.itemDesc}
                      </div>
                      <div className="font-mono text-[12px] text-[#6b6b73]">
                        {item.displayItemCode || item.itemCode}
                        {item.purchasedQty
                          ? ` · ${item.purchasedQty} purchased`
                          : ""}
                      </div>
                    </td>
                    <td className={cx(TD, "text-center tabular-nums")}>
                      {item.returnQty}
                    </td>
                    <td
                      className={cx(
                        TD,
                        "text-right font-mono text-[13px] tabular-nums",
                      )}
                    >
                      {formatMoneyIntl(
                        item.returnQty * item.unitPrice,
                        request.currencyCode,
                      )}
                    </td>
                    <td className={TD}>
                      <span className="inline-flex rounded-full border border-[#ebebe7] bg-[#f6f6f4] px-2 py-0.5 text-[12px] text-[#3f3f46]">
                        {item.reason}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td
                    colSpan={2}
                    className="px-3.5 py-3 text-[13px] text-[#6b6b73]"
                  >
                    Total credit value
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono text-[13.5px] font-semibold tabular-nums text-[#18181b]">
                    {creditLabel}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {request.comment && (
            <Card title="Customer comments">
              <p className="text-[13.5px] whitespace-pre-wrap text-[#3f3f46]">
                {request.comment}
              </p>
            </Card>
          )}

          <Card title="Photos">
            {photos.length === 0 ? (
              <p className="text-[13px] text-[#6b6b73]">No photos attached.</p>
            ) : (
              <div className="gap-3 [display:flex] [flex-wrap:wrap]">
                {request.items.map((item) =>
                  (photosByLine.get(item.sequence) ?? []).map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() =>
                        setPreview({ src: photo.dataUrl, label: item.itemDesc })
                      }
                      className="[display:block] w-28 cursor-zoom-in text-left"
                      title={`View photo — ${item.itemDesc}`}
                    >
                      <img
                        src={photo.dataUrl}
                        alt={`Return photo for ${item.itemDesc}`}
                        className="size-28 rounded-[7px] border border-[#ebebe7] object-cover"
                      />
                      <div className="mt-1 truncate text-[11.5px] text-[#6b6b73]">
                        {item.itemDesc}
                      </div>
                      {photo.source === "customer-response" && (
                        <div
                          className="mt-0.5 inline-flex rounded-full bg-[#ece7ff] px-1.5 py-0.5 text-[10.5px] font-medium text-[#4a2de0]"
                          title={
                            photo.createdAtIso
                              ? `Added by the customer ${formatDateTime(photo.createdAtIso)}`
                              : "Added by the customer in reply to a request"
                          }
                        >
                          Added by customer
                          {photo.createdAtIso
                            ? ` · ${formatDate(photo.createdAtIso)}`
                            : ""}
                        </div>
                      )}
                    </button>
                  )),
                )}
              </div>
            )}
          </Card>

          <NotesPanel notes={notes} onAdd={submitNote} />
        </div>

        <div className="space-y-5">
          <Card title="Customer">
            <CustomerCell
              name={request.customerName}
              email={request.customerEmail}
            />
            <dl className="mt-4 space-y-2 text-[13px]">
              <Row
                label="Customer code"
                value={request.customerCode || "—"}
                mono
              />
              <Row label="Submitted by" value={request.userName || "—"} />
              <Row label="Order" value={request.orderNumber} mono />
              <Row label="Order date" value={formatDate(request.orderDate)} />
            </dl>
          </Card>

          <Card title="History">
            {history.length === 0 ? (
              <p className="text-[13px] text-[#6b6b73]">No history recorded.</p>
            ) : (
              <ol className="space-y-3">
                {history.map((entry, index) => (
                  <li
                    key={`${entry.label}-${entry.at}-${index}`}
                    className="gap-3 [display:flex]"
                  >
                    <span
                      className={cx(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        index === 0 ? "bg-[#5b3df5]" : "bg-[#dcdcd6]",
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[#18181b]">
                        {entry.label}
                      </div>
                      <div className="text-[12px] text-[#6b6b73]">
                        {formatDateTime(entry.at)}
                        {entry.by
                          ? ` · ${entry.by}`
                          : entry.label === HISTORY_INFO_PROVIDED
                            ? " · customer"
                            : ""}
                      </div>
                      {entry.message && (
                        <div className="mt-1 rounded-[7px] bg-[#f6f6f4] px-2.5 py-1.5 text-[12.5px] text-[#3f3f46]">
                          {entry.message}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      {preview && (
        <Lightbox
          src={preview.src}
          alt={`Return photo for ${preview.label}`}
          caption={preview.label}
          onClose={() => setPreview(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Delete ${request.requestId}?`}
          description={
            <>
              This permanently removes the request, its {photos.length} photo
              {photos.length === 1 ? "" : "s"} and {notes.length} internal note
              {notes.length === 1 ? "" : "s"}. The customer will no longer see
              it under My Returns, and the order becomes eligible for a new
              return. This cannot be undone.
            </>
          }
          confirmLabel="Delete permanently"
          confirmText={request.requestId}
          busy={deleting}
          onConfirm={() => void remove()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {prompt && (
        <MessageModal
          title={
            prompt === "reject"
              ? "Reject this return"
              : "Request more information"
          }
          description={
            prompt === "reject"
              ? "Tell the customer why the return cannot be accepted. This closes the request."
              : "Tell the customer what you need from them. The request stays open until you approve or reject it."
          }
          confirmLabel={prompt === "reject" ? "Reject return" : "Send request"}
          danger={prompt === "reject"}
          busy={pending !== null}
          onConfirm={(message) => void run(prompt, message)}
          onCancel={() => setPrompt(null)}
        />
      )}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cx(BUTTON_LINK, "mb-4")}>
      <IconArrowLeft />
      All returns
    </button>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="justify-between gap-3 [display:flex]">
      <dt className="text-[#6b6b73]">{label}</dt>
      <dd
        className={cx(
          "text-right text-[#18181b]",
          mono && "font-mono text-[12.5px]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function NotesPanel({
  notes,
  onAdd,
}: {
  notes: InternalNote[];
  onAdd: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onAdd(text);
      setText("");
    } catch (e: any) {
      setError(e?.message ?? "The note could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Internal notes">
      <p className="mb-3 text-[12px] text-[#6b6b73]">
        Visible to store admins only — never shown to the customer.
      </p>
      {notes.length > 0 && (
        <ul className="mb-4 space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-[7px] border border-[#ebebe7] bg-[#f6f6f4] px-3 py-2.5"
            >
              <div className="text-[13px] whitespace-pre-wrap text-[#18181b]">
                {note.text}
              </div>
              <div className="mt-1 text-[11.5px] text-[#6b6b73]">
                {note.authorName || "Admin"}
                {note.createdAtIso
                  ? ` · ${formatDateTime(note.createdAtIso)}`
                  : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="items-start gap-2 [display:flex]">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add an internal note…"
          className={INPUT}
          disabled={saving}
        />
        <button
          type="submit"
          disabled={saving || !text.trim()}
          className={BUTTON_SECONDARY}
        >
          {saving ? "Adding…" : "Add"}
        </button>
      </form>
      {error && (
        <div className="mt-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </Card>
  );
}
