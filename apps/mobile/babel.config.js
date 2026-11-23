module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    // Drizzle migrations import .sql files; this bundles them into the app as strings.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
