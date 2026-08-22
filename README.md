# udfgov.cc

A wiki-style record of UDF Kerala Government initiatives and achievements. Each entry is a
poster (hero image) + markdown writeup, authored by content creators through a `/admin` login,
designed to look good and carry the right preview image when shared on WhatsApp and social media.

- **Static site generator**: [Eleventy](https://www.11ty.dev/)
- **Content authoring**: [Decap CMS](https://decapcms.org/) at `/admin`, git-backed, editorial
  workflow (draft → review → publish)
- **Hosting / auth**: [Netlify](https://netlify.com) (free tier) — Identity handles
  content-creator logins, Git Gateway lets the CMS commit on their behalf

See [`docs/SETUP.md`](docs/SETUP.md) for full deployment steps (GitHub repo, Netlify site,
Identity/invite setup, DNS at Spaceship).

## Local dev

```bash
npm install
npm run start
```
