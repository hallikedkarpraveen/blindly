# Blindly website — Vercel deploy

Static site. No build step, no dependencies.

## Deploy
1. Create a Vercel project from this folder (or drag it into vercel.com/new). Framework preset: **Other**. Build command: none. Output directory: `.` (root).
2. Domains (Project → Settings → Domains):
   - Add `blindly.date` as the **primary** domain.
   - Add `www.blindly.date` and set it to **redirect (308) to `blindly.date`**.
3. Deploy.

## Pages
| URL | File |
|---|---|
| `/` | `index.html` |
| `/safety` | `safety.html` |
| `/privacy` | `privacy.html` |
| `/terms` | `terms.html` |
| `/csae-policy` | `csae-policy.html` |
| `/resources` | `resources.html` (coming soon, `noindex`, not in sitemap) |

`vercel.json` enables clean URLs, so `/privacy.html` redirects to `/privacy`.

## Files
- `support.js`, `image-slot.js` — page runtime. Required, keep at root.
- `assets/`, `favicon*`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `site.webmanifest`, `og.png` — icons and link-preview image.
- `robots.txt`, `sitemap.xml`, `llms.txt` — search engines and AI crawlers.

## Integrations already in the pages
- Google Tag Manager: `GTM-WWMV8W3Z`
- PostHog (US cloud), key in `<head>` of each page
- Waitlist form posts to a Google Apps Script web app (URL inside `index.html`)

## After deploy
- Submit `https://blindly.date/sitemap.xml` in Google Search Console.
- Check `https://www.blindly.date/` redirects to `https://blindly.date/`.
- The previous site had pages at `/product`, `/why`, `/stories`, `/download`, `/careers`, `/press`, `/contact`. They no longer exist. Add redirects in `vercel.json` if you want them to go to `/`.
