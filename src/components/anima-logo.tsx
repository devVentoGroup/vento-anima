import React from "react"
import { Image, View } from "react-native"

import { ANIMA_BRAND } from "@/brand/anima/config/app-brand"

interface AnimaLogoProps {
  size?: number
  tintColor?: string
}

const LOGO = require("../../assets/icon.png")

export function AnimaLogo({ size = 64, tintColor }: AnimaLogoProps) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Image
        source={LOGO}
        style={{ width: size, height: size, resizeMode: "contain", tintColor }}
        accessibilityLabel={ANIMA_BRAND.logoAccessibilityLabel}
      />
    </View>
  )
}
