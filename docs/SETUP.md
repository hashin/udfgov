# Setup — udfgov.cc

Static site: [Eleventy](https://www.11ty.dev/). Content authoring: [Decap CMS](https://decapcms.org/)
(`/admin`), git-backed — every published article is a markdown file in `src/initiatives/`.
Hosting: Netlify (free tier), because Netlify Identity + Git Gateway give content creators a
working login with no custom backend to build or maintain.

## 1. Local development

```bash
npm install
npm run start   # http://localhost:8080
```

## 2. Push to GitHub

Create a new repo (e.g. `hashin/udfgov`) and push this folder to it. Netlify builds from this repo.

## 3. Create the Netlify site

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project** →
   connect the GitHub repo.
2. Build command `npm run build`, publish directory `_site` (already set in `netlify.toml`, so
   Netlify should pick these up automatically).
3. Deploy. You'll get a `*.netlify.app` URL first — confirm the site builds before touching DNS.

## 4. Enable Netlify Identity (content-creator logins)

1. Site settings → **Identity** → **Enable Identity**.
2. **Registration**: set to **Invite only** (not open) — this is a government-facing site, so
   creators should only get in via an invite you send, not self-signup.
3. Site settings → Identity → **Services** → **Git Gateway** → **Enable Git Gateway**. This is
   what lets Decap CMS commit to the repo on a creator's behalf without them ever touching GitHub
   or holding a GitHub token.
4. To invite a content creator: Identity tab → **Invite users** → enter their email. They get an
   email link to set a password, then log in at `https://www.udfgov.cc/admin/`. You can invite
   people any time — no code change needed, which is why this setup works for an open-ended team.
5. Everyone invited this way can create/edit drafts. Because `admin/config.yml` sets
   `publish_mode: editorial_workflow`, new/edited entries appear as **Drafts** in the CMS's
   Editorial Workflow board, move to **In Review**, and only get merged to `main` (i.e. actually
   go live) when someone clicks **Publish** — that's your review-before-publish gate. Anyone
   invited can currently do all three steps; if you want only some people able to hit the final
   Publish button, that needs Identity **role-based access control** — ask me to wire it up once
   you know who your reviewers vs. writers will be.

## 5. Connect the domain

1. Site settings → **Domain management** → **Add a domain** → `www.udfgov.cc`.
2. Netlify will show a target — normally a CNAME to `<your-site-name>.netlify.app`.
3. At **Spaceship** (where `udfgov.cc` is registered), add:
   - `CNAME` record: host `www` → `<your-site-name>.netlify.app`
   - Optionally, also point the bare `udfgov.cc` apex at Netlify (Netlify's DNS panel gives exact
     instructions for apex/ALIAS records) — `netlify.toml` already redirects apex → `www` once
     both resolve.
4. Netlify auto-provisions a free HTTPS certificate (Let's Encrypt) once DNS is verified —
   usually resolves within an hour, can take up to 24h for DNS propagation.

## 6. Verify link previews before sharing widely

After the first real article is published, test the OG image rendering with:
- Facebook's [Sharing Debugger](https://developers.facebook.com/tools/debug/)
- Twitter/X's card validator (or just post a draft tweet to yourself)
- WhatsApp doesn't have a public debugger — send the link to yourself in a chat and check the
  preview card renders the poster image, title, and summary correctly. If a stale/wrong image
  shows up after re-publishing an article, it's usually a caching issue on the platform's side —
  re-run the Facebook debugger's "Scrape Again" to force a refresh.

## Content model reference

Each article is a markdown file in `src/initiatives/` with this frontmatter (see
`src/initiatives/sample-initiative.md`):

```yaml
layout: initiative.njk
title: "..."
poster: /uploads/....jpg   # set via the CMS's image upload field
summary: "One punchy sentence — used as the WhatsApp/social preview text."
category: Infrastructure   # see admin/config.yml for the full list
date: 2026-08-23
```

Content creators never need to touch this directly — the fields above are exactly the form
fields in `/admin`.
