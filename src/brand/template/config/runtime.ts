import { BASE_RUNTIME } from "@/brand/base/config/runtime"

export const TEMPLATE_RUNTIME = {
  ...BASE_RUNTIME,
  expoProjectId: "template-project-id",
  appUpdateKeys: {
    ...BASE_RUNTIME.appUpdateKeys,
    development: "template_app_dev",
    production: "template_app",
  },
  authRedirectUrl: "https://template.ventogroup.co/api/set-password",
} as const

export function getTemplateAppUpdateKey(isDevelopment: boolean) {
  return isDevelopment
    ? TEMPLATE_RUNTIME.appUpdateKeys.development
    : TEMPLATE_RUNTIME.appUpdateKeys.production
}
