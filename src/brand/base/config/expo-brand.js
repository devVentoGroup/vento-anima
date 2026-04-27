const APP_VARIANT = process.env.APP_VARIANT ?? "production";
const IS_DEVELOPMENT = APP_VARIANT === "development";

const EXPO_BASE_BRAND = {
  slug: "vento-app",
  variants: {
    development: {
      appName: "Vento App Dev",
      scheme: "vento-app-dev",
      iosBundleId: "com.vento.app.dev",
      androidPackage: "com.vento.app.dev",
      appUpdateKey: "vento_app_dev",
    },
    production: {
      appName: "Vento App",
      scheme: "vento-app",
      iosBundleId: "com.vento.app",
      androidPackage: "com.vento.app",
      appUpdateKey: "vento_app",
    },
  },
  expoProjectId: "",
};

function selectExpoVariant(brandConfig) {
  return IS_DEVELOPMENT
    ? brandConfig.variants.development
    : brandConfig.variants.production;
}

module.exports = {
  APP_VARIANT,
  IS_DEVELOPMENT,
  EXPO_BASE_BRAND,
  selectExpoVariant,
};
