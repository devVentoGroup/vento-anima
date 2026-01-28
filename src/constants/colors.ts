export const COLORS = {
  // Core surfaces
  porcelain: "#F7F5F8",
  porcelainAlt: "#F2EEF2",
  white: "#FFFFFF",
  surface: "#FFFFFF", // alias explícito para cards y sheets

  // Typography
  text: "#1B1A1F",
  neutral: "#9E9AA6",
  textMuted: "#9E9AA6", // alias explícito

  // Brand accents (ANIMA)
  accent: "#E2006A", // primary action, active tab, highlights
  accentSoft: "#FCE7F3", // fondos suaves de chips/selected/hover

  // Rose gold (secondary)
  rosegold: "#B76E79",
  rosegoldBright: "#F2C6C0",
  roseGoldGlow: "#F2C6C0", // alias explícito

  // Legacy (mantener para no romper imports)
  // NOTE: el nombre "Violet" queda por compatibilidad, pero el valor NO es morado.
  accentViolet: "#F2C6C0",

  // UI structure
  border: "#E6E1EA",
  borderSoft: "#EFEAF2",

  // States (para “Bloqueada”, “Alerta”, etc.)
  disabledText: "#9E9AA6",
  disabledBg: "#F2EEF2",

  // Semantic (útiles para chips y badges)
  info: "#2563EB",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",

  // Shadows
  shadow: "#1B1A1F",
} as const;
