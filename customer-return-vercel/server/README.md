# Customer Return service

The backend of the Customer Return example: every piece of returns logic,
data and email lives here, while the screens are an ordinary commercebuild
custom app. Setup, deployment and environment variables are in the
[example README](../README.md); this file describes the service itself.

Next.js route handlers (one catch-all route), plain SQL through `postgres`,
`@commercebuild/app-server` for request verification,
`@commercebuild/platform-api` for platform calls, Resend for email.

## How a request is trusted

- `authorization: Bearer <token>`: signed by the storefront's OIDC issuer for
  each forwarded request. `@commercebuild/app-server` verifies it against
  `${CB_ISSUER}/api/oidc/jwks`: signature, issuer, audience
  (`SERVICE_ORIGIN`), expiry, RS256, and the `typ` header only the
  storefront's backend proxy signs (its Firebase and Supabase tokens are
  refused). Claims used: `cb_store_id` (every query is scoped by it),
  `cb_user_id`, `cb_user_role` (`admin` → admin routes),
  `cb_user_customer_code` (shoppers see their customer's returns),
  `cb_app_id` and `cb_storefront_url` (links in emails), `cb_platform_url`.
- `x-cb-platform-token`: the user's own platform access token, present when
  the app's connection sets `forwardPlatformToken`. Used only within the
  request, to read the order being returned and email addresses; never
  stored or logged.
- `Idempotency-Key`: required on every write except `PUT settings`. A repeat
  returns the first answer, so a retried request never applies twice. Emails
  are sent after the change is committed and never fail the request: a
  failure there would release the key and let a retry duplicate the change.

## Data

Postgres, schema in `migrations/`. Every row carries the store id. No
customer names, email addresses or postal addresses are stored; addresses
are read from the platform when an email is sent. Line snapshots (item,
quantity, unit price) are taken from the order the platform returns, never
from the browser.

Lifecycle: Requested → Under Review → (Info Requested) → Approved · RMA
Issued → Received → Inspected → Credited, or Rejected. Each transition is one
guarded update; the RMA number is issued in the same transaction as the
approval. Creating a return holds a per-order lock, so two concurrent
requests cannot both claim the same remaining quantity.

## API

Paths are relative to the connection's `baseUrl` (`${SERVICE_ORIGIN}/api`).
All bodies are JSON. Shopper routes are scoped to the caller's customer
(`cb_user_customer_code`, or the user when there is none); admin routes need
`cb_user_role = "admin"` and are scoped to `cb_store_id`.

| Method | Path | Who | Body / query | Answer |
| --- | --- | --- | --- | --- |
| GET | `returns/mine` | shopper | | `{ items: Return[] }` newest first |
| POST | `returns` | shopper | `{ orderNumber, comment, locale, items: [{ sequence, returnQty, reason }] }` | `{ requestId }` |
| GET | `returns/{requestId}` | owner or admin | | `Return` (404 when not visible) |
| GET | `returns/{requestId}/photos` | owner or admin | | `{ items: Photo[] }` |
| POST | `returns/{requestId}/photos` | owner | `{ lineSequence, dataUrl, mimeType, source }` | `{ id }` |
| POST | `returns/{requestId}/info-response` | owner | `{ message }` | `{}`; 409 `{ error: "stale", current }` unless Info Requested |
| GET | `returns` | admin | `?status=&pageSize=&cursor=` | `{ items: Return[], cursor }` |
| GET | `returns/counts` | admin | | `{ "": total, [status]: n }` |
| GET | `returns/search` | admin | `?q=` (request #, order #, customer code) | `{ items: Return[] }` |
| POST | `returns/{requestId}/actions` | admin | `{ action, by, message? }` | `{ rma }`; 409 stale |
| POST | `returns/{requestId}/review` | admin | `{ by }` | `{}` (Requested → Under Review; no-op otherwise) |
| DELETE | `returns/{requestId}` | admin | | `{}` |
| GET / POST | `returns/{requestId}/notes` | admin | `{ text, authorName }` | `{ items: Note[] }` / `{ id }` |
| GET | `settings` | any signed-in | | `{ returnWindowDays?, maxPhotosPerLine?, returnReasons? }` |
| PUT | `settings` | admin | partial settings | `{}` |

`Return`: `{ requestId, orderNumber, orderDate, currencyCode, customerCode,
userId, status, statusHistory: [{ label, at, by?, message? }], rma, comment,
itemCount, estimatedCredit, items: [{ sequence, itemCode, displayItemCode,
itemDesc, uom, unitPrice, purchasedQty, returnQty, reason, photoCount }],
createdAt, updatedAt }`. `Photo`: `{ id, lineSequence, itemCode, dataUrl,
source, createdAtIso }`. `Note`: `{ id, text, authorName, createdAtIso }`.

Errors are `{ error, message, …extra }` with the HTTP status: 400
`bad_request`, 401 `unauthorized`, 403 `forbidden`, 404 `not_found`, 409
`stale` / `in_progress`, 422 `unprocessable`, 502 `platform_error`, 503
`unavailable` / `platform_unavailable`.

## Layout

```
src/app/api/[...path]/route.ts   the route table; authentication and idempotency per request
src/lib/auth.ts                  @commercebuild/app-server wrapper → Caller
src/lib/platform.ts              platform reads as the caller (order, email addresses)
src/lib/returns/service.ts       returns logic, visibility rules, email
src/lib/returns/lifecycle.ts     statuses and allowed transitions
src/lib/returns/settings.ts      per-store settings
src/lib/idempotency.ts           Idempotency-Key handling
src/lib/email.ts                 Resend
migrations/                      schema, applied by scripts/migrate.mts
test/api.test.ts                 end-to-end tests: real Postgres, real token signing, stubbed platform
```

## Scripts

```sh
npm run dev          # http://localhost:4000/api
npm test             # needs the returns_test database (see the example README)
npm run type-check
npm run migrate      # applies migrations/*.sql to DATABASE_URL, each once
npm run build
```
