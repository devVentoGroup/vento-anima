import React from "react"
import { Image, View } from "react-native"

interface AnimaLogoProps {
  size?: number
}

const LOGO = require("../assets/icon.png")

export function AnimaLogo({ size = 64 }: AnimaLogoProps) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Image
        source={LOGO}
        style={{ width: size, height: size, resizeMode: "contain" }}
        accessibilityLabel="ANIMA"
      />
    </View>
  )
}
