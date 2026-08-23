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
