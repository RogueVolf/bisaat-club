# Security notes

How the site is protected, as implemented. Phase 1 has no accounts, no payments and no public write path.

## Dependency audit

Run on 2026-11-27 against `package-lock.json`.

| Command | Before | After |
| --- | --- | --- |
| `npm audit --omit=dev` | found 0 vulnerabilities | unchanged (no change needed) |
| `npm audit` | found 0 vulnerabilities | unchanged (no change needed) |

No upgrades were required, so none were made. Nothing is left unresolved. Re-run both commands before each release; fix high or critical findings with `npm audit fix` (never `--force` without review).

## Database users

Two users on database `bisaat`, created by `docker/mongo-init/01-users.js` (runs only on a fresh data volume):

| User | Roles | Used by |
| --- | --- | --- |
| `bisaat_ro` | `read` on `bisaat` | The running site (`MONGODB_URI_READ`) |
| `bisaat_rw` | `readWrite` on `bisaat` plus custom role `bisaatSchemaMaintainer` (`collMod`, `createCollection`, `createIndex`, scoped to `bisaat`) | Seed script only (`MONGODB_URI_WRITE`) |

The site process never holds write credentials. The extra role lets the seed script create collections and apply validators without broader rights.

### Existing volumes and managed clusters

The init script does not re-run on an existing volume. On self-hosted MongoDB, apply the role by hand as an admin user in `mongosh` (placeholders, never commit real values). This snippet is self-hosted only; on Atlas, custom roles are created under Database Access instead:

```js
const appDb = db.getSiblingDB("bisaat");
appDb.createRole({
  role: "bisaatSchemaMaintainer",
  privileges: [{ resource: { db: "bisaat", collection: "" }, actions: ["collMod", "createCollection", "createIndex"] }],
  roles: [],
});
// If bisaat_rw already exists:
appDb.grantRolesToUser("bisaat_rw", [{ role: "bisaatSchemaMaintainer", db: "bisaat" }]);
// If the users do not exist yet:
appDb.createUser({ user: "bisaat_ro", pwd: "<RO_PASSWORD>", roles: [{ role: "read", db: "bisaat" }] });
appDb.createUser({
  user: "bisaat_rw",
  pwd: "<RW_PASSWORD>",
  roles: [{ role: "readWrite", db: "bisaat" }, { role: "bisaatSchemaMaintainer", db: "bisaat" }],
});
```

On Atlas, create the custom role and the same two users in Database Access (built-in `read` and `readWrite` on `bisaat`, plus the custom role). Use distinct strong passwords.

## Connection security

- `src/server/db/tls.ts`: when `NODE_ENV=production`, the URI must use TLS (`mongodb+srv://`, or `tls=true` / `ssl=true`). `tls=false`, `ssl=false`, `tlsInsecure=true`, `tlsAllowInvalidCertificates=true` and `tlsAllowInvalidHostnames=true` are rejected. The only exception is a plain `mongodb://` URI whose every host is loopback (`localhost`, `127.0.0.1`, `[::1]`), used for local Docker. The error message never contains the URI.
- `serverSelectionTimeoutMS` is 2000, so an unreachable database fails fast and the page serves the bundled content.
- Connection strings and passwords live only in environment variables. They are never logged and never reach the client bundle; all DB code is under `src/server/` and imports `server-only`.

### Network restriction

Restrict who can reach MongoDB in addition to credentials.

**Atlas with Vercel (the planned setup)**
- Vercel functions use dynamic outbound IPs. To allowlist, buy Vercel Static IPs (Pro or Enterprise, paid add-on) and add only those addresses to the Atlas Project IP Access List. Static IPs do not cover builds by default: a build that cannot reach Atlas prerenders `/opengraph-image` from the bundled content, and it refreshes from the database within 60 s at runtime.
- Without Static IPs, Atlas has to allow `0.0.0.0/0`. That leaves the database reachable from the internet, protected by TLS, SCRAM authentication with long random passwords, and the site holding only the read-only user. Acceptable while the database holds only public content; revisit before bookings and payments store personal data.
- Keep the write URI out of Vercel. Seed and edit from a trusted machine whose IP is added to the access list temporarily.
- The site uses `attachDatabasePool` from `@vercel/functions` with `maxIdleTimeMS: 5000`, so idle connections are closed before a function instance is suspended instead of piling up against the cluster's connection limit. Off Vercel it does nothing.

**Atlas on other hosts**
- Add the app hosts' egress IPs to the Project IP Access List (no `0.0.0.0/0`), or use a private endpoint / VPC peering.
- Use separate DB users as above. TLS is on by default; keep `mongodb+srv://`.
- Scope each user to the `bisaat` database only.

**Self-hosted**
- Bind `mongod` to a private interface (`net.bindIp`), not `0.0.0.0`. The bundled `docker-compose.yml` publishes only on `127.0.0.1`; remove or change that mapping deliberately.
- Firewall port 27017 so only the app hosts can connect.
- Enable TLS (`net.tls.mode: requireTLS`, server certificate and CA file) and use a certificate the app hosts trust. Enable authorization (`security.authorization: enabled`).

## Content integrity

- Collections `settings` (single document `_id: "site"`), `zones` and `prices` each have a strict `$jsonSchema` validator (`src/server/db/validators.ts`): required fields, `additionalProperties: false`, typed fields and enums (timezone, days, country, price unit), `validationLevel: strict`, `validationAction: error`. The seed script applies them with `createCollection` or `collMod`.
- Reads are validated again with zod on the way in (`src/server/content/repository.ts`) and on the way out of the API. Any key starting with `$` or containing `.` is rejected (`src/content/safe-keys.ts`).
- `getSiteContent()` is cached with `unstable_cache` (revalidate 60 s). On any failure, invalid content or empty collections it falls back to the bundled seed (`src/content/seed.ts`), so the homepage always renders. A fallback result can itself be cached for up to 60 s.

## HTTP surface

- Only `GET /api/content` exists. Any query parameter returns 400 (`invalid_query`), including operator-style keys (`$where`) and dotted keys. The response is zod-validated; success sends `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`, errors `no-store`.
- `src/proxy.ts` (Next.js middleware) normalises the path (repeated URL decoding, slash collapsing, `;` matrix parameters, trailing dots and spaces, `..`, case) and then:
  - `/admin` and `/admin/*` return 403.
  - Any non-GET/HEAD request to `/api/*` returns 405 with `Allow: GET, HEAD`.
  - Undecodable paths return 400.
- There is no authentication and no write endpoint. Content is changed directly in MongoDB by someone with the write credentials.

### Rate limit

In-memory, fixed one-minute window, applied to `/api/*` only (page routes are not limited). Limit is `RATE_LIMIT_PER_MINUTE` (default 60); over-limit requests get 429 with `Retry-After`. At most 10,000 keys are tracked; the oldest are evicted first.

Limitations:
- On Vercel, the edge overwrites `X-Forwarded-For` with the connecting client's IP (a client-supplied value is discarded), so the key is the visitor's address. Vercel runs many function instances, though, so the in-app limit is loose there; enforce the real limit with a Vercel Firewall rate-limit rule on `/api/*`.
- The client key is the rightmost `x-forwarded-for` entry, falling back to `x-real-ip`. The app must run behind exactly one trusted reverse proxy or platform edge that overwrites or appends `X-Forwarded-For` and sets `X-Forwarded-Proto`. Behind two or more proxies the key becomes a proxy address, so all clients share one bucket. Never expose the app directly: Next only fills `x-forwarded-for` with `??=`, so a directly connected client can set the rightmost entry itself and bypass the limit. Without `X-Forwarded-Proto`, `upgrade-insecure-requests` is dropped from the CSP (HSTS still applies).
- Each process keeps its own counters, so with N instances the effective limit is N times higher and resets on restart. For strict limits enforce them at the edge (CDN, WAF or proxy).

### Headers and CSP

Sent on every proxied response (`src/server/http/security-headers.ts`):

- `Content-Security-Policy` with a fresh nonce per request: `default-src 'self'`; `script-src 'self' 'nonce-<n>' 'strict-dynamic'`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob:`; `font-src 'self'`; `connect-src 'self'`; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`; `object-src 'none'`; `upgrade-insecure-requests` (production, and only when the request arrived over HTTPS, directly or per `x-forwarded-proto`: Safari would otherwise upgrade `http://localhost` and LAN asset URLs and break local testing on an iPhone). Development adds `'unsafe-eval'` and `ws:`. `style-src 'unsafe-inline'` is kept because the ported markup uses inline styles; scripts are nonce-only. Fonts are self-hosted via `next/font`, so no external hosts are allowed.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (owner approved preload). The header alone does nothing extra: preloading starts when the domain is submitted at hstspreload.org, after which browsers refuse plain HTTP for the domain and every subdomain, and removal takes months. Submit only once the final domain is live and every subdomain serves HTTPS. The apex must be the host that serves the app: the list checks the apex's HTTPS response, and a redirect issued by Vercel's domain settings (for example apex to `www`) is answered by the Vercel edge without this header's `includeSubDomains; preload`.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- The proxy skips static assets (`/_next/static`, `/brand/*`, icons), so `next.config.ts` sets the same five static headers (not the CSP) for every path.

## Secrets

- `.env` is git-ignored; `.env.example` lists names only. See the README for the table.
- Use a secret manager or host-level env configuration in production. Rotate the DB passwords if they were ever shared.
- `SITE_URL` is not secret. When it is unset, empty or invalid on a Vercel production deployment, the app uses `https://` plus `VERCEL_PROJECT_PRODUCTION_URL` (validated as a hostname). Otherwise it uses the request origin (`x-forwarded-proto`/`x-forwarded-host`, or `host`, validated strictly as a hostname with optional port) and falls back to localhost only if that is also unusable. It logs one warning per process, only when `NODE_ENV=production`.
