# Deploy to Cloudflare Pages

How the site runs on Cloudflare:

```
Visitor ──► Cloudflare Pages
              ├─ static files (CSS, JS, fonts, images)   served from pages-dist/
              └─ _worker.js (the whole app, a Pages Function)
                    ├─ Hyperdrive ──► PostgreSQL (Supabase or Neon)
                    └─ R2 bucket "baniyas-cars-photos" (photos uploaded in the dashboard, served at /uploads/…)
```

`npm run build:pages` produces `pages-dist/`: the static files, `_worker.js`, `_routes.json` (static paths never wake the Function) and `_headers` (long caching for hashed files). The same code still runs on Node (`npm start`); nothing else needs to change.

## Before you start

- A Cloudflare account, Node.js 20+ and Git on your computer.
- **Plan:** use **Workers Paid ($5/month)**. The free plan allows 10 ms of CPU per request. Measured locally, pages take about 4–8 ms (the home page is the heaviest) and signing in to the dashboard about 20 ms (password hashing), so on the free plan sign-in and busy moments can fail with error 1102. Workers Paid allows 30 s of CPU per request. The free plan also caps the site at 100,000 dynamic requests a day. Static files are free on both plans.
- A PostgreSQL database. Supabase or Neon free tiers both work. Hyperdrive (connection pooling) is included in both Workers plans; the free plan allows 100,000 queries a day.

## 1. Create the database and load the cars

1. **Supabase:** New project → choose the closest region (Mumbai `ap-south-1` or Frankfurt). Then *Connect* → **Session pooler** → copy the URI (port 5432). It looks like
   `postgres://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`
   (Neon: copy the connection string from the dashboard.)
2. On your computer, in the project folder:

   ```bash
   npm install
   cp .env.example .env
   ```

   In `.env` set `DATABASE_URL` to that URI, `DATABASE_SSL=require`, and `SESSION_SECRET` to the output of `openssl rand -hex 32`.
3. Create the tables, load the 72 cars, and create your dashboard login:

   ```bash
   npm run db:seed
   npm run admin:create -- --email you@example.com --name "Your Name" --role owner
   ```

## 2. Create the Cloudflare resources

```bash
npx wrangler login

# Photos bucket (enable R2 once in the dashboard first: R2 Object Storage → Get started; the free tier is 10 GB)
npx wrangler r2 bucket create baniyas-cars-photos

# Hyperdrive in front of the database (use the same URI as in .env)
npx wrangler hyperdrive create baniyas-db --connection-string="postgres://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
```

Copy the Hyperdrive `id` it prints into `wrangler.toml` (replace `REPLACE_WITH_YOUR_HYPERDRIVE_ID`).

## 3. Create the Pages project and deploy

Pick one of the two ways.

### A. Deploy from your computer (quickest)

```bash
npx wrangler pages project create baniyas-cars --production-branch main
npx wrangler pages secret put SESSION_SECRET --project-name baniyas-cars   # paste a new: openssl rand -hex 32
npm run deploy:pages
```

Wrangler prints the address, e.g. `https://baniyas-cars.pages.dev`.

### B. Deploy automatically from GitHub

1. Push the project to a GitHub repository (`.env`, `node_modules` and build folders are already git-ignored).
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → choose the repository.
3. Build settings:
   - Framework preset: **None**
   - Build command: `npm run build:pages`
   - Build output directory: `pages-dist`
   - Environment variable (build): `NODE_VERSION` = `22`
4. Save and deploy. The R2 and Hyperdrive bindings and the plain variables come from `wrangler.toml`.
5. **Settings → Variables and Secrets → Add** → type *Secret* → `SESSION_SECRET` (a new `openssl rand -hex 32`). Redeploy.

Every push to `main` then deploys to production; other branches get preview URLs.

## 4. Check it

- `https://<your-project>.pages.dev/healthz` should show `{"ok":true}` (the database is reachable).
- Open the home page and a car page, then `/admin` and sign in.
- If you see "The site is not configured correctly", open **Workers & Pages → baniyas-cars → Deployments → View details → Functions → Real-time logs**; the log line names the missing or invalid variable.

## 5. Connect your domain

Pages project → **Custom domains → Set up a custom domain** (for example `baniyascars.com` or `www.baniyascars.com`). When it is active:

1. In `wrangler.toml` set `SITE_URL = "https://your-domain"` (it is used for canonical links, the sitemap and WhatsApp share links), then redeploy (`npm run deploy:pages`, or push to GitHub).
2. In Google Search Console, add the domain and submit `https://your-domain/sitemap.xml`.

## 6. Copy the listing photos into R2 (recommended)

The 823 photos currently load from auto.ae's image store. To keep them working if auto.ae removes a listing, copy them into your bucket once:

1. R2 → **Manage R2 API tokens → Create API token** with *Object Read & Write* on `baniyas-cars-photos`. Note the Access Key ID, Secret Access Key and your Account ID.
2. Add to your local `.env` (the database settings from step 1 stay):

   ```ini
   STORAGE_DRIVER=s3
   S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_BUCKET=baniyas-cars-photos
   S3_ACCESS_KEY_ID=<access key id>
   S3_SECRET_ACCESS_KEY=<secret access key>
   S3_PUBLIC_BASE_URL=/uploads
   S3_FORCE_PATH_STYLE=true
   ```

3. Run `npm run images:localize`. Photos are re-encoded to WebP, written to R2, and the database is updated to `/uploads/…`, which the site serves from the bucket.

## Day-to-day on Cloudflare

- **Photo uploads:** the dashboard resizes photos in the browser (WebP, 1600 px plus a 640 px thumbnail) before uploading, which also removes location data. Use a current Chrome, Edge or Safari. iPhone HEIC photos are converted in Safari; in other browsers, export them as JPEG first.
- **Database changes after an update:** the Cloudflare version does not migrate the database on start. After pulling a new version, run `npm run db:migrate` from your computer (with `.env` pointing at the production database) before deploying.
- **Logs:** Pages project → Deployments → the production deployment → Functions → Real-time logs. Every request is one JSON line.
- **Rate limits** for the login and call-back forms are kept per Cloudflare location; account lockout after 5 failed logins is stored in the database and applies everywhere.

## Local preview with Wrangler (optional)

Create `.dev.vars` (git-ignored) from `.dev.vars.example`, then:

```bash
export WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgres://postgres:postgres@localhost:5432/baniyas"
npm run preview:pages
```

Wrangler simulates the R2 bucket locally and serves the site at http://localhost:8788.
