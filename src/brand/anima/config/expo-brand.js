const {
  APP_VARIANT,
  IS_DEVELOPMENT,
  EXPO_BASE_BRAND,
  selectExpoVariant,
} = require("../../base/config/expo-brand.js");

const EXPO_ANIMA_BRAND = {
  ...EXPO_BASE_BRAND,
  slug: "anima",
  variants: {
    ...EXPO_BASE_BRAND.variants,
    development: {
      ...EXPO_BASE_BRAND.variants.development,
      appName: "ANIMA Dev",
      scheme: "anima-dev",
      iosBundleId: "com.vento.anima.dev",
      androidPackage: "com.vento.anima.dev",
      appUpdateKey: "vento_anima_dev",
    },
    production: {
      ...EXPO_BASE_BRAND.variants.production,
      appName: "ANIMA",
      scheme: "anima",
      iosBundleId: "com.vento.anima",
      androidPackage: "com.vento.anima",
      appUpdateKey: "vento_anima",
    },
  },
  expoProjectId: "2e1ba93a-039d-49e7-962d-a33ea7eaf9b3",
};

const selectedVariant = selectExpoVariant(EXPO_ANIMA_BRAND);

module.exports = {
  APP_VARIANT,
  IS_DEVELOPMENT,
  EXPO_ANIMA_BRAND,
  selectedVariant,
};
