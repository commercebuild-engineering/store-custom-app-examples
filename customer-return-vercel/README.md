# commercebuild custom app examples

A worked example of a commercebuild custom app whose data, business logic and
email live on a remote backend: a customer-returns module. The screens are an
ordinary custom app; the returns themselves are owned by a small service on
Vercel with a Postgres database on Supabase.

| Directory | What it is |
| --------- | ---------- |
| `app/`    | The custom app: storefront pages (Orders, Returns) and Store Admin pages (Returns, Settings). |
| `server/` | The returns service: Next.js route handlers on Vercel, Postgres on Supabase, email through Resend. |

Commands below run from this directory (`customer-return-vercel/`).

## How it works

```
custom app page            commercebuild storefront              server/ (Vercel)              commercebuild platform API
useBackend("returns")  ──> /api/ext/{appId}/backend/returns ──> verifies the token,       ──> reads the order AS the
  .fetch("returns")        signs a 60 s token for the          owns the returns data,        shopper, with the token
                           signed-in user, forwards the        sends email                   the storefront forwarded
                           user's platform token
```

The browser never calls the service. The app declares the service as a
`backend` connection in `config.json`, and calls it with
`cb.utils.useBackend("returns").fetch(path)`. Every call goes to a storefront
route, which:

1. checks the user is signed in and the app is installed on the store;
2. signs a 60-second RS256 token for that user (`Authorization: Bearer …`),
   with the service's origin as its audience and the JWT header
   `typ: cb-backend+jwt`;
3. when the connection sets `forwardPlatformToken`, adds the user's own
   platform access token (`x-cb-platform-token`);
4. forwards the request to `{baseUrl}/{path}`.

The service verifies the token with
[`@commercebuild/app-server`](https://www.npmjs.com/package/@commercebuild/app-server)
and learns who is calling (store, user, role, customer) from its claims. When
it needs platform data, such as the order being returned, it calls the
platform API as that user with the forwarded token, which is used only within
the request and never stored.

## Prerequisites

- Node.js 22 or later and npm.
- A commercebuild V5 store where you can create custom apps (Store Admin →
  Settings → Apps).
- A [Vercel](https://vercel.com) account and a [Supabase](https://supabase.com)
  account. Both free tiers are enough for this example.
- Optional: a [Resend](https://resend.com) account for email. Without it the
  service logs the emails it would send.

## Step 1: Create the database (Supabase)

Supabase hosts a Postgres database, and that database is all the service
uses: it connects with the `postgres` npm package and runs plain SQL. None of
Supabase's own client SDK or Data API is involved, which is why the same code
runs against a local Postgres in Docker.

1. In Supabase, create a project.
2. Open **Project Settings → Database** (or the **Connect** button) and copy
   the **Transaction pooler** connection string, port `6543`. This is your
   `DATABASE_URL`. The service runs on serverless functions, so it must use
   the pooler, not the direct connection.
3. Apply the schema once, from your machine:

   ```sh
   cd server
   npm install
   DATABASE_URL='postgres://…pooler.supabase.com:6543/postgres' npm run migrate
   ```

   `migrations/0001_init.sql` creates the tables. `0002_lock_down_data_api.sql`
   enables row level security and revokes the `anon` and `authenticated`
   roles: Supabase otherwise exposes every `public` table through its Data
   API to anyone holding the project's publishable key. The service connects
   as the table owner and is not affected.

## Step 2: Create the Vercel project

The service lives in the `server/` subdirectory of this example, so the
Vercel project's **Root Directory** must point there: `customer-return-vercel/server`,
relative to the repository root.

### Option A: import the Git repository

Needs your GitHub (or GitLab/Bitbucket) account connected to Vercel.

1. Vercel dashboard → **Add New… → Project** → import this repository.
2. **Root Directory**: click *Edit* and choose `customer-return-vercel/server`.
3. **Framework Preset**: Next.js (detected automatically).
4. Add the environment variables from Step 3, then **Deploy**.

Every push to the default branch then deploys production. To avoid a
rebuild when only `app/` changes, enable **Settings → Git → Ignored Build
Step** with the *Only build if there are changes in a folder* option.

### Option B: deploy from the command line

Works without a Git connection; every deploy is manual.

```sh
cd server
npx vercel            # first run: creates the project, accept the Next.js defaults
npx vercel --prod     # production deploy
```

Run the CLI from inside `server/` and leave the project's Root Directory
empty. The CLI uploads the directory it runs in, so the Root Directory setting
is only for Git-connected deploys.

### Project settings to check

- **Settings → Deployment Protection → Vercel Authentication**: turn it
  **off** for production. When it is on, Vercel answers the storefront's
  requests with a sign-in page instead of passing them to the service, and
  every call fails with 401.
- **Settings → General → Node.js Version**: 22.x.
- **Settings → Domains**: the production URL, `https://<project>.vercel.app`
  by default, is your `SERVICE_ORIGIN`.

## Step 3: Environment variables

Set these under **Settings → Environment Variables** for the Production
environment. Vercel applies them on the next deployment, so redeploy after
changing one.

| Variable             | Required | Value |
| -------------------- | -------- | ----- |
| `DATABASE_URL`       | yes      | The Supabase transaction-pooler URL from Step 1. |
| `CB_ISSUER`          | yes      | The storefront's OIDC issuer URL, no trailing slash. See below. |
| `SERVICE_ORIGIN`     | yes      | This deployment's public origin, e.g. `https://store-customer-return.vercel.app`. The token's audience; a mismatch is a 401. |
| `ADMIN_NOTIFY_EMAIL` | yes      | Where new-return notifications go. |
| `RESEND_API_KEY`     | no       | Unset: emails are written to the Vercel logs instead of sent. |
| `EMAIL_FROM`         | no       | Default `Returns <onboarding@resend.dev>`. Resend delivers from that address only to the Resend account owner; verify a domain to email anyone else. |
| `CB_JWKS_URL`        | no       | Local development only; see below. |
| `CB_PLATFORM_URL`    | no       | Local development only; see below. |

**Finding `CB_ISSUER`.** Open
`https://<your storefront>/.well-known/openid-configuration` in a browser.
The `issuer` field is the value. The same URL serves the keys the service
verifies tokens with, at `{issuer}/api/oidc/jwks`, so the issuer must be
reachable from the public internet.

## Step 4: Connect the app

In the custom app, declare the service in `config.json`:

```json
{
  "connections": [
    {
      "name": "returns",
      "provider": "backend",
      "scope": "app",
      "forwardPlatformToken": true,
      "config": { "baseUrl": "https://<project>.vercel.app/api" }
    }
  ]
}
```

- `baseUrl` is a prefix: every path the app requests is appended to it.
- `forwardPlatformToken` is what lets the service read the order as the
  shopper. Without it, creating a return answers
  `503 The order cannot be checked right now.`
- For the editor preview, the same entry in `config.development.json`
  overrides `baseUrl` (for example to `http://localhost:4000/api` while the
  service runs locally). That file is never deployed.

`app/config.json` already declares this connection; change `baseUrl` to your
deployment. To get the app onto your store, either create a custom app in
Store Admin (Settings → Apps) and paste the project in, or from `app/`:

```sh
npm install
npm run type-check
npm run save        # upload the project to the app's editor on your store
npm run release     # publish the uploaded build
```

The CLI asks for the store URL and your Store Admin sign-in the first time.
Then install the app on the store. The editor preview works before
publishing, for users with admin access.

## Step 5: Verify

1. As a shopper, open an order in the storefront and start a return. The
   return should appear in the shopper's returns list, and in Supabase
   (**Table Editor → returns**).
2. **Vercel → Deployments → the deployment → Logs** shows each request and
   the email outcome (`sent`, `logged`, `failed`, `skipped_no_address`).
3. As an admin, open the app's Returns page in Store Admin and approve the
   return. The RMA number is issued at that point.

What the common failures mean:

| Symptom | Cause |
| ------- | ----- |
| Every call fails with 401 | `CB_ISSUER` or `SERVICE_ORIGIN` does not match the token, or Deployment Protection is on. |
| 503 `platform_unavailable`, "The order cannot be checked right now." | The app's connection does not set `forwardPlatformToken: true`, or the installed version predates that change. |
| 503 `unavailable`, "Try again shortly." | The service could not fetch the issuer's keys: `CB_ISSUER` is not reachable from Vercel. |
| Email `failed: 403` in the logs | Resend refuses the recipient. Without a verified domain it delivers only to the account owner's address. |

## Local development

```sh
docker run -d --name returns-postgres-local -e POSTGRES_USER=returns \
  -e POSTGRES_PASSWORD=returns -e POSTGRES_DB=returns -p 54329:5432 postgres:17-alpine
docker exec returns-postgres-local createdb -U returns returns_test   # for the tests

cd server
cp .env.example .env.local      # set CB_ISSUER to your storefront's issuer
npm install
npm run migrate                 # uses DATABASE_URL from .env.local
npm run dev                     # http://localhost:4000/api
npm test                        # against returns_test
```

Point the app's `config.development.json` at `http://localhost:4000/api` and
use the editor preview.

### Testing a deployed service against a local storefront

A service on Vercel must fetch the issuer's keys and call the platform over
the public internet. When the storefront and platform run on your machine,
expose them with temporary tunnels (for example `cloudflared tunnel --url
http://localhost:3333`) and set, on the Vercel project:

- `CB_JWKS_URL` = the storefront tunnel + `/api/oidc/jwks`, so the keys can
  be fetched while `CB_ISSUER` stays the value the local storefront signs
  with;
- `CB_PLATFORM_URL` = the platform tunnel, overriding the platform URL the
  token names.

Remove both once you move to a hosted storefront, and stop the tunnels after
testing: they expose your local services publicly.

## Updating the service

- Git-connected project: push to the default branch.
- CLI: `cd server && npx vercel --prod`.

Schema changes go in a new `migrations/000N_*.sql` and are applied with
`npm run migrate` against the production `DATABASE_URL` before the deploy.
Each migration runs once; the service records them in `schema_migrations`.
