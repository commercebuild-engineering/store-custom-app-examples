# Customer Return — remote backend

The same customer-returns experience as the front-end-only "Customer Return"
app, with every piece of returns logic, data and email moved to a remote
service. The pages (storefront Orders / Returns, admin Returns / Settings) are
ordinary extension pages; all their data goes through one backend connection:

```json
{ "name": "returns", "provider": "backend", "scope": "app",
  "forwardPlatformToken": true,
  "config": { "baseUrl": "https://<service>/api" } }
```

`src/shared/returns-store.ts` is the only module that talks to the service
(`cb.utils.useBackend("returns")`). The browser never calls the service
directly: the storefront proxies every call and adds a 60-second token for the
signed-in user (`authorization: Bearer …`, verified by the service against the
storefront issuer's JWKS) plus the user's platform token
(`x-cb-platform-token`), which the service uses to read the order as that user.

`config.development.json` points the editor preview at a service running on
`http://localhost:4000/api`.

Setup and deployment of the service, and how to connect this app to it, are
in the [example README](../README.md).

## Service API (paths relative to `baseUrl`)

All bodies are JSON. Writes carry an `Idempotency-Key` header. Shopper routes
are scoped to the caller's customer (`cb_user_customer_code`, or the user when
there is none); admin routes need `cb_user_role = "admin"` and are scoped to
`cb_store_id`.

| Method | Path | Who | Body / query | Answer |
| --- | --- | --- | --- | --- |
| GET | `returns/mine` | shopper | | `{ items: Return[] }` newest first |
| POST | `returns` | shopper | `{ orderNumber, comment, locale, items: [{ sequence, returnQty, reason }] }` | `{ requestId }` |
| GET | `returns/{requestId}` | owner or admin | | `Return` (404 when not visible) |
| GET | `returns/{requestId}/photos` | owner or admin | | `{ items: Photo[] }` |
| POST | `returns/{requestId}/photos` | owner | `{ lineSequence, dataUrl, mimeType, source }` | `{ id }` |
| POST | `returns/{requestId}/info-response` | owner | `{ message }` | `{}` — 409 `{ error: "stale", current }` unless Info Requested |
| GET | `returns` | admin | `?status=&pageSize=&cursor=` | `{ items: Return[], cursor }` |
| GET | `returns/counts` | admin | | `{ "": total, [status]: n }` |
| GET | `returns/search` | admin | `?q=` (request #, order #, customer code) | `{ items: Return[] }` |
| POST | `returns/{requestId}/actions` | admin | `{ action, by, message? }` | `{ rma }` — 409 stale |
| POST | `returns/{requestId}/review` | admin | `{ by }` | `{}` (Requested → Under Review; no-op otherwise) |
| DELETE | `returns/{requestId}` | admin | | `{}` |
| GET / POST | `returns/{requestId}/notes` | admin | `{ text, authorName }` | `{ items: Note[] }` / `{ id }` |
| GET | `settings` | any signed-in | | `{ returnWindowDays?, maxPhotosPerLine?, returnReasons? }` |
| PUT | `settings` | admin | partial settings | `{}` |

`Return`: `{ requestId, orderNumber, orderDate, currencyCode, customerCode,
userId, status, statusHistory: [{ label, at, by?, message? }], rma, comment,
itemCount, estimatedCredit, items: [{ sequence, itemCode, displayItemCode,
itemDesc, uom, unitPrice, purchasedQty, returnQty, reason, photoCount }],
createdAt, updatedAt }` — no customer names or email addresses. `Photo`:
`{ id, lineSequence, itemCode, dataUrl, source, createdAtIso }`. `Note`:
`{ id, text, authorName, authorEmail, createdAtIso }`.

Statuses and transitions are those of `src/shared/constants.ts` and
`src/shared/transitions.ts`; the service enforces the same table.
