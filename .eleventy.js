const { DateTime } = require("luxon");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/static": "static" });
  eleventyConfig.addPassthroughCopy({ admin: "admin" });
  eleventyConfig.addPassthroughCopy("src/uploads");

  eleventyConfig.addCollection("initiatives", (collectionApi) => {
    return collectionApi.getFilteredByGlob("src/initiatives/*.md").sort((a, b) => {
      return (b.data.date ? new Date(b.data.date) : 0) - (a.data.date ? new Date(a.data.date) : 0);
    });
  });

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    if (!dateObj) return "";
    return DateTime.fromJSDate(new Date(dateObj), { zone: "utc" }).toFormat("d LLLL yyyy");
  });

  eleventyConfig.addFilter("isoDate", (dateObj) => {
    if (!dateObj) return "";
    return DateTime.fromJSDate(new Date(dateObj), { zone: "utc" }).toISODate();
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
