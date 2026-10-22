# Baniyas Cars — معرض بني ياس للسيارات

Arabic-first website and inventory dashboard for Baniyas Cars (Bani Yas Cars Est.), UAE.

- Public site in Arabic (RTL) at `/` and English at `/en`: home, searchable inventory, a page per car, contact.
- 72 real cars from the dealership's own listings, with prices in AED, specs, 823 listing photos and a link to each original listing. See [docs/DATA-VERIFICATION.md](docs/DATA-VERIFICATION.md).
- WhatsApp enquiry on every car with the prefilled Arabic message, a call-back form, share button.
- Dashboard at `/admin`: add/edit/delete cars, photo upload, available/reserved/sold, featured cars, Arabic/English text, offers, enquiries, contact settings, users, CSV import/export, change history.
- SEO: unique titles and descriptions per page and language, canonical + hreflang, Open Graph, `sitemap.xml`, `robots.txt`, `AutoDealer` and `Car` structured data (no ratings or reviews).

## Stack

| Layer | Choice |
|---|---|
| Server | Node.js 20+, TypeScript, [Hono](https://hono.dev) with server-rendered JSX |
| Styling | Tailwind CSS v4 (built by `scripts/build-assets.mjs`), self-hosted IBM Plex Sans Arabic + Reem Kufi (OFL) |
| Database | PostgreSQL (Supabase, Neon, Railway or self-hosted) via [postgres.js](https://github.com/porsager/postgres); SQL migrations in `src/db/migrations` |
| Photos | `sharp` (validate, rotate, strip GPS, WebP 1600 px + 640 px thumbnails) to local disk or any S3-compatible bucket (Supabase Storage, Cloudflare R2) |
| Client JS | ~3 KB of progressive enhancement (gallery, share, auto-submit filters). Every page and filter works without JavaScript. |

**Why not Next.js?** The brief preferred Next.js "if supported by the current environment". The build environment blocked the npm registry, so Next.js could not be installed, run or tested there. Hono runs anywhere Node runs, has a much smaller footprint, server-renders every page (good for SEO and Core Web Vitals) and was fully tested here against a real PostgreSQL database. Pages, data access and validation are kept in separate modules (`src/views`, `src/repo`, `src/domain`) so a later move to another framework reuses most of the code.

## Project layout

```
src/
  server.ts            Node entry: runs migrations, starts the server
  app.tsx              Routes, static files, error and 404 handling
  http/                public.tsx (site), admin.tsx (dashboard), seo.ts (sitemap/robots), common.ts (CSP, logging)
  views/               layout, components, pages/ (public), admin/ (dashboard)
  repo/                Database queries: vehicles, settings, offers, inquiries, audit
  domain/              Vehicle types and validation (zod), Arabic names for makes/models/colours
  lib/                 auth, images, storage (local/S3), CSV, descriptions, WhatsApp, formatting, logger
  i18n/                Arabic and English interface text
  client/              Browser scripts (main.ts, admin.ts)
  styles/app.css       Design tokens and components
  db/migrations/       SQL schema
scripts/               seed, create-admin, build-inventory, localize-images, migrate, asset/server builds
data/sources/          Raw captures from Instagram, Facebook and auto.ae (22 Oct 2026)
data/inventory.json    Normalised dataset loaded by the seed
data/inventory-verified.csv  Same data with sources and flags, for review in Excel
tests/                 unit.test.ts and integration.test.ts
```

## Run locally

Requirements: Node.js 20.11 or newer, PostgreSQL 14 or newer.

```bash
npm install
cp .env.example .env              # then edit DATABASE_URL and SESSION_SECRET (openssl rand -hex 32)
createdb baniyas                  # or create the database in Supabase
npm run db:seed                   # creates tables and loads the 72 verified cars
npm run admin:create -- --email you@example.com --name "Your Name" --role owner
npm run dev                       # http://localhost:3000  and  http://localhost:3000/admin
```

`admin:create` asks for the password (10+ characters with letters and digits) so it does not end up in shell history. Run it again with the same email to reset a password.

Production build and start:

```bash
npm run build      # Tailwind + client JS, type-check, server bundle in dist/
npm start          # node dist/server.js (applies pending migrations on boot)
```

## Tests

```bash
npm test                                              # unit tests
TEST_DATABASE_URL=postgres://…/baniyas_test npm test  # + integration tests against a real database (it is wiped)
```

See [docs/TEST-REPORT.md](docs/TEST-REPORT.md) for what was run and what is still unverified.

## Deploy (low cost)

Recommended free-tier setup: **Render** (web service) + **Supabase** (PostgreSQL + photo storage).

1. **Supabase**: create a project in a nearby region. Copy the *Session pooler* connection string (port 5432). In Storage, create a **public** bucket named `vehicles`, then create S3 access keys (Project Settings → Storage).
2. **Load data** from your computer once: set `DATABASE_URL` (and `DATABASE_SSL=require`) in `.env`, then `npm run db:seed` and `npm run admin:create -- --email … --role owner`.
3. **Render**: push this folder to a GitHub repository, then *New → Blueprint* and pick the repo (`render.yaml` is included). Fill the secret variables: `SITE_URL` (your domain), `DATABASE_URL`, and the `S3_*` values shown in `.env.example`.
4. **Photos**: after the first deploy, run `npm run images:localize` (locally with the production `.env`, or from Render's shell). It copies the 823 listing photos from auto.ae into your bucket so the site no longer depends on auto.ae.
5. **Domain**: add your domain in Render, set `SITE_URL` to it, and submit `https://your-domain/sitemap.xml` in Google Search Console.

Render's free plan sleeps after inactivity (first visit takes ~30 s). For a real dealership, the Starter plan (always on) is worth it. A `Dockerfile` is included for Railway, Fly.io or any VPS; on a VPS you can keep `STORAGE_DRIVER=local` with a persistent `storage/` folder.

## Managing cars (for the dealership team)

Everything below is done in `/admin`; no code changes needed. The public site updates immediately (pages are cached for at most 60 seconds by a CDN, if you add one).

- **Add a car**: السيارات → إضافة سيارة. Fill what you know; leave anything unconfirmed empty and the site shows «غير متوفر». Save, then upload photos (several at once; first photo is the cover; "رئيسية" makes another photo the cover).
- **Change price or details**: open the car, edit, save. Descriptions are written automatically from the specs and update with the price; type your own text in the description fields only if you want to override it.
- **Reserved / sold**: change the status from the list. Sold cars leave the listing, but their page still opens (with a "sold" notice) so shared links don't break. Prefer "sold" over deleting.
- **Homepage**: tick «اعرضها في سيارات مختارة» (needs at least one photo); the rank number sets the order.
- **Offers**: العروض. The homepage offers section appears only when an offer is active and not expired.
- **Contact details, branches, social links**: بيانات التواصل (owner only). The WhatsApp number here drives every WhatsApp button on the site.
- **Enquiries**: طلبات الاتصال lists call-back requests with a WhatsApp reply button.
- **Bulk updates**: استيراد وتصدير. Download the inventory as CSV, edit in Excel, upload, review the preview, then apply. Rows are matched by `source_key`: matching cars are updated (empty cells keep the current value), new rows are added, likely duplicates without a `source_key` are skipped, nothing is deleted. Lists (features, image URLs) are separated with `|`.

## Keeping inventory in sync with Instagram, Facebook and auto.ae

Instagram and Facebook do not allow automated reading of a business account's posts without the official Meta Graph API (a Facebook app, business verification and a long-lived token), and auto.ae offers no public API. The site therefore **does not claim automatic synchronisation**. The working process is:

1. **Day to day**: when a car is posted on Instagram, add it in the dashboard (or update its price/status). Paste the post link in «رابط الإعلان الأصلي» so the site links to it.
2. **Bulk refresh**: export the CSV, update it, import it. The `source_key` column (e.g. `auto.ae:275740`, `instagram:DerZSlriL1W`) prevents duplicates.
3. **Re-running the original capture**: update the files in `data/sources/`, run `npm run inventory:build` then `npm run db:seed`. The seed updates facts for known listings, adds new ones, and never deletes cars or overwrites status, featured flags, descriptions or verification set in the dashboard.
4. **Stale listings**: cars listed more than 90 days before a check are flagged «بحاجة لتأكيد» with a visible "confirm availability" notice; nothing is removed automatically.

If the dealership later wants Instagram posts to appear automatically, the next step is a Meta Graph API integration (Instagram Business account linked to the Facebook page) that drafts new cars for staff approval. That needs credentials only the dealership can create.

## Security notes

- Passwords: scrypt; 5 failed attempts lock an account for 15 minutes; per-IP login rate limit.
- Sessions: random 256-bit token in an HttpOnly, SameSite=Lax (Secure in production) cookie; only a SHA-256 hash is stored. Password change signs out other devices.
- Every dashboard POST needs a per-session CSRF token and a same-origin `Origin`/`Referer`.
- Roles: owner (everything) and staff (cars, offers, enquiries, import/export).
- Uploads are decoded by sharp (file names and MIME types are not trusted), re-encoded to WebP and stripped of metadata; size limits per request.
- CSP with per-request nonces, `frame-ancestors 'none'`, HSTS in production, no secrets in client code. CSV export neutralises spreadsheet formulas.
- All changes in the dashboard are written to an audit log shown on the dashboard home.
