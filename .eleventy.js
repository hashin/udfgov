const { DateTime } = require("luxon");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/static": "static" });
  eleventyConfig.addPassthroughCopy({ admin: "admin" });
  eleventyConfig.addPassthroughCopy("src/uploads");

  eleventyConfig.addCollection("initiatives", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/initiatives/*.md")
      .filter((item) => !item.data.draft)
      .sort((a, b) => {
        return (b.data.date ? new Date(b.data.date) : 0) - (a.data.date ? new Date(a.data.date) : 0);
      });
  });

  eleventyConfig.addCollection("ministers", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/ministers/*.md")
      .sort((a, b) => (a.data.order ?? 99) - (b.data.order ?? 99));
  });

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    if (!dateObj) return "";
    return DateTime.fromJSDate(new Date(dateObj), { zone: "utc" }).toFormat("d LLLL yyyy");
  });

  eleventyConfig.addFilter("isoDate", (dateObj) => {
    if (!dateObj) return "";
    return DateTime.fromJSDate(new Date(dateObj), { zone: "utc" }).toISODate();
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

  // Groups initiatives into [{ year, months: [{ month, monthLabel, items }] }],
  // both levels sorted newest-first, for the /archive/ page.
  eleventyConfig.addFilter("groupByYearMonth", (initiatives) => {
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
      .map((year) => ({
        year,
        months: Array.from(years.get(year).values()).sort((a, b) => b.month - a.month),
      }));
  });

  // Groups initiatives into [{ ministry, items }], ministries alphabetical,
  // items without a ministry set are grouped under "Unassigned" at the end.
  eleventyConfig.addFilter("groupByMinistry", (initiatives) => {
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
    return keys.map((ministry) => ({ ministry, items: groups.get(ministry) }));
  });

  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

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
