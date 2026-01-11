// app.config.js
import "dotenv/config";

export default {
  expo: {
    name: "ANIMA",
    // Recomendación de estándar: alinear slug con scheme y repo
    slug: "vento-anima",
    scheme: "vento-anima",
    version: "1.0.0",
    platforms: ["ios", "android", "web"],
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#F7F5F8",
    },
    assetBundlePatterns: ["**/*"],

    ios: {
      // En Expo el campo estándar es supportsTablet (no supportsTabletMode)
      supportsTablet: true,
      bundleIdentifier: "com.vento.anima",
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "Necesitamos tu ubicacion para validar el check-in.",
      },
      // Opcional recomendado para releases iOS
      buildNumber: "1",
    },

    android: {
      package: "com.vento.anima",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#F7F5F8",
      },
      permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
      // Opcional recomendado para releases Android
      versionCode: 1,
    },

    web: {
      favicon: "./assets/favicon.png",
      output: "single",
      bundler: "metro",
    },

    plugins: [
      "expo-router",
      "expo-secure-store",
      [
        "expo-screen-orientation",
        {
          initialOrientation: "PORTRAIT",
        },
      ],
    ],

    extra: {
      router: {},
      eas: {
        projectId: "2e1ba93a-039d-49e7-962d-a33ea7eaf9b3",
      },
    },
  },
};
