module.exports = () => {
  const APP_VARIANT = process.env.APP_VARIANT ?? "production";
  const IS_DEVELOPMENT = APP_VARIANT === "development";

  const APP_NAME = IS_DEVELOPMENT ? "ANIMA Dev" : "ANIMA";
  const APP_SCHEME = IS_DEVELOPMENT ? "anima-dev" : "anima";
  const IOS_BUNDLE_ID = IS_DEVELOPMENT ? "com.vento.anima.dev" : "com.vento.anima";
  const ANDROID_PACKAGE = IS_DEVELOPMENT ? "com.vento.anima.dev" : "com.vento.anima";
  const APP_UPDATE_KEY = IS_DEVELOPMENT ? "vento_anima_dev" : "vento_anima";
  const SENTRY_ORG = process.env.SENTRY_ORG ?? "vento-group";
  const SENTRY_PROJECT = process.env.SENTRY_PROJECT ?? "vento-anima-mobile";

  return {
    expo: {
      name: APP_NAME,
      slug: "anima",
      platforms: ["ios", "android"],
      scheme: APP_SCHEME,
      version: "1.1.3",
      jsEngine: "hermes",
      orientation: "portrait",
      icon: "./assets/icon-padded.png",
      userInterfaceStyle: "light",
      splash: {
        image: "./assets/splash.png",
        resizeMode: "contain",
        backgroundColor: "#F7F5F8"
      },
      assetBundlePatterns: ["**/*"],
      ios: {
        icon: "./assets/icon-padded.png",
        supportsTablet: false,
        bundleIdentifier: IOS_BUNDLE_ID,
        buildNumber: "8",
        infoPlist: {
          NSLocationWhenInUseUsageDescription: "Necesitamos tu ubicacion para validar el check-in.",
          ITSAppUsesNonExemptEncryption: false
        }
      },
      android: {
        package: ANDROID_PACKAGE,
        versionCode: 12,
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon-padded.png",
          backgroundColor: "#F7F5F8"
        },
        permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "POST_NOTIFICATIONS"]
      },
      plugins: [
        "expo-router",
        "expo-secure-store",
        "expo-notifications",
        [
          "@sentry/react-native/expo",
          {
            organization: SENTRY_ORG,
            project: SENTRY_PROJECT,
          },
        ]
      ],
      updates: {
        url: "https://u.expo.dev/2e1ba93a-039d-49e7-962d-a33ea7eaf9b3"
      },
      runtimeVersion: {
        policy: "appVersion"
      },
      extra: {
        appVariant: APP_VARIANT,
        appUpdateKey: APP_UPDATE_KEY,
        router: {},
        eas: {
          projectId: "2e1ba93a-039d-49e7-962d-a33ea7eaf9b3"
        }
      }
    }
  };
};
