# Inventory sources and verification report

Captured on **22 October 2026**. Every car on the site came from one of the dealership's own published listings. Nothing was invented: fields a source did not state are empty in the database and show as «غير متوفر» / «يرجى التواصل للاستفسار» on the site.

## Sources used

| Source | What it gave | How it was linked to Baniyas Cars |
|---|---|---|
| Instagram **@baniyascars** (155K followers) | Profile, branch phone list, official WhatsApp **+971 50 442 2050**, Google Maps link, 12 recent posts with prices and equipment lists | Official account named in the brief |
| Facebook **bce1981** — *Bani Yas Cars Est. مؤسسة بني ياس للسيارات* (241K followers) | Address (ICAD 5, Rahayel Cars City, Abu Dhabi, P.O. Box 55805), mobile 050 800 1443, email info@baniyascars.com, website baniyascars.com | Official account named in the brief |
| auto.ae **Baniyas Cars Abu Dhabi** (`/baniyas/`, verified seller) | 37 active listings with full specs and 7–9 photos each | Same address as Facebook (ICAD V); same cars and prices as Instagram (e.g. MG 8 at AED 75,000) |
| auto.ae **BANIYAS CARS SHOWROOM** (`/baniyascars/`, verified seller, same handle as Instagram) | 29 active listings with full specs and up to 20 photos each, GCC specs stated | Ras Al Khor Industrial Area 3 matches the Instagram «فرع دبي»; X-Trail S at AED 81,000 matches the Instagram post of 4 Sep 2026 |
| dealers.kargal.ae (third-party directory) | Landline +971 2 583 1305, older Al Shamkha address | **Not used on the site** (older, unofficial); listed below for confirmation |

Facebook and Instagram post pages cannot be fetched by search engines or crawlers. Instagram was read through a normal browser session (public profile and post captions only, no login). Instagram photo links are signed and expire, so Instagram-only cars have no stored photos.

The raw captures are in `data/sources/`, the normalised dataset is `data/inventory.json`, and a spreadsheet-friendly copy with every source link and flag is `data/inventory-verified.csv`.

## What is in the inventory

- **72 cars**: 66 from the two auto.ae showroom pages + 6 recent Instagram-only posts.
- Brands: Nissan 28, Toyota 25, MG 11, Renault 3, GMC 2, Chevrolet 1, Lexus 1, Jeep 1.
- Branch: Abu Dhabi 37, Dubai 29, not stated 6 (Instagram).
- 8 used cars with stated mileage, 64 new (0 km).
- 12 marked **export only** by the dealer; the site labels them and explains it.
- 30 with **GCC specs** confirmed by the listing. The Abu Dhabi listings say "Other", so their specs show as «يرجى التواصل للاستفسار» rather than being assumed GCC.
- 823 photos, all the dealership's own listing photos (loaded from the auto.ae image store; run `npm run images:localize` after deployment to copy them into your own storage).
- For each car the database stores `source_url`, `source_key` (for de-duplication), the listing date and `last_verified_at`.

Warranty is shown only where the dealer stated it (X-Trail S, Magnite S, MG 8, MG GT Lux, Patrol Platinum 2026, Sunny 2025 used). Financing was not advertised in any source, so the site does not mention it. No "accident-free", "full service history" or similar claims appear anywhere.

## Needs confirmation with the dealership

These are flagged «بحاجة لتأكيد» in the dashboard with the reason. Staff can fix the data and press **تم التحقق من البيانات**.

| Car (listing) | Why |
|---|---|
| MG 5 GT 2026 — auto.ae 275763 (Abu Dhabi) | Listed at **AED 372,500**, about ten times the same model in Dubai (AED 37,500). Price is **hidden** on the site until confirmed. |
| Nissan Patrol LE T2 2026 — 275740 (Abu Dhabi) and 286361 (Dubai) | Same trim and price (AED 318,000) in both branches. Possibly one car listed twice. Both are shown. |
| Nissan X-Trail S 2026 — 260837 (Dubai) | auto.ae says AWD / 184 hp; the dealer's Instagram post for the same car and price says 4×2 / 181 hp. The Instagram values are shown. Also listed in June. |
| Renault Koleos 2026 — 260840 (Dubai) | Specs say 2.5 L / 171 hp; dealer text says "2.0L full new shape". Also listed in June. |
| Nissan Magnite S, Nissan Altima SV, MG 8 PHEV — 260836/260838/260839 (Dubai) | Listed 17–18 June 2026 (over 90 days ago). Confirm still in stock and price current. |
| Nissan Patrol LE T2 and LE Platinum City 2026 — 214721/214720 (Dubai) | Listed 23 Oct 2025 (a year ago). Confirm still in stock. |

Other items to confirm:

- **WhatsApp number** — +971 50 442 2050 is the number in every Instagram caption. Confirm it should receive website enquiries (it is editable in بيانات التواصل).
- **Opening hours** — 9:00 AM–9:00 PM is from the auto.ae pages; not published on Facebook/Instagram.
- **Al Ain branch address** — only a phone number (056 440 4320) is published.
- **Dubai branch WhatsApp** — none published; the Dubai phone shown is 050 813 1408 from Instagram.
- **Which branch the Google Maps link points to** — it is in the Instagram bio; it is shown as a general "directions" link.
- **Landline +971 2 583 1305 and the Motor World, Al Shamkha address** — from an older third-party directory; not used.
- **Logo** — the site uses a typographic wordmark. Supply the official logo file (SVG or high-resolution PNG) to replace it.
- **MG 8 first-responders offer** (AED 75,000 instead of 82,000) — stated in the June Dubai listing. It is in the dashboard as an **inactive** offer; the homepage offers section stays hidden until an active offer exists.
- **Six Instagram-only cars have no photos** — Patrol LE Titanium 2021 (used, 150,000 km), Patrol LE Platinum 2023 (used, 148,000 km), Patrol Platinum 2026 (AED 301,000), Patrol Platinum V8 2023 (AED 249,000 — the post does not say new/used or mileage), Sunny 2025 (used, 6,800 km), MG GT Lux 2026 (AED 65,000). Upload photos from the dashboard.
- **Toyota FJ** — announced on Instagram on 22 Oct 2026 without price or specs; not added.
