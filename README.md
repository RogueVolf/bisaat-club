# Bisaat Club

Website for Bisaat Club, a games and reading space in Frazer Town, Bengaluru. The homepage is a phone-first, first-person walk-through of the room (WebGL) with a bottom sheet for each zone, a countdown to opening day, and a booking button. Content (zones, prices, hours, links) is stored in MongoDB and falls back to bundled data if the database is unavailable.

One Next.js 16 app (App Router) serves the site and a read-only content API from a single Node server.

## Prerequisites

- Node.js 20+
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
| `SITE_URL` | Public base URL, used for metadata, Open Graph and structured data. Set it in production |
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
| `npm run test:e2e` | Playwright smoke tests on iPhone 13 (WebKit) and a 375x667 Chromium viewport |
| `npm run compare` | Screenshots the app against the reference page for all six zones, light and dark, with mismatch percentages in `test-results/compare/` |
| `npm run measure:iphone` | Frame-time and load measurements for iPhone-class devices |
| `npm run seed` | Seed MongoDB (see below) |

First e2e run: `npx playwright install webkit chromium`.

## Seeding

`npm run seed` uses `MONGODB_URI_WRITE`. It creates the `settings`, `zones` and `prices` collections with their `$jsonSchema` validators (or updates the validators with `collMod` on existing collections) and upserts the bundled content from `src/content/seed.ts`. It overwrites documents with the same `_id`, so it resets edits to those documents.

`npm run seed -- --if-empty` skips any collection that already has documents. Use it in deploy scripts so it never clobbers live edits.

## Changing content without a deploy

Edit the documents in MongoDB. The site re-reads content at most every 60 seconds, so changes go live within about a minute (an API or CDN cache may add up to its own 60 s). Use the read-write user in `mongosh`; the validators reject malformed edits.

```js
use bisaat
// Rename a zone
db.zones.updateOne({ _id: "ps5" }, { $set: { title: "PlayStation corner" } })
// Set the opening date (ISO 8601 with offset)
db.settings.updateOne({ _id: "site" }, { $set: { openingAt: "2026-12-20T09:00:00+05:30" } })
// Change the booking button (href and label come from these two fields)
db.settings.updateOne({ _id: "site" }, { $set: { bookingUrl: "https://example.com/book", bookingLabel: "Book a table" } })
```

If a document fails validation or the database is down, visitors see the bundled seed content instead.

## Deployment

Any host that runs Node.js 20+:

```bash
npm run build && npm start      # listens on PORT (default 3000)
```

Checklist:

- Set all runtime env vars (`MONGODB_URI_READ`, `MONGODB_DB`, `SITE_URL`, optionally `RATE_LIMIT_PER_MINUTE`). The write URI is only needed where you run the seed.
- MongoDB must use TLS in production (`mongodb+srv://` or `tls=true`); the app refuses weakened TLS, except for loopback hosts.
- Use separate read-only and read-write users, and restrict network access (Atlas IP access list or private endpoint; firewall and private bind address if self-hosted).
- Put the app behind exactly one trusted reverse proxy that sets `x-forwarded-for`, or expose it directly. The rate limit is per process.
- Serve over HTTPS; the app sends HSTS and a nonce-based CSP.

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

- **Address.** The visiting card's wording versus "terrace level, Mani Business Centre, 39/1 Coles Road". Which is correct? (The site currently says "5th Floor, Gold Mani Business Centre".)
- **Logo.** The original vector logo is needed for the header, favicon and Open Graph image.
- **Hosting and domain.** Where it runs, which domain, and whether MongoDB is Atlas or self-hosted. This decides the network rules (Atlas IP access list versus firewall or private network).
- **Room accuracy.** Confirm the 36 ft width, the 16 ft left wall and 19 ft right wall, and the estimated furniture positions.
- **404 copy.** The new 404 page text needs sign-off.
- **HSTS preload.** Currently off. Decide once the domain is fixed (preload is hard to reverse).
- **Postal code.** Not yet in the address data.
