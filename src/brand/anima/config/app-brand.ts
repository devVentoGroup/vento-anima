import { BASE_BRAND } from "@/brand/base/config/app-brand"

export const ANIMA_BRAND = {
  ...BASE_BRAND,
  appName: "ANIMA",
  appSubtitle: "Control de Asistencia",
  logoAccessibilityLabel: "ANIMA",
} as const

export type AnimaBrand = typeof ANIMA_BRAND
