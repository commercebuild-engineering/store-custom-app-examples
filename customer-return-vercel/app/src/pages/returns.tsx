import React, { useEffect, useMemo, useState } from "react";

import { STATUS_INFO_REQUESTED, STATUS_REJECTED } from "../shared/constants";
import { useReturnsSettings, type ReturnsSettings } from "../shared/settings";
import { InfoResponsePanel } from "../components/info-response-panel";
import { formatDate, formatMoney } from "../lib/format";
import { goToPage, pagePath } from "../lib/nav";
import {
  listPhotos,
  listReturnsForCustomer,
  useReturnsDb,
  type ReturnRequest,
  type StoredPhoto,
} from "../shared/returns-store";
import { useIdentity } from "../lib/use-identity";
import { StatusPill } from "../components/status-pill";
import { Lightbox } from "../shared/ui-lightbox";
import { Timeline } from "../components/timeline";
import {
  DataNotConfigured,
  Empty,
  ErrorBox,
  Loading,
} from "../components/notices";

export const metadata = { title: "My Returns" };

/** Deep link support: /page/ReturnsPage?id=RET-1001 opens that request. */
function requestIdFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("id") ?? "";
}

export default function ReturnsPage() {
  const [selectedId, setSelectedId] = useState(requestIdFromUrl);
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** Bumped after the customer replies so the request is re-read. */
  const [version, setVersion] = useState(0);

  const {
    identity,
    loading: identityLoading,
    error: identityError,
  } = useIdentity();
  const db = useReturnsDb();
  const customerCode = identity?.customerCode ?? "";
  const { settings } = useReturnsSettings(db);

  useEffect(() => {
    let active = true;
    if (identityLoading) return;
    if (!db || !customerCode) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const result = await listReturnsForCustomer(db, customerCode);
        if (active) setRequests(result);
      } catch (e: any) {
        if (active) setError(e?.message ?? "Could not load your returns.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [db, customerCode, identityLoading, version]);

  const selected = useMemo(
    () => requests.find((request) => request.requestId === selectedId) ?? null,
    [requests, selectedId],
  );

  /** Keeps the URL shareable without re-mounting the page. */
  const select = (requestId: string) => {
    setSelectedId(requestId);
    window.history.replaceState(
      null,
      "",
      requestId
        ? pagePath("ReturnsPage", `id=${encodeURIComponent(requestId)}`)
        : pagePath("ReturnsPage"),
    );
  };

  if (identityLoading || loading) return <Loading label="Loading returns…" />;

  return (
    <Shell>
      {identityError && <ErrorBox message={identityError} />}
      {!db && <DataNotConfigured />}
      {error && <ErrorBox message={error} />}

      {db &&
        !error &&
        (selected ? (
          <ReturnDetail
            db={db}
            request={selected}
            settings={settings}
            onBack={() => select("")}
            onChanged={() => setVersion((current) => current + 1)}
          />
        ) : (
          <ReturnList requests={requests} onSelect={select} />
        ))}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-10">{children}</div>;
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
/* My returns                                                          */
/* ------------------------------------------------------------------ */

function ReturnList({
  requests,
  onSelect,
}: {
  requests: ReturnRequest[];
  onSelect: (requestId: string) => void;
}) {
  return (
    <>
      <BackLink
        label="← Back to orders"
        onClick={() => goToPage("OrdersPage")}
      />
      <h1 className="text-2xl font-bold tracking-tight">My returns</h1>
      <p className="mt-1 mb-6 text-sm opacity-70">
        Track the status of your return requests.
      </p>

      {requests.length === 0 ? (
        <Empty message="You have not requested any returns yet." />
      ) : (
        <div className="w-full overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase opacity-70">
              <tr>
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-right">Credit</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr
                  key={request.docId}
                  onClick={() => onSelect(request.requestId)}
                  className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50"
                >
                  <td className="px-4 py-3 font-semibold underline">
                    {request.requestId}
                  </td>
                  <td className="px-4 py-3 opacity-80">
                    {request.orderNumber}
                  </td>
                  <td className="px-4 py-3 opacity-80">
                    {formatDate(request.createdAtIso)}
                  </td>
                  <td className="px-4 py-3 text-center opacity-80">
                    {request.itemCount}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatMoney(request.estimatedCredit, request.currencyCode)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={request.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Return detail                                                       */
/* ------------------------------------------------------------------ */

function ReturnDetail({
  db,
  request,
  settings,
  onBack,
  onChanged,
}: {
  db: NonNullable<ReturnType<typeof useReturnsDb>>;
  request: ReturnRequest;
  settings: ReturnsSettings;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [preview, setPreview] = useState<{ src: string; label: string } | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await listPhotos(db, request.docId);
        if (active) setPhotos(result);
      } catch {
        // Photos are supplementary — the request still renders without them.
      }
    })();
    return () => {
      active = false;
    };
  }, [db, request.docId, request.updatedAtIso]);

  // The admin's note for the CURRENT state (Info Requested / Rejected) —
  // surfaced above the items so the customer sees what is being asked.
  const latestMessage = useMemo(() => {
    if (
      request.status !== STATUS_INFO_REQUESTED &&
      request.status !== STATUS_REJECTED
    ) {
      return "";
    }
    const entries = request.statusHistory.filter(
      (entry) => entry.label === request.status && entry.message,
    );
    return entries[entries.length - 1]?.message ?? "";
  }, [request.status, request.statusHistory]);

  const photosByLine = useMemo(() => {
    const map = new Map<number, StoredPhoto[]>();
    for (const photo of photos) {
      const list = map.get(photo.lineSequence) ?? [];
      list.push(photo);
      map.set(photo.lineSequence, list);
    }
    return map;
  }, [photos]);

  return (
    <>
      <BackLink label="← Back to my returns" onClick={onBack} />
      <div className="items-center gap-3 [display:flex] [flex-wrap:wrap]">
        <h1 className="text-2xl font-bold tracking-tight">
          {request.requestId}
        </h1>
        <StatusPill status={request.status} />
      </div>
      <p className="mt-1 mb-6 text-sm opacity-70">
        Order {request.orderNumber} · requested{" "}
        {formatDate(request.createdAtIso)}
        {request.rma ? ` · RMA ${request.rma}` : ""}
      </p>

      {request.status === STATUS_INFO_REQUESTED ? (
        <InfoResponsePanel
          db={db}
          request={request}
          settings={settings}
          adminMessage={latestMessage || "Please provide more details."}
          onSubmitted={onChanged}
        />
      ) : (
        latestMessage && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span className="font-semibold">Reason: </span>
            {latestMessage}
          </div>
        )
      )}

      <div className="gap-6 [display:grid] [grid-template-columns:1fr] md:[grid-template-columns:1fr_300px]">
        <div>
          <div className="w-full overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase opacity-70">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Photos</th>
                </tr>
              </thead>
              <tbody>
                {request.items.map((item) => (
                  <tr
                    key={`${item.sequence}-${item.itemCode}`}
                    className="border-t border-zinc-100"
                  >
                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold">{item.itemDesc}</div>
                      <div className="text-xs opacity-70">
                        {item.displayItemCode || item.itemCode}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center align-top opacity-80">
                      {item.returnQty}
                    </td>
                    <td className="px-4 py-3 align-top opacity-80">
                      {item.reason}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="items-center gap-2 [display:flex] [flex-wrap:wrap]">
                        {(photosByLine.get(item.sequence) ?? []).map(
                          (photo) => (
                            <button
                              key={photo.id}
                              type="button"
                              className="cursor-zoom-in"
                              title="View photo"
                              onClick={() =>
                                setPreview({
                                  src: photo.dataUrl,
                                  label: item.itemDesc,
                                })
                              }
                            >
                              <img
                                src={photo.dataUrl}
                                alt={`Return photo for ${item.itemDesc}`}
                                className="size-12 rounded-md border border-zinc-200 object-cover"
                              />
                            </button>
                          ),
                        )}
                        {(photosByLine.get(item.sequence) ?? []).length ===
                          0 && <span className="text-xs opacity-40">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {request.comment && (
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="mb-1 text-xs font-semibold uppercase opacity-70">
                Your comments
              </div>
              <p className="text-sm opacity-90">{request.comment}</p>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 p-4">
          <div className="mb-4 text-sm font-bold">Progress</div>
          <Timeline history={request.statusHistory} rma={request.rma} />
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
    </>
  );
}
