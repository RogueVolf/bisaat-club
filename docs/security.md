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

**Atlas**
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
- The client key is the rightmost `x-forwarded-for` entry, falling back to `x-real-ip`. The app must sit behind exactly one trusted reverse proxy that appends the real client IP, or be directly exposed. Behind two or more proxies the key becomes a proxy address, so all clients share one bucket. Never expose the app directly while also trusting a proxy header: a directly connected client can set `x-forwarded-for` itself.
- Each process keeps its own counters, so with N instances the effective limit is N times higher and resets on restart. For strict limits enforce them at the edge (CDN, WAF or proxy).

### Headers and CSP

Sent on every proxied response (`src/server/http/security-headers.ts`):

- `Content-Security-Policy` with a fresh nonce per request: `default-src 'self'`; `script-src 'self' 'nonce-<n>' 'strict-dynamic'`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob:`; `font-src 'self'`; `connect-src 'self'`; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`; `object-src 'none'`; `upgrade-insecure-requests` (production). Development adds `'unsafe-eval'` and `ws:`. `style-src 'unsafe-inline'` is kept because the ported markup uses inline styles; scripts are nonce-only. Fonts are self-hosted via `next/font`, so no external hosts are allowed.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains`. No `preload` yet: that is hard to undo and waits on the owner's final domain decision.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

## Secrets

- `.env` is git-ignored; `.env.example` lists names only. See the README for the table.
- Use a secret manager or host-level env configuration in production. Rotate the DB passwords if they were ever shared.
- `SITE_URL` is not secret but must be set in production (metadata and structured data). The app logs one warning, once per process, only when `NODE_ENV=production` and `SITE_URL` is unset, empty or invalid, and then uses localhost.
