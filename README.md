# Bisaat Club

Website for Bisaat Club, a games and reading space in Frazer Town, Bengaluru. The homepage is a phone-first, first-person walk-through of the room (WebGL) with a bottom sheet for each zone, a countdown to opening day (replaced by an "open" label and the hours once the club opens), and a booking button. Content (zones, prices, hours, links) is stored in MongoDB and falls back to bundled data if the database is unavailable.

One Next.js 16 app (App Router) serves the site and a read-only content API. Production runs on Vercel with MongoDB Atlas; locally it runs against MongoDB in Docker.

## Prerequisites

- Node.js 20.19+
- Docker (local MongoDB 8.2)

## Setup

```bash
cp .env.example .env     # then fill in every value
docker compose up -d     # MongoDB on 127.0.0.1:27017, users created on first start
npm install
npm run seed             # creates collections, validators and content
npm run dev              # http://localhost:3000
```

Example local values (choose your own passwords; do not commit `.env`):

```
MONGODB_URI_READ=mongodb://bisaat_ro:<RO_PASSWORD>@127.0.0.1:27017/bisaat
MONGODB_URI_WRITE=mongodb://bisaat_rw:<RW_PASSWORD>@127.0.0.1:27017/bisaat
MONGODB_DB=bisaat
```

The users are only created on a fresh Docker volume. For an existing volume, see `docs/security.md`.

## Environment variables

| Name | Purpose |
| --- | --- |
| `MONGODB_URI_READ` | Read-only connection string (user `bisaat_ro`), used by the site |
| `MONGODB_URI_WRITE` | Read-write connection string (user `bisaat_rw`), used only by `npm run seed` |
| `MONGODB_DB` | Database name (`bisaat`) |
| `RATE_LIMIT_PER_MINUTE` | API requests per minute per IP before 429 (default 60) |
| `SITE_URL` | Public base URL, used for metadata, Open Graph and structured data. Set it in production to the canonical domain. If unset on Vercel production, the project's production domain (`VERCEL_PROJECT_PRODUCTION_URL`, chosen by Vercel) is used, which may be a host that redirects. Previews use their own host |
| `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD` | Docker compose: MongoDB root user |
| `MONGO_APP_RO_PASSWORD`, `MONGO_APP_RW_PASSWORD` | Docker compose: passwords for the two app users |
| `MONGODB_URI_TEST` | Root URI for the seed integration test (throwaway databases) |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript |
| `npm test` | Unit tests plus the Docker-backed integration test (needs MongoDB running and `MONGODB_URI_TEST`) |
| `npm run test:e2e` | Playwright smoke tests: the main suite (builds and serves on port 3200; WebKit iPhone 13 and iPhone SE, plus a 390x844 Chromium sanity project), then the database-down fallback suite (`playwright.fallback.config.ts`, port 3201, same build, MongoDB unreachable) |
| `npm run compare` | Screenshots the reference page and the app (serve it on port 3200 first, or pass a URL or set `E2E_BASE_URL`; `SITE_URL` is deliberately ignored so a production value can never be targeted) for all six zones, light and dark, with mismatch percentages in `test-results/compare/`. Add `--webkit` for Safari. Fails if the canvas region (room pixels, hotspot pills excluded) differs by more than 0.5%, the header (opening status `#open` masked, since it depends on the date) or sheet by more than 1.0%, or hotspot boxes differ by more than 2 px. Chromium's rendering of the reference page varies slightly between loads (text anti-aliasing; the app's shots are byte-identical), so a failing view re-shoots the reference, never the app, up to 3 times and keeps the closest |
| `npm run measure:iphone` | Frame-time and load measurements for iPhone-class devices |
| `npm run seed` | Seed MongoDB (see below) |

First e2e run: `npx playwright install webkit chromium`.

## Seeding

`npm run seed` uses `MONGODB_URI_WRITE`. It creates the `settings`, `zones` and `prices` collections with their `$jsonSchema` validators (or updates the validators with `collMod` on existing collections) and upserts the bundled content from `src/content/seed.ts`. It overwrites documents with the same `_id`, so it resets edits to those documents.

`npm run seed -- --if-empty` never overwrites documents in a collection that already has some. It still updates every validator and fills in settings fields added since the database was first seeded (`openLabel`, `address.postalCode`), only where they are missing. Use it on an existing database (including a Docker volume seeded earlier) after pulling new code, and in deploy scripts.

## Changing content without a deploy

Edit the documents in MongoDB. The site re-reads content at most every 60 seconds, so changes go live within about a minute (an API or CDN cache may add up to its own 60 s). Use the read-write user in `mongosh`. The database validators only check types, enums and required fields, so edits must also follow the formats in `src/content/schema.ts` (for example the `openingAt` format, `whatsapp`, https URLs). An edit that passes MongoDB but fails the app's zod check is silently replaced by the bundled seed, and that fallback can be cached for up to 60 s. After an edit, run `curl <site>/api/content | grep source`: it should say `"db"`. If it says `"fallback"`, the edit was rejected; revert it.

```js
use bisaat
// Rename a zone
db.zones.updateOne({ _id: "ps5" }, { $set: { title: "PlayStation corner" } })
// Set the opening date (ISO 8601 with offset)
db.settings.updateOne({ _id: "site" }, { $set: { openingAt: "2026-12-20T09:00:00+05:30" } })
// Header after opening day: "<openLabel>" above "<hoursText>" (shown from openingAt onwards)
db.settings.updateOne({ _id: "site" }, { $set: { openLabel: "Open today", hoursText: "9 AM to 11 PM" } })
// Change the booking button (href and label come from these two fields)
db.settings.updateOne({ _id: "site" }, { $set: { bookingUrl: "https://example.com/book", bookingLabel: "Book a table" } })
```

If a document is invalid or the database is down, visitors see the bundled seed content instead.

## Deployment (Vercel and MongoDB Atlas)

Vercel builds and runs the app with no extra configuration: `vercel.json` only pins functions to Mumbai (`bom1`), next to the visitors and the database.

1. **Atlas.** Create the cluster in AWS Mumbai (`ap-south-1`) so it sits next to the functions. Create two database users scoped to the `bisaat` database: `bisaat_ro` with `read`, and `bisaat_rw` with `readWrite` plus a custom role granting `collMod`, `createCollection` and `createIndex` on `bisaat` (the same roles as `docker/mongo-init/01-users.js`). Use the `mongodb+srv://` strings Atlas gives you; they use TLS, which the app requires in production.
2. **Network access.** Vercel functions have no fixed outbound IP unless the project buys Vercel Static IPs (Pro or Enterprise, paid add-on). With Static IPs, put only those addresses in the Atlas IP Access List. Without them, Atlas must allow `0.0.0.0/0`, and the protection is the TLS connection, the strong per-user password and the read-only user the site uses. See `docs/security.md`.
3. **Seed once**, from your machine (add your own IP to the Atlas access list temporarily): `MONGODB_URI_WRITE='<rw srv uri>' MONGODB_DB=bisaat npm run seed -- --if-empty`. The write URI never goes into Vercel.
4. **Vercel project env vars**: `MONGODB_URI_READ` and `MONGODB_DB` (Production and Preview), `SITE_URL=https://<domain>` (Production), optionally `RATE_LIMIT_PER_MINUTE`. Mark the URI as sensitive.
5. **Domain.** Add it in Vercel; Vercel serves HTTPS and redirects HTTP. Make the apex (`<domain>`, not `www`) the primary domain that serves the site, and let `www` redirect to it. The preload list checks the apex's HTTPS response, and only responses from the app carry `includeSubDomains; preload`: a redirect served by Vercel's own domain settings does not. Once the domain is final and every subdomain serves HTTPS, submit the apex at hstspreload.org (see `docs/security.md`).
6. **Rate limiting.** The in-app limit is per function instance. Add a Vercel Firewall rate-limit rule on `/api/*` for a real limit.

Checks after the first deploy: `curl -sI https://<domain>/ | grep -i strict-transport` must show `includeSubDomains; preload` (check `https://www.<domain>/` too), and `curl -s https://<domain>/api/content | grep source` should say `"db"`.

### Other hosts

Any host that runs Node.js 20.19+ also works (`npm run build && npm start`, listening on `PORT`, default 3000):

- Set the runtime env vars above, and build with them present: `/opengraph-image` is prerendered at build time and reads content from the database.
- Run behind exactly one trusted reverse proxy or platform edge that overwrites or appends `X-Forwarded-For` and sets `X-Forwarded-Proto`. Never expose the app directly: the rightmost `X-Forwarded-For` entry is the rate-limit key, and a directly connected client can set it. Without `X-Forwarded-Proto`, `upgrade-insecure-requests` is dropped from the CSP (HSTS still applies).
- Ship `assets/` and `public/` alongside `.next`: the Open Graph image route reads files from `process.cwd()` at runtime.
- Restrict network access to MongoDB (firewall and private bind address if self-hosted).

Details are in `docs/security.md`.

## Project layout

```
src/app/            routes: page, 404, Open Graph image, GET /api/content
src/components/     server-rendered Header, Sheet, Stage; client Walkthrough
src/content/        zod schema, bundled seed, key guard, formatting, structured data
src/server/         server-only: db client, TLS policy, validators, content repository, rate limit, headers
src/proxy.ts        middleware: /admin deny, API method and rate limits, CSP and headers
src/scene/          RoomRenderer interface (types.ts) and the procedural WebGL implementation
src/walkthrough/    camera controller, hotspots, deep links, math (depend only on RoomRenderer)
scripts/            seed, icon generation (and comparison script)
docker/             MongoDB init script (users and roles)
tests/              unit, integration and e2e
docs/security.md    protection policies as implemented
```

### Swapping the scene (photos or a modelled room)

`src/scene/types.ts` defines `RoomRenderer`: `init(canvas, opts)` (return `false` if unsupported), `resize`, `render(camera, day)`, `project(worldPoint)` and `dispose`. Today's implementation is `src/scene/procedural/` (geometry, shader, renderer). The walk-through controller only talks to this interface, so to use 360 degree photos or a modelled scene, write another `RoomRenderer` and pass it to `startWalkthrough` in `src/components/Walkthrough.tsx` in place of `createProceduralRenderer()`. Camera poses and hotspot positions come from zone data (`cam`, `yaw`, `pitch`, `at`), so a new renderer must honour the same coordinate system, or the zone data be updated.

## Open questions for the owner

- **Room accuracy.** The code-drawn room is an estimate (36 ft wide, 16 ft left wall, 19 ft right wall, furniture from a verbal description). Real 360 degree photos follow after the interior is finished; they replace it through the `RoomRenderer` seam above.
- **Vector logo.** The brand kit is PNG only (`brand/`). The header still uses the logo extracted from the visiting card; an SVG would sharpen it on high-density screens.
- **Atlas network access.** Whether to buy Vercel Static IPs (allowlist only those) or allow `0.0.0.0/0` in Atlas.
