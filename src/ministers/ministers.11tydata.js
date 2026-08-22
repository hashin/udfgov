module.exports = {
  eleventyComputed: {
    title: (data) => `${data.name} — Council of Ministers`,
    description: (data) =>
      data.portfolios ? `${data.name}, ${data.designation}: ${data.portfolios}` : `${data.name}, ${data.designation}`,
    image: (data) => data.photo || undefined,
  },
};
