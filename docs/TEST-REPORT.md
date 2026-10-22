# Test report — 22 October 2026

Environment: Node.js 22.22, PostgreSQL 16.15 (local), Chromium (headless, Playwright) for layout checks.

## Automated tests — 28 passed, 0 failed

Run with `TEST_DATABASE_URL=… npm test`.

**Unit (13)** — `tests/unit.test.ts`
- CSV writer/parser: Arabic text, quotes, commas, newlines; spreadsheet-formula neutralising.
- Slugs, UAE phone normalisation (050…, 00971…, +971 2…), AED price formatting.
- WhatsApp link: exact prefilled Arabic message from the brief, URL-encoded; no price → asks for the price instead of inventing one; no number configured → button hidden.
- Generated descriptions: contain only stated facts; no accident-free / service-history / condition / warranty claims unless the data says so; GCC only when confirmed.
- Arabic search mapping (باترول ٢٠٢٦ → patrol 2026, لاندكروزر → land cruiser).
- Vehicle form validation (empty → null, bad engine size, `javascript:` links rejected).
- password hashing (PBKDF2; older scrypt hashes still accepted); S3 SigV4 signature against AWS's published test vector.

**Integration (15)** — `tests/integration.test.ts`, real app + real PostgreSQL
- Home: Arabic RTL, hreflang, AutoDealer JSON-LD without ratings, WhatsApp link, CSP header.
- English pages under `/en`.
- Arabic search returns only Patrols; price filter + price sort; empty-result state.
- Car page: price, source link, exact WhatsApp message, Car JSON-LD, "confirm availability" notice on flagged cars.
- Suspicious source price (MG 5 GT, AED 372,500) is hidden.
- 404 page; sitemap with both languages; robots.txt.
- Call-back form: valid request stored with normalised phone; invalid phone rejected; honeypot submissions dropped.
- Dashboard security: redirect when signed out; wrong password → 401; cross-site POST → 403; missing CSRF token → 403.
- Full car lifecycle in the dashboard: validation error (422) → create → edit price (site updates) → upload photo (real JPEG accepted, fake image rejected, WebP + thumbnail written, served at `/uploads`) → mark sold (leaves the list, page shows "sold") → delete (404, files removed) → audit entries written.
- Roles: staff blocked from contact settings; owner can save them; invalid WhatsApp number rejected.
- CSV: export has a UTF-8 BOM and all columns; preview reports update / create / skip-duplicate / error rows; apply updates by `source_key` (empty cells keep stored values), creates the new car with its photo URLs, skips the duplicate and the invalid rows.
- Seed is idempotent: second run creates nothing and keeps a status set in the dashboard.

## Cloudflare build (added later the same day)

The Pages bundle (`npm run build:pages`) was run on **workerd**, the open-source runtime behind Cloudflare Workers and Pages Functions (build 2026-10-22), with `nodejs_compat`, connected to the same PostgreSQL over TCP and an in-memory stand-in for the R2 binding.

- All **15 integration tests passed over HTTP** against workerd (`TEST_BASE_URL=http://localhost:8787`), including login, CSRF and origin checks, the full car lifecycle, photo upload to the R2 binding and serving from `/uploads`, CSV import, roles and settings.
- A headless Chromium run of the dashboard on workerd uploaded a 3000×4000 JPEG: the browser resized it to a 1200×1600 WebP plus a 480×640 thumbnail, both without EXIF, stored in the bucket and served back.
- New unit test: JPEG/PNG/WebP signature and size detection, and JPEG metadata removal (13 unit tests now).
- Node tests still pass (28 total). Measured server CPU per page on Node: home ~8 ms, inventory ~5.5 ms, car page ~4 ms; PBKDF2 login hash ~20 ms.

Not verified: a real deployment to Cloudflare (Pages, Hyperdrive, R2), `wrangler` itself (not installable here), and Cloudflare's CPU limits in production.

## Manual and scripted checks

- `tsc --noEmit` passes with `strict` and `noUncheckedIndexedAccess`.
- Production bundle (`npm run build`, `node dist/server.js`): all main routes 200, gzip on, immutable caching for hashed assets, HSTS in production.
- Layout screenshots at 1360 px and 390 px of home, inventory, car page, dashboard and car editor; horizontal-overflow check at 375 px on home, inventory (both languages), car page, contact (no overflow after fixes).
- `images:localize` tested against a local image server: a reachable photo is re-encoded into storage and its row updated; an unreachable one is left untouched.
- Page weight (gzip HTML): home 9.6 KB, inventory 9.5 KB, car page 8.8 KB; CSS 46 KB, JS 3 KB; server response ~12 ms locally.

## Not verified here

- **Listing photos in a browser**: the build sandbox could not reach auto.ae's image store, so screenshots used grey placeholders. The image URLs were checked in a normal browser (they load, 768×1024 and 1500×1500 JPEGs).
- **`npm install` from the public registry**: the sandbox blocked registry.npmjs.org. Packages were built from their official GitHub sources at the same versions as `package.json` (hono 4.13.13, @hono/node-server 1.19.17, postgres 3.4.9) or taken from preinstalled copies (zod 3.25.76, sharp 0.35.4, tailwindcss 4.3.3, esbuild 0.28.2, tsx 4.23.12, typescript 6.0.3). A normal `npm install` on your machine or host will resolve the same versions; no `package-lock.json` could be generated.
- **S3 / Supabase Storage uploads** against a live bucket (signing is unit-tested against AWS's vector; upload path tested with local storage).
- **Deployment** to Render/Supabase, real domain, HTTPS cookies.
- **Lighthouse / Core Web Vitals scores** and an automated accessibility audit (axe) — not available offline. Pages use semantic landmarks, labelled form controls, visible focus, `prefers-reduced-motion`, alt text and keyboard-operable gallery, but a real audit should be run after deployment.
- **Real devices** (iOS Safari, Android Chrome) and the WhatsApp deep link opening the app.
- **Current availability and prices** at the dealership — see `docs/DATA-VERIFICATION.md`.
