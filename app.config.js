module.exports = {
  expo: {
    name: "ANIMA",
    slug: "anima",
    scheme: "anima",
    version: "1.0.1",
    jsEngine: "hermes",
    privacyPolicyUrl: "https://clzdpinthhtknkmefsxx.supabase.co/storage/v1/object/public/public-documents/POLITICA%20TRATAMIENTO%20DE%20DATOS%20VENTO.pdf",
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
      supportsTablet: true,
      bundleIdentifier: "com.vento.anima",
      buildNumber: "2",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Necesitamos tu ubicación para validar el check-in.",
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    android: {
      package: "com.vento.anima",
      versionCode: 2,
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon-padded.png",
        backgroundColor: "#F7F5F8"
      },
      permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "POST_NOTIFICATIONS"]
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-notifications"
    ],
    extra: {
      router: {},
      eas: {
        projectId: "2e1ba93a-039d-49e7-962d-a33ea7eaf9b3"
      }
    }
  }
};

