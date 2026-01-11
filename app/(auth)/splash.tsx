import { useEffect, useMemo, useRef } from "react"
import { View, Text, StyleSheet, Dimensions } from "react-native"
import { useRouter } from "expo-router"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withRepeat,
  cancelAnimation,
  Easing,
  runOnJS,
} from "react-native-reanimated"

import { AnimaLogo } from "@/components/anima-logo"
import { COLORS } from "@/constants/colors"
import { useAuth } from "@/contexts/auth-context"

type Star = { id: string; x: number; y: number; size: number; opacity: number }

const mulberry32 = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a += 0x6D2B79F5
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function SplashScreen() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  const startedRef = useRef(false)
  const navDoneRef = useRef(false)
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userRef = useRef(user)
  useEffect(() => {
    userRef.current = user
  }, [user])

  const { width: W, height: H } = Dimensions.get("window")

  const stars = useMemo<Star[]>(() => {
    const rand = mulberry32(1337)
    const count = 44
    return Array.from({ length: count }).map((_, i) => {
      const size = 1 + rand() * 2
      return {
        id: `s-${i}`,
        x: Math.floor(rand() * W),
        y: Math.floor(rand() * H),
        size,
        opacity: 0.05 + rand() * 0.14,
      }
    })
  }, [W, H])

  // Animaciones base
  const logoScale = useSharedValue(0.92)
  const logoOpacity = useSharedValue(0)
  const textOpacity = useSharedValue(0)
  const textTranslateY = useSharedValue(18)

  const ringScale = useSharedValue(0.86)
  const ringOpacity = useSharedValue(0)
  const ring2Scale = useSharedValue(0.72)
  const ring2Opacity = useSharedValue(0)

  // Futurista
  const ringRotate = useSharedValue(0)
  const ring2Rotate = useSharedValue(0)

  const glowScale = useSharedValue(0.9)
  const glowOpacity = useSharedValue(0)

  const scanOpacity = useSharedValue(0)
  const scanTranslateY = useSharedValue(-120)

  // Salida
  const containerOpacity = useSharedValue(1)
  const containerScale = useSharedValue(1)

  useEffect(() => {
    if (isLoading) return
    if (startedRef.current) return
    startedRef.current = true

    const goNext = () => {
      if (navDoneRef.current) return
      navDoneRef.current = true

      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current)
        safetyTimerRef.current = null
      }

      const nextPath = userRef.current ? "/(app)/home" : "/(auth)/login"
      router.replace(nextPath)
    }

    // Timeout de seguridad: si Reanimated no llama el callback, igual navegamos
    safetyTimerRef.current = setTimeout(goNext, 5200)

    // Entrada: logo
    logoOpacity.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) })
    logoScale.value = withSpring(1, { damping: 14, stiffness: 130 })

    // Anillos
    ringOpacity.value = withDelay(220, withTiming(0.55, { duration: 420 }))
    ringScale.value = withDelay(
      220,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }),
    )

    ring2Opacity.value = withDelay(360, withTiming(0.33, { duration: 420 }))
    ring2Scale.value = withDelay(
      360,
      withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
    )

    // Texto
    textOpacity.value = withDelay(720, withTiming(1, { duration: 520 }))
    textTranslateY.value = withDelay(720, withSpring(0, { damping: 16 }))

    // Glow (breathing)
    glowOpacity.value = withDelay(260, withTiming(0.35, { duration: 520 }))
    glowScale.value = withDelay(
      260,
      withRepeat(
        withTiming(1.06, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    )

    // Rotación lenta de anillos
    ringRotate.value = withDelay(
      260,
      withRepeat(withTiming(360, { duration: 9000, easing: Easing.linear }), -1, false),
    )
    ring2Rotate.value = withDelay(
      260,
      withRepeat(withTiming(-360, { duration: 12000, easing: Easing.linear }), -1, false),
    )

    // Scanline muy sutil (sensación tech)
    scanOpacity.value = withDelay(520, withTiming(0.10, { duration: 360 }))
    scanTranslateY.value = withDelay(
      520,
      withRepeat(withTiming(H + 120, { duration: 4200, easing: Easing.linear }), -1, false),
    )

    // Salida
    containerOpacity.value = withDelay(2500, withTiming(0, { duration: 420 }))
    containerScale.value = withDelay(
      2500,
      withTiming(1.05, { duration: 420 }, () => {
        runOnJS(goNext)()
      }),
    )

    return () => {
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current)
        safetyTimerRef.current = null
      }

      cancelAnimation(glowScale)
      cancelAnimation(ringRotate)
      cancelAnimation(ring2Rotate)
      cancelAnimation(scanTranslateY)
    }

  }, [isLoading, user, router, H])

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    transform: [{ scale: containerScale.value }],
  }))

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }))

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }))

  const ringAnimatedStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }, { rotate: `${ringRotate.value}deg` }],
  }))

  const ring2AnimatedStyle = useAnimatedStyle(() => ({
    opacity: ring2Opacity.value,
    transform: [{ scale: ring2Scale.value }, { rotate: `${ring2Rotate.value}deg` }],
  }))

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }))

  const scanAnimatedStyle = useAnimatedStyle(() => ({
    opacity: scanOpacity.value,
    transform: [{ translateY: scanTranslateY.value }],
  }))

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle]}>
      {/* Fondo futurista */}
      <View style={styles.backgroundDecoration}>
        {stars.map((s) => (
          <View
            key={s.id}
            style={[
              styles.star,
              {
                left: s.x,
                top: s.y,
                width: s.size,
                height: s.size,
                opacity: s.opacity,
              },
            ]}
          />
        ))}

        <View style={[styles.decorCircle, styles.decorCircle1]} />
        <View style={[styles.decorCircle, styles.decorCircle2]} />
        <View style={[styles.decorCircle, styles.decorCircle3]} />
        {/* Marco tipo credencial (doble línea curva en esquinas) */}
        <View pointerEvents="none" style={styles.cornerLayer}>
          <View style={[styles.cornerOuter, styles.cornerTL]} />
          <View style={[styles.cornerInner, styles.cornerTLInner]} />

          <View style={[styles.cornerOuter, styles.cornerTR]} />
          <View style={[styles.cornerInner, styles.cornerTRInner]} />

          <View style={[styles.cornerOuter, styles.cornerBL]} />
          <View style={[styles.cornerInner, styles.cornerBLInner]} />

          <View style={[styles.cornerOuter, styles.cornerBR]} />
          <View style={[styles.cornerInner, styles.cornerBRInner]} />
        </View>

        <Animated.View style={[styles.scanLine, scanAnimatedStyle]} />
      </View>

      {/* Logo + anillos */}
      <View style={styles.logoContainer}>
        <Animated.View style={[styles.glow, glowAnimatedStyle]} />
        <Animated.View style={[styles.ring, ringAnimatedStyle]} />
        <Animated.View style={[styles.ring2, ring2AnimatedStyle]} />

        {/* Medallón neutro para separar el logo del fondo */}
        <View style={styles.medallion} />
        <View style={styles.medallionBorder} />

        <Animated.View style={[styles.logoHero, logoAnimatedStyle]}>
          <AnimaLogo size={140} />
        </Animated.View>
      </View>

      {/* Texto */}
      <Animated.View style={[styles.textContainer, textAnimatedStyle]}>
        <Text style={styles.title}>ANIMA</Text>
        <Text style={styles.subtitle}>Control de Asistencia</Text>
      </Animated.View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Una solución de</Text>
        <Text style={styles.footerBrand}>Vento Group</Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.porcelain,
    alignItems: "center",
    justifyContent: "center",
  },

  backgroundDecoration: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },

  star: {
    position: "absolute",
    borderRadius: 99,
    backgroundColor: COLORS.text,
  },

  decorCircle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: COLORS.rosegoldBright,
    opacity: 0.10,
  },
  decorCircle1: {
    width: 360,
    height: 360,
    top: -140,
    right: -140,
  },
  decorCircle2: {
    width: 260,
    height: 260,
    bottom: -90,
    left: -90,
    opacity: 0.08,
  },
  decorCircle3: {
    width: 180,
    height: 180,
    top: 90,
    left: -60,
    opacity: 0.06,
  },

  scanLine: {
    position: "absolute",
    left: -40,
    right: -40,
    height: 2,
    backgroundColor: COLORS.rosegold,
    opacity: 0.06,
  },

  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 230,
    height: 230,
  },

  glow: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: COLORS.accent,
    opacity: 0.10, // más sutil para que no compita con el logo
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 34,
    elevation: 10,
  },

  ring: {
    position: "absolute",
    width: 198,
    height: 198,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: COLORS.rosegold,
  },
  ring2: {
    position: "absolute",
    width: 172,
    height: 172,
    borderRadius: 86,
    borderWidth: 1,
    borderColor: COLORS.accent,
    opacity: 0.45,
  },
  // Medallón neutro (separa el logo del glow/tono rosado)
  medallion: {
    position: "absolute",
    width: 156,
    height: 156,
    borderRadius: 78,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 6,
  },
  medallionBorder: {
    position: "absolute",
    width: 156,
    height: 156,
    borderRadius: 78,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },

  // Marco tipo credencial (doble línea curva en cada esquina)
  cornerLayer: {
    ...StyleSheet.absoluteFillObject,
  },

  cornerOuter: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 28,
    borderColor: COLORS.rosegold,
    opacity: 0.16,
  },
  cornerInner: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 22,
    borderColor: COLORS.rosegold,
    opacity: 0.10,
  },

  // Top Left
  cornerTL: {
    top: 70,
    left: 26,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTLInner: {
    top: 84,
    left: 40,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },

  // Top Right
  cornerTR: {
    top: 70,
    right: 26,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTRInner: {
    top: 84,
    right: 40,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },

  // Bottom Left
  cornerBL: {
    bottom: 70,
    left: 26,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBLInner: {
    bottom: 84,
    left: 40,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },

  // Bottom Right
  cornerBR: {
    bottom: 70,
    right: 26,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  cornerBRInner: {
    bottom: 84,
    right: 40,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  logoHero: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.10,
    shadowRadius: 28,
    elevation: 8,
  },

  textContainer: {
    marginTop: 34,
    alignItems: "center",
  },
  title: {
    fontSize: 38,
    fontWeight: "300",
    letterSpacing: 10,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.neutral,
    marginTop: 8,
    letterSpacing: 2,
  },

  footer: {
    position: "absolute",
    bottom: 50,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: COLORS.neutral,
    opacity: 0.7,
  },
  footerBrand: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 2,
  },
})
