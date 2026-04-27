import { BASE_RUNTIME } from "@/brand/base/config/runtime"

export const ANIMA_RUNTIME = {
  ...BASE_RUNTIME,
  expoProjectId: "2e1ba93a-039d-49e7-962d-a33ea7eaf9b3",
  appUpdateKeys: {
    ...BASE_RUNTIME.appUpdateKeys,
    development: "vento_anima_dev",
    production: "vento_anima",
  },
  authRedirectUrl:
    process.env.EXPO_PUBLIC_ANIMA_AUTH_REDIRECT_URL ??
    "https://anima.ventogroup.co/api/set-password",
} as const;

export function getAnimaAppUpdateKey(isDevelopment: boolean) {
  return isDevelopment
    ? ANIMA_RUNTIME.appUpdateKeys.development
    : ANIMA_RUNTIME.appUpdateKeys.production;
}
