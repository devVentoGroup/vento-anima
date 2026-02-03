import { COLORS } from "@/constants/colors"

// ANIMA palette tokens (derivados de /constants/colors)
export const PALETTE = {
  porcelain: COLORS.porcelain,
  porcelain2: COLORS.porcelainAlt,
  text: COLORS.text,
  accent: COLORS.accent,
  rose: COLORS.rosegold,
  roseGlow: COLORS.rosegoldBright, // glow oro rosa (no morado)
  neutral: COLORS.neutral,
  border: COLORS.border,
  white: COLORS.white,
} as const

export const RGBA = {
  // Marca super sutil en fondos
  washPink: "rgba(226, 0, 106, 0.06)", // accent @ 6%
  washRoseGlow: "rgba(242, 198, 192, 0.10)", // roseGlow @ 10%

  // Bordes de marca
  borderPink: "rgba(226, 0, 106, 0.35)",
  borderRose: "rgba(183, 110, 121, 0.38)",

  // Estados/CTA
  ctaDisabled: "rgba(27, 26, 31, 0.08)", // text @ 8%
  ctaHighlight: "rgba(242, 198, 192, 0.18)", // roseGlow @ 18%

  // Tint superior de cards (muy sutil)
  cardTint: "rgba(242, 198, 192, 0.12)", // roseGlow @ 12%
} as const
