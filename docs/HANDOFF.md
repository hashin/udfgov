# Project handoff — udfgov.cc

Read this first in any new session working on this project. It captures the full
current architecture, decisions made (and why), known gotchas already debugged once,
and what's still open. Repo: [github.com/hashin/udfgov](https://github.com/hashin/udfgov)
(public). Local clone: `/Users/hashin/Documents/GitHub/udfgov`.

## What this is

A wiki-style site showcasing UDF Kerala government initiatives and achievements. Every
article has a poster image as a hero (also used as the `og:image` for WhatsApp/social
link previews) plus text, in Malayalam or English. Content creators publish through a
CMS at `/admin/` — no coding required on their end.

## Architecture (current, as of 2026-08-24)

- **Static site generator**: Eleventy (11ty). Source in `src/`, config in `.eleventy.js`.
- **Hosting**: Cloudflare Pages, project name `udfgov`, under the Cloudflare account
  `sneha4luvn@gmail.com` (account ID `880b2687f3a93d5d8efd8e2f482287e0`).
- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`) runs on every push to
  `main` — `npm run build` then `wrangler pages deploy _site`. **Deliberately not**
  using Cloudflare's own git-integration dashboard flow; GitHub Actions is more
  inspectable and avoids repeating the OAuth-dashboard friction hit with Netlify.
- **CMS**: Decap CMS (`admin/index.html`, `admin/config.yml`), backend `github`
  (not `git-gateway`). Content creators log in with a GitHub account; access is
  controlled by being a collaborator on this repo, not by a separate user system.
- **OAuth proxy**: `functions/auth.js` and `functions/callback.js` are Cloudflare
  Pages Functions implementing Decap's documented external-OAuth-provider protocol
  (redirect to GitHub → exchange code for token server-side → postMessage handshake
  back to the CMS popup). This exists because Decap's `github` backend needs *some*
  server-side piece to keep the OAuth client secret off the browser; Cloudflare Pages
  Functions host it in the same project instead of a separate service.
- **Domain**: `udfgov.cc`, registered at Spaceship. DNS: `www` is a CNAME to
  `udfgov.pages.dev` (verified/active). Apex (`udfgov.cc` bare) uses two A records
  pointing at `172.66.47.16` and `172.66.44.240` — switched from ALIAS/ANAME to plain
  A records mid-session because ALIAS never got past Cloudflare's verification; **as
  of this writing the apex is still stuck on `pending` even with A records**, see Open
  items. DNS is managed at Spaceship, not Cloudflare's own nameservers. DNSSEC is
  enabled on the zone (see gotcha #5).

## Why it's on Cloudflare Pages and not Netlify

Originally built on Netlify (Identity + Git Gateway + Netlify Pages). Netlify's
account-level "credits" system silently blocked *every* deploy for hours on
2026-08-23 with `"Skipped due to account credit usage exceeded"` — including real
published content — while the account dashboard simultaneously showed 0/300 credits
used (contradictory/stale reporting). Rather than debug Netlify's billing further,
migrated to Cloudflare Pages (genuinely free tier, no opaque credits system) same day.
**Netlify Identity/Git Gateway is gone** — don't reintroduce it; the `github` backend
above is the replacement.

## Image storage (currently in-repo, with a free migration path when needed)

Poster images and inline body photos are uploaded through Decap's default GitHub-
backend media picker straight into `src/uploads/` (`media_folder`/`public_folder`
in `admin/config.yml`) and committed to this git repo like any other file — no
separate media host. As of 2026-08-24 that's **15 files, 3.7 MB total, repo `.git`
at 5.3 MB** — trivial, nowhere near a real limit.

**Why this is fine for now, and what the actual ceilings are:**
- GitHub's own guidance: individual files are hard-blocked only above 100 MiB
  (warned above 50 MiB) — phone-camera JPEGs here run ~150–400 KB, a non-issue.
  Total *repo* size is recommended to stay under 1 GB, "less than 5 GB strongly
  recommended" — beyond that GitHub Support may reach out about the burden on
  their infrastructure.
- Cloudflare Pages hard-caps a deployment at **20,000 files total** (HTML pages +
  images + everything else combined) — see the capacity analysis from
  2026-08-24. At the images-per-article rates this site actually uses, that caps
  out around 5,000–10,000 published articles, likely before the git-repo-size
  guidance above becomes the binding constraint.
  - **Updated 2026-08-26**: `responsiveImage` (below) generates 1 extra WebP
    file per unique poster/photo per place it's used at a different size (in
    practice 1-2: one for its card thumbnail, one for its hero image if it has
    one), on top of the original upload, which is still passed through as-is
    for `og:image`/`twitter:image`. That's a small enough multiplier that the
    5,000–10,000 estimate above still roughly holds. (An earlier version of
    this generated a `srcset` of 2-3 widths per spot instead of one fixed
    size, which would have cut that estimate roughly in half -- simplified
    back down to one width per call site since the extra file cost wasn't
    worth the marginal byte savings.) Still
    re-checking this estimate again if that pace changes a lot.
- `npm run check-media-size` (wired into `.github/workflows/deploy.yml`, runs on
  every deploy) measures `src/uploads` and emits a `::warning::` in the GitHub
  Actions log — visible on the run's summary page, doesn't fail the build — if it
  exceeds 250 MB or 3,000 files (see `scripts/check-media-size.js` for the exact
  thresholds). That's deliberately early: ~25% of GitHub's "ideal" 1 GB repo size
  and ~15% of Cloudflare's file cap, so there's real runway between the first
  warning and an actual problem.

**Why Cloudflare R2 is the migration target, not Git LFS, when that warning fires:**
Git LFS looks like the obvious fix but its free tier (10 GB storage **and** 10 GB
*bandwidth*/month) is bandwidth-metered per `git fetch`/checkout of LFS objects —
every CI deploy re-checks-out the repo, so a handful of publishes a day against a
few hundred MB of LFS-tracked images could burn through the monthly bandwidth
allowance fast, silently disabling LFS (or billing, if a payment method's on file)
until the next month. **Cloudflare R2's free tier has zero egress/bandwidth
charges** (10 GB storage, 1M write + 10M read ops/month, no bandwidth cap at all)
and is the same account/ecosystem this site is already hosted on. 10 GB covers
roughly 25,000–40,000 images at this site's typical size — comfortably past the
Cloudflare Pages 20,000-file ceiling above, so once migrated, images stop being a
constraint at all.

**Migration plan, to execute when `check-media-size` actually warns (not before —
this is real engineering effort not justified by 3.7 MB of images):**
1. Create an R2 bucket in the same Cloudflare account (`880b2687f3a93d5d8efd8e2f482287e0`)
   and enable public access on it (either the built-in `r2.dev` bucket URL, or bind
   a custom subdomain like `media.udfgov.cc` — the latter is cleaner for OG-image
   URLs shared on WhatsApp/social).
2. Decap CMS's default GitHub-backend media picker doesn't speak R2/S3 natively —
   it needs a small custom media library (`CMS.registerMediaLibrary(...)` in
   `admin/index.html`, same pattern already used for the YouTube editor
   component) that uploads the selected file to R2 instead of committing it to
   git. Since a browser can't hold R2 write credentials safely, uploads need to go
   through a small Cloudflare Pages Function (same pattern as `functions/auth.js`)
   that either proxies the upload or mints a short-lived presigned PUT URL.
   `poster`/inline-image fields then store the resulting `media.udfgov.cc/...` URL
   in frontmatter/markdown instead of a `/uploads/...` repo-relative path.
3. Existing images already in `src/uploads/` can stay there (old articles keep
   working via their existing repo-relative URLs) — only new uploads need to go to
   R2, no bulk migration of history required unless repo size itself (not just
   `src/uploads`) is the specific problem being solved.
4. Update `src/_data/site.js`/templates only where they assume `/uploads/...` is
   always repo-relative (the `og:image` tag in `base.njk` already prefixes with
   `site.url`, so an absolute R2 URL in `poster` would need that prefix skipped —
   check before shipping).

**Image optimization (added 2026-08-26):** posters/photos are no longer served
at their original upload size everywhere they appear. `.eleventy.js`'s
`responsiveImage` Nunjucks shortcode (wraps `@11ty/eleventy-img`) resizes and
re-encodes each one to a single WebP at the one width that spot actually
needs -- ~500px for grid-card thumbnails, 1200px for an article's hero image,
280px for a minister photo -- e.g. a typical ~400 KB upload becomes a ~35 KB
card thumbnail. One fixed width per call site rather than a `srcset` of
several is deliberate: nearly all the byte savings here come from WebP +
right-sizing away from the original's huge dimensions, not from also matching
every viewport exactly, and each extra width is another generated file
counting against the Cloudflare Pages 20,000-file cap noted above -- not
worth it for the marginal extra savings. WebP-only for the same reason (no
JPEG/PNG fallback): WebP support is effectively universal on the mobile
browsers this site's WhatsApp-driven audience actually uses. `og:image`/
`twitter:image` still point at the *original* upload, not an optimized
variant -- intentional, since social platforms fetch and cache that once
themselves rather than it being re-downloaded per visitor. Falls back to a
plain `<img>` (original file, unoptimized) if a source file is missing or
processing fails for any reason, so a bad reference can't fail the build.
Inline images pasted into an article's markdown body are **not** run through
this -- only template-controlled images (posters, minister photos) are.

## Content model

Two Decap CMS collections, both markdown files with frontmatter:

- **`src/initiatives/*.md`** — the actual articles. Fields: `draft` (boolean, default
  `true`), `title`, `poster` (image), `summary`, `category` (select, see
  `src/_data/categories.js`), `minister` (relation → ministers collection),
  `ministry` (select, portfolio dropdown), `date`, `body` (markdown). Slug is
  timestamp-based (`{{year}}-{{month}}-{{day}}-{{hour}}{{minute}}{{second}}`) — **do
  not** change this back to a title-derived slug; see gotcha below.
- **`src/ministers/*.md`** — Council of Ministers profiles. Fields: `name`,
  `designation`, `portfolios`, `party`, `constituency`, `photo` (image, optional —
  shows initials placeholder if empty), `order` (controls listing order). All 21
  ministers of the Satheesan Ministry (formed 18 May 2026) are already populated;
  **no photos uploaded yet** — every profile currently shows an initials placeholder.
  Photos should come from verified official sources, not scraped — that's a
  deliberate policy, not an oversight.

**Publish/review workflow**: `publish_mode: simple` in `admin/config.yml`, not
`editorial_workflow`. Review happens via the `draft` boolean instead: a draft entry
still builds (reachable at its direct URL, `noindex`ed, shows a visible "Draft"
banner) but is filtered out of `/`, `/archive/`, and `/category/*` listings. An editor
unchecks `draft` and hits Publish to go live. *(Note: `editorial_workflow` was
originally abandoned because Netlify's Git Gateway blocked GitHub's Search API, which
that mode depends on. Now that the backend is plain `github` instead of `git-gateway`,
that specific restriction may no longer apply — worth re-testing if real PR-based
review is ever wanted instead of the draft-flag approach, but not verified in this
session.)*

## Pages

- `/` — homepage, initiatives grouped by month/year
- `/archive/` — all initiatives grouped by date and by ministry
- `/category/<name>/` — one page per category (`src/category.njk`, paginated from
  `src/_data/categories.js` — **keep this list in sync with the `category` field's
  options in `admin/config.yml`**, there's no automated link between them)
- `/ministers/` — Council of Ministers grid
- `/ministers/<slug>/` — individual minister profile + their linked initiatives
- `/about/` — hand-written About page (`src/about.njk`)

## Analytics

**GA4 is live** as of 2026-08-23. Property "UDF Kerala — udfgov.cc", Measurement ID
`G-YCSDSR765B`, set as the `GA_MEASUREMENT_ID` GitHub Actions secret (read via
`process.env` at build time in `src/_data/site.js` → `gaId`, baked into the static
HTML — not a runtime var, so changing it needs a redeploy, e.g.
`gh run rerun <latest-run-id> --repo hashin/udfgov`). Confirmed firing on live pages
(checked `gtag('config', 'G-YCSDSR765B', {...})` renders with correct
`content_category`/`content_minister` values in the page source). Skipped entirely on
draft pages. Custom dimensions (`content_category`, `content_ministry`,
`content_minister`) were registered by Hashin in GA4 → Admin → Custom definitions —
**not independently verified from this session** (no GA4 API access); if reports look
empty for these dimensions, check Realtime with a fresh pageview first before assuming
something's broken.

## Where secrets live (values are NOT in this repo or doc)

- **GitHub Actions secrets**: `CLOUDFLARE_API_TOKEN` (used by the deploy workflow),
  `GA_MEASUREMENT_ID` (set, `G-YCSDSR765B` — build-time only, no need for a
  Cloudflare runtime equivalent).
- **Cloudflare Pages environment variables** (project `udfgov`, both
  production and preview): `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` —
  used by the OAuth proxy Functions. The GitHub OAuth App itself lives at
  github.com/settings/developers under Hashin's account, named "UDF Kerala CMS",
  callback URL `https://www.udfgov.cc/callback`.

## Known gotchas already debugged (avoid re-discovering these)

1. **Non-Latin titles broke git refs.** Decap's default `slug: "{{slug}}"` used the
   raw title as the git branch/filename. A Malayalam title produced a git ref GitHub
   rejected outright (422). Fixed by making slugs timestamp-based. Don't revert this.
2. **`object-fit: cover` cropped portrait "news card" posters badly**, sometimes
   slicing through the headline text baked into the image. Fixed with
   `object-fit: contain` — but the *first* attempt used `max-width/max-height: 100%`
   on the `<img>`, which silently fails to resolve against a parent whose height
   comes from `aspect-ratio` (images rendered as a blank navy box, no error). The
   working pattern is `width: 100%; height: 100%; object-fit: contain` on the image,
   inside a box with an explicit `aspect-ratio`. Always verify a CSS image-sizing
   change against a local build (`python3 -m http.server` in `_site/`) before pushing
   — this broke in production twice before that habit stuck.
3. **Cloudflare Pages custom domain verification can get stuck** reporting `"CNAME
   record not set"` even when DNS is demonstrably correct (checked against multiple
   public resolvers). Fix: DELETE the domain from the Pages project via the API and
   re-POST it — forces a fresh verification attempt instead of polling a stuck state.
   Worked for `www` within ~10 minutes of a reset. The apex (`udfgov.cc` bare) has
   needed **three** resets across a full session and switching from ALIAS/ANAME to
   plain A records, and is *still* stuck pending as of this writing — this one might
   need Cloudflare support or just more elapsed time, not more resets.
4. **Cloudflare Pages env vars need a fresh deployment** to actually reach Functions
   at runtime — setting them via the API doesn't retroactively affect an
   already-deployed build.
5. **DNSSEC is enabled on the `udfgov.cc` zone** (has an RRSIG/DS chain at Spaceship).
   It validates fine (confirmed via `dig +dnssec`), but don't be surprised if it shows
   up in diagnostics — it's expected, not a misconfiguration.

## Open items

- **Apex domain (`udfgov.cc`, no `www`) SSL/verification** — still `pending` after
  three delete+recreate resets and switching DNS from ALIAS to A records
  (`172.66.47.16`, `172.66.44.240`, confirmed resolving correctly at Spaceship). Not
  a DNS problem at this point — likely needs either more elapsed time or Cloudflare
  support. `www.udfgov.cc` is fully live and unaffected, so this only blocks the
  bare/no-www URL specifically.
- **Content creators**: `hashin` (owner) and `shamseer67-lab` (accepted) have access.
  Still need GitHub usernames (not just emails) for: `joshypx@hotmail.com`,
  `albinjosekumblani@gmail.com`, `tijokurian547@gmail.com`, `ajzalmuneem@gmail.com` —
  each needs a free GitHub account, then add via
  `gh api repos/hashin/udfgov/collaborators/<username> -X PUT -f permission=push`.
- **Minister photos** — all 21 are placeholder initials. Needs verified official
  photos uploaded through `/admin/` → Council of Ministers → each entry → Photo field.
- **GA4 custom dimensions** — registered by Hashin in the GA4 UI
  (`content_category`/`content_ministry`/`content_minister`), not independently
  verified from this session (no API access to GA4). Confirm via Realtime reports if
  in doubt.
- **Old Netlify site** (`udfgov.netlify.app`) still exists but is unused/orphaned —
  could be deleted from the Netlify dashboard to avoid future confusion, not done.
- **Sample/test content** — already cleaned up (`sample-initiative.md` removed), but
  worth checking `/archive/` for any further stray test entries before wide launch.

## Useful commands

```bash
# Local build + quick manual preview (verify before pushing UI changes)
cd /Users/hashin/Documents/GitHub/udfgov
npm run build
cd _site && python3 -m http.server 8199   # then browse http://localhost:8199

# Check latest deploy status
gh run list --repo hashin/udfgov --limit 5

# Add a content creator (needs their GitHub username)
gh api repos/hashin/udfgov/collaborators/<username> -X PUT -f permission=push

# Manual deploy without waiting for GitHub Actions (needs wrangler logged in)
npx wrangler pages deploy _site --project-name=udfgov --branch=main
```
