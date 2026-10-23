/**
 * Every read and write the app makes — all of them calls to the returns
 * service, the app's own backend (the `returns` backend connection in
 * config.json). The browser never talks to the service directly: the host
 * proxies each call through the storefront, which adds a short-lived token
 * for the signed-in user. The service decides what that user may see and do
 * (shoppers: their customer's returns; admins: the whole store), so nothing
 * here filters by store or customer itself.
 *
 * The service stores no customer names or email addresses: `customerName`
 * falls back to the customer code and `customerEmail` is empty.
 */
import { HISTORY_INFO_PROVIDED, STATUS_REQUESTED } from "./constants";
import type { ReturnPhoto } from "./image";
import type { ReturnAction } from "./transitions";

/** The client for the returns service — see useReturnsDb. */
export type ReturnsApi = NonNullable<ReturnType<typeof cb.utils.useBackend>>;

/** Upper bound on one admin search. */
export const ADMIN_SEARCH_LIMIT = 50;

export interface ReturnItem {
  sequence: number;
  itemCode: string;
  displayItemCode: string;
  itemDesc: string;
  uom: string;
  unitPrice: number;
  purchasedQty: number;
  returnQty: number;
  reason: string;
  photoCount: number;
}

export interface StatusEntry {
  label: string;
  at: string;
  /** Admin who made the change (absent on the customer's own "Requested"). */
  by?: string;
  /** Customer-visible note (Info Requested / Rejected / Info Provided). */
  message?: string;
}

export interface InternalNote {
  id: string;
  text: string;
  authorName: string;
  authorEmail: string;
  createdAtIso: string;
}

/** Thrown when a transition finds the request no longer in an allowed state. */
export class StaleStatusError extends Error {
  constructor(public readonly current: string) {
    super(`This return is now "${current}" — the action no longer applies.`);
    this.name = "StaleStatusError";
  }
}

export interface ReturnRequest {
  /** Same as requestId — kept for the pages' keys. */
  docId: string;
  requestId: string;
  orderNumber: string;
  orderDate: string;
  currencyCode: string;
  customerCode: string;
  customerName: string;
  customerEmail: string;
  /** Platform id of the user who submitted it. */
  userId: number | null;
  userName: string;
  status: string;
  statusHistory: StatusEntry[];
  rma: string | null;
  comment: string;
  itemCount: number;
  estimatedCredit: number;
  items: ReturnItem[];
  createdAtIso: string;
  updatedAtIso: string;
}

/** Who attached a photo: the original request, or a later customer reply. */
export type PhotoSource = "request" | "customer-response";

export interface StoredPhoto {
  id: string;
  lineSequence: number;
  itemCode: string;
  dataUrl: string;
  source: PhotoSource;
  createdAtIso: string;
}

export interface NewReturnRequest {
  orderNumber: string;
  orderDate: string;
  currencyCode: string;
  customerCode: string;
  customerName: string;
  customerEmail: string;
  userId: number | null;
  userName: string;
  comment: string;
  items: ReturnItem[];
  /** Photos keyed by the line sequence they belong to. */
  photosByLine: Record<number, ReturnPhoto[]>;
}

/**
 * The returns service client for this app, or undefined when the backend
 * connection is not configured (render a fallback, never crash).
 */
export function useReturnsDb(): ReturnsApi | undefined {
  return cb.utils.useBackend("returns");
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

/** A non-2xx answer from the service (or the storefront in front of it). */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * One call to the service. JSON in and out; writes carry an
 * Idempotency-Key so a retried request can never apply twice. A 409 with
 * `{ error: "stale", current }` becomes a StaleStatusError.
 */
async function call<T>(
  api: ReturnsApi,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = init.method ?? "GET";
  const headers: Record<string, string> = { accept: "application/json" };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (method !== "GET") headers["idempotency-key"] = newIdempotencyKey();
  const res = await api.fetch(path, {
    method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 409 && data?.error === "stale") {
      throw new StaleStatusError(String(data.current ?? ""));
    }
    if (res.status === 401) {
      throw new ServiceError("Please sign in again to continue.", 401);
    }
    throw new ServiceError(
      typeof data?.message === "string"
        ? data.message
        : `The returns service answered ${res.status}.`,
      res.status,
    );
  }
  return data as T;
}

function encode(segment: string): string {
  return encodeURIComponent(segment);
}

function mapReturn(data: any): ReturnRequest {
  const requestId = String(data?.requestId ?? "");
  return {
    docId: requestId,
    requestId,
    orderNumber: String(data?.orderNumber ?? ""),
    orderDate: String(data?.orderDate ?? ""),
    currencyCode: String(data?.currencyCode ?? ""),
    customerCode: String(data?.customerCode ?? ""),
    customerName: String(data?.customerCode ?? ""),
    customerEmail: "",
    userId: typeof data?.userId === "number" ? data.userId : null,
    userName: typeof data?.userId === "number" ? `User #${data.userId}` : "",
    status: String(data?.status ?? STATUS_REQUESTED),
    statusHistory: Array.isArray(data?.statusHistory)
      ? data.statusHistory.map((entry: any) => ({
          label: String(entry?.label ?? ""),
          at: String(entry?.at ?? ""),
          ...(entry?.by ? { by: String(entry.by) } : {}),
          ...(entry?.message ? { message: String(entry.message) } : {}),
        }))
      : [],
    rma: data?.rma ?? null,
    comment: String(data?.comment ?? ""),
    itemCount: Number(data?.itemCount ?? 0),
    estimatedCredit: Number(data?.estimatedCredit ?? 0),
    items: Array.isArray(data?.items) ? data.items : [],
    createdAtIso: String(data?.createdAt ?? ""),
    updatedAtIso: String(data?.updatedAt ?? ""),
  };
}

/* ------------------------------------------------------------------ */
/* Admin reads                                                         */
/* ------------------------------------------------------------------ */

export interface ReturnsPage {
  items: ReturnRequest[];
  /** Cursor for the next page; null when this is the last one. */
  cursor: string | null;
}

/** One page of requests, newest first, optionally limited to a status. */
export async function fetchReturnsPage(
  db: ReturnsApi,
  options: { status?: string; pageSize: number; after?: string | null },
): Promise<ReturnsPage> {
  const params = new URLSearchParams({ pageSize: String(options.pageSize) });
  if (options.status) params.set("status", options.status);
  if (options.after) params.set("cursor", options.after);
  const data = await call<{ items: unknown[]; cursor: string | null }>(
    db,
    `returns?${params}`,
  );
  return {
    items: (data.items ?? []).map(mapReturn),
    cursor: data.cursor ?? null,
  };
}

/** Request counts per status (plus "" for all). */
export async function countReturnsByStatus(
  db: ReturnsApi,
): Promise<Record<string, number>> {
  return call<Record<string, number>>(db, "returns/counts");
}

/** Admin search on request #, order # or customer code. */
export async function searchReturns(
  db: ReturnsApi,
  term: string,
): Promise<ReturnRequest[]> {
  const raw = term.trim();
  if (!raw) return [];
  const data = await call<{ items: unknown[] }>(
    db,
    `returns/search?${new URLSearchParams({ q: raw })}`,
  );
  return (data.items ?? []).map(mapReturn);
}

/** Deep-link lookup by request id (admin: any request of the store). */
export async function findReturnByRequestId(
  db: ReturnsApi,
  requestId: string,
): Promise<ReturnRequest | null> {
  try {
    return mapReturn(await call(db, `returns/${encode(requestId.trim())}`));
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) return null;
    throw error;
  }
}

/** How often an open request detail re-reads itself. */
const REFRESH_MS = 15_000;

/**
 * Keeps one request fresh: reads it now and every REFRESH_MS while the view
 * is open, so another admin's change shows up without a manual reload.
 */
export function subscribeReturn(
  db: ReturnsApi,
  docId: string,
  onData: (request: ReturnRequest | null) => void,
  onError: (error: Error) => void,
): () => void {
  let active = true;
  const read = async () => {
    try {
      const request = await findReturnByRequestId(db, docId);
      if (active) onData(request);
    } catch (error) {
      if (active) onError(error as Error);
    }
  };
  void read();
  const timer = setInterval(read, REFRESH_MS);
  return () => {
    active = false;
    clearInterval(timer);
  };
}

/* ------------------------------------------------------------------ */
/* Admin transitions                                                   */
/* ------------------------------------------------------------------ */

export interface TransitionOptions {
  /** Who is making the change — recorded on the history entry. */
  by: string;
  /** Customer-visible note; required by the UI for Info Requested / Rejected. */
  message?: string;
}

/**
 * Apply one lifecycle action. The service re-checks the current status
 * (StaleStatusError when it has moved on) and mints the RMA on approval.
 * Resolves to the RMA number for "approve", otherwise to null.
 */
export async function applyReturnAction(
  db: ReturnsApi,
  docId: string,
  action: ReturnAction,
  options: TransitionOptions,
): Promise<string | null> {
  const data = await call<{ rma: string | null }>(
    db,
    `returns/${encode(docId)}/actions`,
    {
      method: "POST",
      body: {
        action,
        by: options.by,
        ...(options.message?.trim() ? { message: options.message.trim() } : {}),
      },
    },
  );
  return data?.rma ?? null;
}

/** Requested → Under Review when an admin first opens a request. */
export async function markUnderReview(
  db: ReturnsApi,
  docId: string,
  by: string,
): Promise<void> {
  await call(db, `returns/${encode(docId)}/review`, {
    method: "POST",
    body: { by },
  });
}

/** Remove a request with its photos and notes, for good (admin only). */
export async function deleteReturnPermanently(
  db: ReturnsApi,
  docId: string,
): Promise<void> {
  await call(db, `returns/${encode(docId)}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/* Internal notes (admin only)                                         */
/* ------------------------------------------------------------------ */

export async function listNotes(
  db: ReturnsApi,
  docId: string,
): Promise<InternalNote[]> {
  const data = await call<{ items: InternalNote[] }>(
    db,
    `returns/${encode(docId)}/notes`,
  );
  return data.items ?? [];
}

export async function addNote(
  db: ReturnsApi,
  docId: string,
  input: { text: string; authorName: string; authorEmail: string },
): Promise<string> {
  const data = await call<{ id: string }>(
    db,
    `returns/${encode(docId)}/notes`,
    {
      method: "POST",
      body: { text: input.text.trim(), authorName: input.authorName },
    },
  );
  return data.id;
}

/* ------------------------------------------------------------------ */
/* Customer reads                                                      */
/* ------------------------------------------------------------------ */

/**
 * Every return of the signed-in customer, newest first. The service scopes
 * it by the user's token; `customerCode` is kept for the callers' shape.
 */
export async function listReturnsForCustomer(
  db: ReturnsApi,
  _customerCode: string,
): Promise<ReturnRequest[]> {
  const data = await call<{ items: unknown[] }>(db, "returns/mine");
  return (data.items ?? []).map(mapReturn);
}

export async function getReturnByRequestId(
  db: ReturnsApi,
  _customerCode: string,
  requestId: string,
): Promise<ReturnRequest | null> {
  return findReturnByRequestId(db, requestId);
}

export async function listPhotos(
  db: ReturnsApi,
  docId: string,
): Promise<StoredPhoto[]> {
  const data = await call<{ items: StoredPhoto[] }>(
    db,
    `returns/${encode(docId)}/photos`,
  );
  return data.items ?? [];
}

async function uploadPhoto(
  db: ReturnsApi,
  docId: string,
  photo: ReturnPhoto,
  lineSequence: number,
  source: PhotoSource,
): Promise<void> {
  await call(db, `returns/${encode(docId)}/photos`, {
    method: "POST",
    body: {
      lineSequence,
      dataUrl: photo.dataUrl,
      mimeType: photo.mimeType,
      source,
    },
  });
}

/* ------------------------------------------------------------------ */
/* Customer reply to "Info Requested"                                  */
/* ------------------------------------------------------------------ */

export interface InfoResponseInput {
  /** Optional free-text reply, shown to the admin in the history. */
  message: string;
  /** Extra photos keyed by the line they belong to. */
  photosByLine: Record<number, ReturnPhoto[]>;
  /** Item codes by line (the service knows them; kept for callers). */
  itemCodeByLine: Record<number, string>;
}

/**
 * The customer answers an admin's "Info Requested": the request goes back to
 * Under Review with an "Info Provided" history entry, then any new photos
 * are attached one by one.
 */
export async function submitInfoResponse(
  db: ReturnsApi,
  docId: string,
  input: InfoResponseInput,
): Promise<void> {
  await call(db, `returns/${encode(docId)}/info-response`, {
    method: "POST",
    body: { message: input.message.trim(), label: HISTORY_INFO_PROVIDED },
  });
  for (const [line, photos] of Object.entries(input.photosByLine)) {
    for (const photo of photos) {
      await uploadPhoto(db, docId, photo, Number(line), "customer-response");
    }
  }
}

/**
 * Creates the request — the service re-reads the order as the signed-in user,
 * checks every line and quantity, and assigns the request number — then
 * attaches the photos one by one. Resolves to the request id.
 */
export async function createReturnRequest(
  db: ReturnsApi,
  input: NewReturnRequest,
): Promise<string> {
  const created = await call<{ requestId: string }>(db, "returns", {
    method: "POST",
    body: {
      orderNumber: input.orderNumber,
      comment: input.comment,
      locale: currentLocale(),
      items: input.items.map((item) => ({
        sequence: item.sequence,
        returnQty: item.returnQty,
        reason: item.reason,
      })),
    },
  });
  for (const item of input.items) {
    for (const photo of input.photosByLine[item.sequence] ?? []) {
      await uploadPhoto(db, created.requestId, photo, item.sequence, "request");
    }
  }
  return created.requestId;
}

/** The storefront locale segment of the current URL, for email links. */
function currentLocale(): string {
  if (typeof window === "undefined") return "";
  const match = /\/([a-z]{2}(?:-[A-Z]{2})?)\/extension\//.exec(
    window.location.pathname,
  );
  return match?.[1] ?? "";
}
