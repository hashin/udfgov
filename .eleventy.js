const { DateTime } = require("luxon");
const slugify = require("@sindresorhus/slugify");
const path = require("path");
const eleventyImage = require("@11ty/eleventy-img");
const categories = require("./src/_data/categories.js");

// Maps a public URL path (as stored in frontmatter -- "/uploads/x.jpeg" or
// "/static/images/x.png") back to the actual file on disk, so
// responsiveImage below can hand eleventy-img a real path. Returns null for
// anything else (e.g. an already-absolute external URL), in which case the
// shortcode falls back to a plain unoptimized <img>.
function resolveImagePath(src) {
  if (src.startsWith("/uploads/")) return path.join(__dirname, "src", "uploads", path.basename(src));
  if (src.startsWith("/static/")) return path.join(__dirname, "src", src.slice(1));
  return null;
}

// Groups initiatives into [{ year, total, months: [{ month, monthLabel, items }] }],
// both levels sorted newest-first. Shared by the /archive/ overview (which
// only needs year + total for its index) and the one-page-per-year
// /archive/<year>/ pagination (which needs the full month breakdown) --
// splitting by year keeps each archive page's size bounded by a single
// year's content instead of the site's entire history.
function groupByYearMonth(initiatives) {
  const years = new Map();
  for (const item of initiatives || []) {
    if (!item.data.date) continue;
    const dt = DateTime.fromJSDate(new Date(item.data.date), { zone: "utc" });
    const year = dt.year;
    const month = dt.month;
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year);
    if (!months.has(month)) months.set(month, { month, monthLabel: dt.toFormat("LLLL"), items: [] });
    months.get(month).items.push(item);
  }
  return Array.from(years.keys())
    .sort((a, b) => b - a)
    .map((year) => {
      const months = Array.from(years.get(year).values()).sort((a, b) => b.month - a.month);
      return { year, total: months.reduce((sum, m) => sum + m.items.length, 0), months };
    });
}

// Groups initiatives into [{ ministry, slug, items }], ministries alphabetical,
// items without a ministry set are grouped under "Unassigned" at the end.
// Powers the one-page-per-ministry /archive/ministry/<slug>/ pagination, so
// a single ministry's full history never has to share a page with every
// other ministry's.
function groupByMinistry(initiatives) {
  const groups = new Map();
  for (const item of initiatives || []) {
    const key = (item.data.ministry || "").trim() || "Unassigned";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const keys = Array.from(groups.keys()).sort((a, b) => {
    if (a === "Unassigned") return 1;
    if (b === "Unassigned") return -1;
    return a.localeCompare(b);
  });
  return keys.map((ministry) => ({ ministry, slug: slugify(ministry), items: groups.get(ministry) }));
}

// Shared by every collection below that needs "all published initiatives,
// newest first" -- keeps the sort/filter logic (and its date-fallback
// behavior) in one place instead of copy-pasted per collection.
function getPublishedInitiatives(collectionApi) {
  return collectionApi
    .getFilteredByGlob("src/initiatives/*.md")
    .filter((item) => !item.data.draft)
    .sort((a, b) => {
      return (b.data.date ? new Date(b.data.date) : 0) - (a.data.date ? new Date(a.data.date) : 0);
    });
}

// Shared by every collection below that needs "all published opinion
// pieces, newest first" -- mirrors getPublishedInitiatives above, kept
// separate since opinions are a distinct content type (external authors'
// pieces republished from social media/elsewhere, not official
// government announcements) with their own collection and fields.
function getPublishedOpinions(collectionApi) {
  return collectionApi
    .getFilteredByGlob("src/opinion/*.md")
    .filter((item) => !item.data.draft)
    .sort((a, b) => {
      return (b.data.date ? new Date(b.data.date) : 0) - (a.data.date ? new Date(a.data.date) : 0);
    });
}

// How many initiative cards a minister/category page shows before handing
// off to a "page 2" continuation -- kept as one constant so the profile/
// category page (which renders the first chunk directly) and the
// collections below (which compute the overflow chunks) agree on where
// page 1 ends.
const CARDS_PER_PAGE = 9;

// Splits `items` into chunks of `pageSize`, returning one entry per chunk:
// { items, pageNumber (0-based), url, prevUrl, nextUrl }. `urlForPage(i)`
// (0-based) gives that chunk's URL; `firstPrevUrl` is the "previous" link
// for chunk 0 (null by default -- pass e.g. a minister's own profile URL
// when chunk 0 is really the *second* page of that listing).
function buildPagedChunks(items, pageSize, urlForPage, firstPrevUrl = null) {
  const chunks = [];
  for (let i = 0; i < items.length; i += pageSize) chunks.push(items.slice(i, i + pageSize));
  return chunks.map((pageItems, i) => ({
    items: pageItems,
    pageNumber: i,
    url: urlForPage(i),
    prevUrl: i > 0 ? urlForPage(i - 1) : firstPrevUrl,
    nextUrl: i + 1 < chunks.length ? urlForPage(i + 1) : null,
  }));
}

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/static": "static" });
  eleventyConfig.addPassthroughCopy({ admin: "admin" });
  eleventyConfig.addPassthroughCopy("src/uploads");
  eleventyConfig.addPassthroughCopy("src/robots.txt");

  eleventyConfig.addCollection("initiatives", (collectionApi) => getPublishedInitiatives(collectionApi));

  eleventyConfig.addCollection("opinions", (collectionApi) => getPublishedOpinions(collectionApi));

  // One entry per page-of-CARDS_PER_PAGE -- paginated (size: 1) by
  // src/opinion.njk into /opinion/, /opinion/page/2/, etc. Built the same
  // way as categoryPages below (rather than a raw `pagination: {data:
  // collections.opinions}` block) because Eleventy's built-in pagination
  // silently produces zero pages -- not one page with zero items -- when
  // the source array is empty, which /opinion/ starts out as before the
  // first piece is published.
  eleventyConfig.addCollection("opinionPages", (collectionApi) => {
    const opinions = getPublishedOpinions(collectionApi);
    const urlForPage = (i) => (i === 0 ? "/opinion/" : `/opinion/page/${i + 1}/`);
    return opinions.length
      ? buildPagedChunks(opinions, CARDS_PER_PAGE, urlForPage)
      : [{ items: [], pageNumber: 0, url: urlForPage(0), prevUrl: null, nextUrl: null }];
  });

  eleventyConfig.addCollection("ministers", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/ministers/*.md")
      .sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99));
  });

  // One entry per year, each holding that year's month/item breakdown --
  // paginated (size: 1) by src/archive-year.njk into /archive/<year>/.
  eleventyConfig.addCollection("initiativesByYear", (collectionApi) => {
    return groupByYearMonth(getPublishedInitiatives(collectionApi));
  });

  // One entry per ministry -- paginated (size: 1) by src/archive-ministry.njk
  // into /archive/ministry/<slug>/.
  eleventyConfig.addCollection("ministryArchive", (collectionApi) => {
    return groupByMinistry(getPublishedInitiatives(collectionApi));
  });

  // One entry per (category, page-of-CARDS_PER_PAGE) -- paginated (size: 1)
  // by src/category.njk. Page 0 of each category lives at /category/<name>/
  // (unchanged URL); overflow continues at /category/<name>/page/2/, etc.,
  // instead of ever-growing on a single page.
  eleventyConfig.addCollection("categoryPages", (collectionApi) => {
    const initiatives = getPublishedInitiatives(collectionApi);
    const pages = [];
    for (const category of categories) {
      const slug = category.toLowerCase();
      const mine = initiatives.filter((item) => item.data.category === category);
      const urlForPage = (i) => (i === 0 ? `/category/${slug}/` : `/category/${slug}/page/${i + 1}/`);
      const chunks = mine.length
        ? buildPagedChunks(mine, CARDS_PER_PAGE, urlForPage)
        : [{ items: [], pageNumber: 0, url: urlForPage(0), prevUrl: null, nextUrl: null }];
      for (const chunk of chunks) pages.push({ category, ...chunk });
    }
    return pages;
  });

  // One entry per (minister, overflow page) for initiatives beyond the
  // first CARDS_PER_PAGE shown directly on a minister's own profile page
  // (src/_includes/minister.njk) -- paginated (size: 1) by
  // src/minister-more.njk into /ministers/<slug>/page/2/, /page/3/, etc.
  // Ministers with CARDS_PER_PAGE or fewer initiatives get no entries here,
  // since their profile page already shows everything.
  eleventyConfig.addCollection("ministerOverflowPages", (collectionApi) => {
    const initiatives = getPublishedInitiatives(collectionApi);
    const ministers = collectionApi.getFilteredByGlob("src/ministers/*.md");
    const pages = [];
    for (const minister of ministers) {
      const slug = minister.fileSlug;
      const overflow = initiatives.filter((item) => item.data.minister === slug).slice(CARDS_PER_PAGE);
      if (!overflow.length) continue;
      const urlForPage = (i) => `/ministers/${slug}/page/${i + 2}/`;
      const chunks = buildPagedChunks(overflow, CARDS_PER_PAGE, urlForPage, `/ministers/${slug}/`);
      for (const chunk of chunks) pages.push({ minister, ...chunk });
    }
    return pages;
  });

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    if (!dateObj) return "";
    return DateTime.fromJSDate(new Date(dateObj), { zone: "utc" }).toFormat("d LLLL yyyy");
  });

  eleventyConfig.addFilter("isoDate", (dateObj) => {
    if (!dateObj) return "";
    return DateTime.fromJSDate(new Date(dateObj), { zone: "utc" }).toISODate();
  });

  // RFC-822 date format (e.g. "Tue, 25 Aug 2026 09:00:00 +0000") required by
  // RSS 2.0's <pubDate>/<lastBuildDate> -- used by src/feed.njk and
  // src/opinion-feed.njk.
  eleventyConfig.addFilter("rfc822Date", (dateObj) => {
    if (!dateObj) return "";
    return DateTime.fromJSDate(new Date(dateObj), { zone: "utc" }).toRFC2822();
  });

  eleventyConfig.addFilter("initials", (name) => {
    if (!name) return "";
    return name
      .split(/\s+/)
      .filter((w) => /[A-Za-z]/.test(w[0]))
      .map((w) => w[0].toUpperCase())
      .slice(0, 2)
      .join("");
  });

  eleventyConfig.addFilter("byMinister", (initiatives, ministerSlug) => {
    return (initiatives || []).filter((item) => item.data.minister === ministerSlug);
  });

  eleventyConfig.addFilter("slice", (arr, start, end) => (arr || []).slice(start, end));

  // Shallow-merges `extra` onto `obj`, returning a new object -- used to
  // add an optional key (e.g. JSON-LD's `isBasedOn`) onto a base object
  // literal built in a template, without writing out two near-duplicate
  // {% set %} blocks for the "field present" / "field absent" cases.
  eleventyConfig.addFilter("merge", (obj, extra) => Object.assign({}, obj, extra));

  // Builds a "*bold title*\n\nsummary\n\nurl" share message. `summary` and
  // `url` are each optional and omitted (with their separator) when blank —
  // used for WhatsApp's full message and Facebook's `quote` param.
  eleventyConfig.addFilter("shareText", (title, summary, url) => {
    // WhatsApp only renders *bold* when the asterisk touches a non-space
    // character, so a title with stray leading/trailing whitespace (some
    // CMS entries have it) silently breaks the formatting.
    const parts = [`*${(title || "").trim()}*`];
    if (summary) parts.push(summary.trim());
    if (url) parts.push(url);
    return parts.join("\n\n");
  });

  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  // Resizes/re-encodes a local image (poster, minister photo, etc.) into a
  // <picture> with WebP + JPEG/PNG sources at the given widths, so a card
  // thumbnail no longer ships the same full-size upload as the article's
  // hero image. `widths` and `sizes` should roughly match how large the
  // image actually renders in that spot (see call sites for the values
  // used for card grids vs. hero images vs. minister photos). Falls back
  // to a plain <img> for anything eleventy-img can't process -- a
  // non-local src, a missing file, or any other processing error -- so a
  // bad reference degrades gracefully instead of failing the build.
  eleventyConfig.addNunjucksAsyncShortcode(
    "responsiveImage",
    async function (src, alt, widths, sizes, loading, className) {
      const classAttr = className ? ` class="${className}"` : "";
      const fallback = () =>
        `<img${classAttr} src="${src}" alt="${String(alt || "").replace(/"/g, "&quot;")}" loading="${loading || "lazy"}">`;
      if (!src) return "";
      const inputPath = resolveImagePath(src);
      if (!inputPath) return fallback();
      try {
        // WebP only, deliberately no JPEG/PNG fallback: WebP support is
        // effectively universal on the mobile browsers this site's
        // WhatsApp-driven audience actually uses, and each extra format
        // doubles the file count -- Cloudflare Pages caps a deployment at
        // 20,000 files total (see docs/HANDOFF.md), so that multiplier
        // matters more here than marginal legacy-browser safety.
        const metadata = await eleventyImage.default(inputPath, {
          widths: widths || [400, 800],
          formats: ["webp"],
          outputDir: "_site/static/img/",
          urlPath: "/static/img/",
        });
        const htmlOptions = {
          alt: alt || "",
          sizes: sizes || "100vw",
          loading: loading || "lazy",
          decoding: "async",
        };
        if (className) htmlOptions.class = className;
        return eleventyImage.generateHTML(metadata, htmlOptions);
      } catch (err) {
        console.warn(`responsiveImage: couldn't optimize ${src} (${err.message}), using original`);
        return fallback();
      }
    }
  );

  // Renders the `{% youtube "VIDEO_ID" %}` shortcode the CMS's custom
  // "YouTube video" editor component writes into the markdown body (see
  // admin/index.html) as a responsive embed. Markdown content is processed
  // through Nunjucks before markdown-it (markdownTemplateEngine: "njk"),
  // and markdown-it's default `html: true` passes this raw <div> through
  // untouched, so it renders as a real embed rather than escaped text.
  eleventyConfig.addShortcode("youtube", (id) => {
    const cleanId = String(id || "").trim();
    if (!cleanId) return "";
    return `<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${cleanId}" title="YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
