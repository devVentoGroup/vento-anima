export const BASE_RUNTIME = {
  expoProjectId: "",
  appUpdateKeys: {
    development: "",
    production: "",
  },
  authRedirectUrl: "",
} as const

export type BaseRuntime = typeof BASE_RUNTIME
