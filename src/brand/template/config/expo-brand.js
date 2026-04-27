const { EXPO_BASE_BRAND, selectExpoVariant } = require("../../base/config/expo-brand.js")

const EXPO_TEMPLATE_BRAND = {
  ...EXPO_BASE_BRAND,
  slug: "template-app",
  variants: {
    ...EXPO_BASE_BRAND.variants,
    development: {
      ...EXPO_BASE_BRAND.variants.development,
      appName: "Template App Dev",
      scheme: "template-app-dev",
      iosBundleId: "com.vento.template.dev",
      androidPackage: "com.vento.template.dev",
      appUpdateKey: "template_app_dev",
    },
    production: {
      ...EXPO_BASE_BRAND.variants.production,
      appName: "Template App",
      scheme: "template-app",
      iosBundleId: "com.vento.template",
      androidPackage: "com.vento.template",
      appUpdateKey: "template_app",
    },
  },
  expoProjectId: "template-project-id",
}

const selectedVariant = selectExpoVariant(EXPO_TEMPLATE_BRAND)

module.exports = {
  EXPO_TEMPLATE_BRAND,
  selectedVariant,
}
