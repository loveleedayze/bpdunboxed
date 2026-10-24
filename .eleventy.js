module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "content/blog/uploads": "uploads" });

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    const date = new Date(dateObj);
    // Frontmatter dates parse to UTC midnight; format in UTC too, otherwise
    // timezones behind UTC render the previous day.
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  });

  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    return new Date(dateObj).toISOString().split("T")[0];
  });

  // RFC 822 dates for the RSS feed (Substack's importer reads these).
  eleventyConfig.addFilter("rssDate", (dateObj) => new Date(dateObj).toUTCString());

  // Feed readers and importers can't resolve root-relative links like
  // /blog/foo/, so rewrite href/src to absolute URLs inside feed content.
  eleventyConfig.addFilter("absoluteUrls", (html, siteUrl) =>
    (html || "").replace(/(href|src)="\/(?!\/)/g, `$1="${siteUrl}/`)
  );

  return {
    dir: {
      input: "content/blog",
      includes: "_includes",
      output: "blog",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
