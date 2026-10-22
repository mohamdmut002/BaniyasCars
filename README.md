# Baniyas Cars — معرض بني ياس للسيارات

A lightweight, frontend-only website for Baniyas Cars (Bani Yas Cars Est.), UAE. Arabic first (RTL) with an English version.
No database, no server, no accounts, no API keys: the build turns one data file into plain HTML pages that any static host can serve.

## Run it

Requirements: Node.js 20.11 or newer.

```bash
npm install
npm run dev
```

Open **http://localhost:4173/** (English: http://localhost:4173/en/). The site rebuilds automatically when you save a file; refresh the browser to see the change.

Other commands:

| Command | What it does |
|---|---|
| `npm run build` | Builds the site into `dist/` (about 150 pages, under a second) |
| `npm run preview` | Serves the last build from `dist/` at http://localhost:4173/ |
| `npm test` | Type-checks and runs the tests (data checks, search, filters, sorting, WhatsApp text) |

## What's on the site

- **Home** — navy hero with search, selected cars, browse by brand and by price, recently added, about, contact.
- **Cars** (`/cars/`) — all cars with live search (Arabic or English, e.g. «باترول» or "patrol"), filters (brand, model, year, price, mileage, condition, transmission, fuel, GCC specs, hide export-only) and sorting (newest, price, year, mileage). Filters are kept in the address, so a filtered list can be shared or bookmarked.
- **Car pages** (`/cars/<slug>/`) — photo gallery with lightbox, price, specs table, plain-Arabic description written from the specs, equipment, warranty when stated, link to the original listing, similar cars, share button.
- **WhatsApp** — every car has a button with the prefilled message
  «السلام عليكم، استفسر عن سيارة [السيارة] موديل [السنة]، المعروضة بسعر [السعر] درهم. هل السيارة متوفرة؟»
- **Contact** (`/contact/`), links to the official Instagram and Facebook accounts, and a custom **404** page.
- **SEO** — page titles and descriptions in both languages, Open Graph, `AutoDealer` and `Car` structured data (no ratings or reviews), `robots.txt`; canonical links, hreflang and `sitemap.xml` when `SITE_URL` is set (see Deploy).

## Where things are

```
src/data/vehicles.ts   ← the inventory: edit this file to add, sell or reprice cars
src/data/types.ts      fields a car can have, and their defaults
src/config/site.ts     ← WhatsApp, phone, email, hours, branches, social links, site address
src/i18n/index.ts      Arabic and English interface text
src/views/             page templates (home, inventory, car, contact, 404) and shared components
src/styles/app.css     colours (navy / white / gold), fonts and components (Tailwind CSS)
src/client/main.ts     browser script: search, filters, sorting, gallery, share
src/lib/               search/filter logic, descriptions, formatting, WhatsApp links
scripts/               build.ts (static build), dev.mjs (watch + serve), serve.mjs (preview server)
public/                fonts, favicon, sharing image — copied as-is into the build
data/sources/          raw captures of the dealership's listings (22 Oct 2026), for reference
docs/DATA-VERIFICATION.md  where every car came from, and what still needs confirming
```

## Updating the inventory

Everything is in **`src/data/vehicles.ts`**. Each car is one `defineVehicle({ ... })` block; only `slug`, `make`, `model` and `year` are required.

- **Unknown details:** leave the field out. The site shows «غير متوفر». No price → «يرجى التواصل للاستفسار».
- **Price change:** edit `price_aed`, and set `last_verified_at` to today's date.
- **Sold:** `status: 'sold'` (the card leaves the list; the car's page still opens with a "sold" notice so shared links keep working). **Reserved:** `status: 'reserved'`.
- **New car:** copy a block, give it a unique `slug` (lowercase letters, digits and dashes, e.g. `toyota-land-cruiser-gxr-2026-ig-abc123`), and fill in only what the listing states. Put the listing link in `source_url`.
- **Photos:** full URLs, or put the files in `public/photos/` and write `images: ['/photos/patrol-1.jpg', '/photos/patrol-2.jpg']`. The first photo is the cover.
- **Homepage "selected cars":** `featured: true` (needs at least one photo).
- **Needs checking:** `verification: 'needs_confirmation'` shows «تأكد من التوفر»; add the reason in `verification_note`.
- **Sample/test cars:** only with `verification: 'sample'` — they are labelled «مثال توضيحي — ليست سيارة معروضة» and kept out of the home page and sitemap.

The build stops with a clear message if an entry is invalid (duplicate slug, bad year, negative price, photo path not starting with `/` or `http`).

## Contact details and WhatsApp

Edit **`src/config/site.ts`**. The WhatsApp number (+971 50 442 2050) is the one the dealership publishes in its Instagram posts; set `whatsapp: null` to hide all WhatsApp buttons — they are then replaced by a link to the contact page. Every other value can also be set to `null` to hide it.

## Inventory data

The 72 cars are the dealership's own listings captured on 22 October 2026: 66 from its two verified auto.ae showroom pages (Abu Dhabi and Dubai) and 6 from recent posts on the official Instagram account. 10 are marked as needing confirmation (old listings or conflicting details). Nothing was invented; see `docs/DATA-VERIFICATION.md`.

Instagram and Facebook do not allow automatic reading of a business account's posts without the dealership's own Meta API access, so the inventory is updated by hand in `src/data/vehicles.ts`.

Listing photos load from auto.ae's image store. If a listing is removed there, its photos may stop loading; to avoid that, download the photos you want to keep into `public/photos/` and update the URLs.

## Deploy as a static site

Build with your real address so canonical links and the sitemap are correct:

```bash
SITE_URL=https://your-domain.ae npm run build
```

(Or set `url` in `src/config/site.ts`.) Then publish the **`dist/`** folder:

- **Cloudflare Pages:** Create → Pages → Connect to Git. Build command `npm run build`, output directory `dist`, environment variables `SITE_URL=https://your-domain` and `NODE_VERSION=22`. Or upload `dist/` with `npx wrangler pages deploy dist`.
- **Netlify:** build command `npm run build`, publish directory `dist`, plus `SITE_URL`.
- **GitHub Pages / any web server:** upload the contents of `dist/`.

`dist/404.html` is used automatically for missing pages on Cloudflare Pages, Netlify and GitHub Pages. `dist/_headers` adds basic security headers and long caching for CSS, JS and fonts on Cloudflare Pages and Netlify.

## Stack

TypeScript, a ~60-line JSX-to-HTML renderer (`src/jsx/`) used only at build time, Tailwind CSS v4, esbuild for the ~14 KB browser script, and self-hosted IBM Plex Sans Arabic and Reem Kufi fonts (SIL Open Font License, in `public/fonts/`). The site itself has **no runtime dependencies**; `npm install` only fetches the build tools listed under `devDependencies`.
