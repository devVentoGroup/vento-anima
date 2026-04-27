import { BASE_BRAND } from "@/brand/base/config/app-brand"

export const TEMPLATE_BRAND = {
  ...BASE_BRAND,
  appName: "Template App",
  appSubtitle: "Operaciones",
  logoAccessibilityLabel: "Template App",
} as const

export type TemplateBrand = typeof TEMPLATE_BRAND
