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
