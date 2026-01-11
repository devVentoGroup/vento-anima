// babel.config.js
module.exports = function (api) {
  api.cache(true);

  const plugins = [
    [
      "module-resolver",
      {
        alias: {
          "@": "./src",
        },
        extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
      },
    ],
  ];

  // Reanimated (solo si existe en el proyecto)
  let hasReanimated = false;
  try {
    require.resolve("react-native-reanimated");
    hasReanimated = true;
  } catch (_) { }

  // IMPORTANTE: Reanimated plugin debe ir de último
  if (hasReanimated) {
    plugins.push("react-native-reanimated/plugin");
  }

  return {
    presets: ["babel-preset-expo"],
    plugins,
  };
};