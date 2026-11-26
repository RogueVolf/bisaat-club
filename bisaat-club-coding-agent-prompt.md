# Build brief: Bisaat Club website, phase 1

You're building the first live version of the website for Bisaat Club, a "third space" in Frazer Town, Bangalore: PS5, sim racing, board games and a free lending library in one room, where people stay for hours. It opens on Saturday 12 December 2026. Most visitors will arrive from Instagram on an iPhone, so the phone experience is the product and desktop is secondary.

The design is already decided. Attached is `bisaat-club-walk-the-floor.html`, a single self-contained page that the owner has approved. Your job today is to put that page live as a Next.js application backed by MongoDB, with the content coming from the database and the security groundwork in place. Bookings, payments and an admin area come later and are described below only so you don't build something that blocks them.

## What the reference page does

Open the HTML file in a browser before you write anything, and read its source; it is commented and is the specification.

- A first-person WebGL view of the room. The visitor drags to look around, and taps a hotspot or "Next room" to walk between six viewpoints: door, PS5 corner, sim rigs, board games, reading room, reception.
- A bottom sheet (a floating card on desktop) shows the current zone's kicker, title, body and price, plus "Next room", "Book on WhatsApp" and "Find us".
- A header with the logo, a live countdown to opening, and a toggle between light mode (soft daylight) and dark mode (lamps and hanging lights only). The default follows the device's colour scheme.
- Hotspots for zones that are off-screen pin to the nearest screen edge so every zone is always one tap away.
- Deep links: `#lib` opens at the reading room, `#lib-night` opens it in dark mode. The same works for every zone id.
- It renders only when something changes, drops resolution while moving and sharpens when still, respects reduced-motion, and shows a plain fallback if WebGL is unavailable.

The room itself is defined in the script as boxes and ellipsoids in metres (`box()`, `blob()`), with the lighting done in one fragment shader. Zone copy, camera positions, the booking link and the opening date are constants at the top of the script (`ZONES`, `ORDER`, `BOOKING_URL`, `OPENING`).

## What to build today

A single Next.js application (App Router, TypeScript) that serves both the site and its API from one Node server. The owner wants one backend that will later also process bookings, show a payment page and host the admin area, so do not use static export and do not split frontend and backend into separate deployables.

**The homepage.** Port the reference page faithfully. Do not redesign it, restyle it or "improve" the copy. The WebGL scene becomes a client component; the header, sheet and content are server-rendered so the text is in the HTML for search engines and for visitors whose WebGL fails. Keep the room geometry and the shader in their own modules rather than inlined in a component, because the owner intends to replace the code-drawn room with real 360° photos or a modelled scene after the interior is finished on 8 December. Design that seam now: the walk-through logic (viewpoints, hotspots, sheet, modes) should not care how the room is drawn.

**Content from MongoDB.** Move everything the owner will want to change without a deploy into the database, and seed it from the constants in the reference file:

- Site settings: opening date and time, opening hours, address, WhatsApp number, Instagram handle, booking URL, maps link.
- Zones: id, order, kicker, title, body, price text, camera position, yaw, pitch, hotspot anchor.
- Price list as structured data (item, weekday rate, weekend rate, unit), even though today's page only shows price text per zone. The price and admin pages will need it.

The booking button must read from one setting. Today it is the WhatsApp link; later it becomes an internal booking route, and that change should be a data edit, not a code change.

The homepage must still render if the database is unreachable. Bundle the seed data as a fallback and cache content reads with revalidation rather than querying on every request.

**A read-only content API** that the homepage uses, with responses validated against a schema before they leave the server.

**Supporting pieces for going live:** DM Sans loaded through `next/font`, page title and description, Open Graph image, LocalBusiness structured data with address and hours, a favicon from the logo mark, and a 404 page in the same style.

## Protection policies

The owner asked for "full protection policies". Nothing personal is collected in this phase, but the same database and server will hold bookings and payments later, so set the rules now.

- The browser never talks to MongoDB. All access goes through a server-side data layer.
- The application connects with a database user limited to this app's database. Use a read-only user for public content reads if the hosting allows two users, and keep the read-write user for the seed script and future admin use.
- Connections use TLS, and network access to the database is restricted to the application's hosts.
- Every collection has a JSON Schema validator in MongoDB, and every API input is validated on the server before use. Reject any input containing keys that start with `$` or contain dots, so operator injection is not possible.
- There are no public write endpoints in this phase. Add middleware that denies `/admin` and every non-GET API route outright, so nothing is exposed by accident before authentication exists.
- Secrets live in environment variables. Commit an `.env.example` with names only, and make sure nothing secret reaches the client bundle or the logs.
- Send security headers: a Content-Security-Policy that allows only what the page needs (self, the Google Fonts hosts if you don't self-host, WebGL needs no special allowance), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, and `frame-ancestors 'none'`.
- Rate-limit the API routes.
- Run a dependency audit and fix or document anything high-severity.

## What comes later (do not build, do not block)

Online booking of PS5 stations and sim rigs by the hour, a payment page, and an admin area with several views for the day's tasks. Further public pages are also planned: what's here, prices, library, events, visit. For now, organise routes and the data layer so these can be added without restructuring, and stop there. Do not add authentication libraries, booking models, payment SDKs or placeholder pages.

## Facts for the seed data

| | |
|---|---|
| Opening | Saturday 12 December 2026, 9 AM IST |
| Hours | 9 AM to 11 PM |
| WhatsApp | +91 99452 05694 |
| Instagram | @bisaatclub |
| PS5 couch station, up to 4 players | ₹300 per hour weekdays, ₹500 weekends |
| PS5 sim rig | ₹500 per hour weekdays, ₹650 weekends |
| Xbox sim rig | ₹400 per hour weekdays, ₹550 weekends |
| Chill-zone pass | ₹500 for 30 days; free for anyone who books gaming |
| Student Hour | 30% off, weekdays 11 AM to 4 PM |
| Library | Always free; 500+ books, run by Safar-e-Siyahi (safaresiyahi.in) |
| House rule | No laptops |

Brand colours: ink blue `#1F2A44`, cream `#F3EBDD`, walnut `#5A3A24`, lamp amber `#E3A33B`, deep amber `#C8821B`, wood `#91705A`, espresso `#2B1D15`. They are already CSS variables in the reference file.

## Things to raise with the owner rather than guess

- **Address.** The visiting card says "5th Floor, Gold Mani Business Centre, Coles Road"; an earlier brief said "terrace level, Mani Business Centre, 39/1 Coles Road". The reference page uses the card's wording. Confirm before launch.
- **Logo.** The reference file embeds the logo as a PNG extracted from the visiting-card PDF. Ask for the original vector file and use it for the header, favicon and Open Graph image.
- **Hosting and domain.** Not decided. Ask where this will be deployed and whether MongoDB is Atlas or self-hosted, since the network and user rules above depend on it. Until you have an answer, keep the app runnable with `npm run dev` against a local MongoDB and make no hosting-specific assumptions.
- **Room accuracy.** The room is 36 ft wide; the left wall is 16 ft and the right wall 19 ft, and the reference draws it as a rectangle about 18 ft deep. Furniture positions, the door position and the far-end bookshelf placement were estimated from a verbal description.

## How to know you're done

- At 390×844, the Next.js homepage matches the reference file in light and dark mode at each of the six viewpoints. Use the deep links to capture both and compare screenshots; differences should be limited to font rendering.
- It works in Safari on a current iPhone and on a small one (375×667), in portrait and landscape, with safe-area padding intact, and stays smooth while walking and dragging.
- Changing a zone's copy, the opening date or the booking URL in MongoDB changes the live page without a deploy.
- With the database stopped, the homepage still loads from the fallback content.
- A request to `/admin` or a POST to any API route is refused.
- The repository has a README covering setup, environment variables, the seed script and deployment; a small test suite covering content validation and the API; and one end-to-end smoke test that loads the homepage at a phone viewport and checks that the canvas and the sheet text are present.

When you report back, say what you verified and how, list anything you could not verify, and list the open questions above that are still unanswered.
