import { useEffect, useMemo, useRef, useState } from "react"
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Pressable,
  ScrollView,
  TouchableOpacity,
} from "react-native"
import type { TextInput as RNTextInput } from "react-native"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  cancelAnimation,
  Easing,
} from "react-native-reanimated"
import { useRouter } from "expo-router"

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

export default function LoginScreen() {
  const { signIn } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const passwordRef = useRef<RNTextInput>(null)

  const { width: W, height: H } = Dimensions.get("window")

  const stars = useMemo<Star[]>(() => {
    const rand = mulberry32(2026)
    const count = 40
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

  // Animación de entrada (premium, sutil)
  const headerOpacity = useSharedValue(0)
  const headerTranslateY = useSharedValue(14)
  const cardOpacity = useSharedValue(0)
  const cardTranslateY = useSharedValue(22)
  const scanOpacity = useSharedValue(0)
  const scanTranslateY = useSharedValue(-120)

  useEffect(() => {
    headerOpacity.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) })
    headerTranslateY.value = withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) })

    cardOpacity.value = withDelay(120, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }))
    cardTranslateY.value = withDelay(120, withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) }))

    scanOpacity.value = withDelay(300, withTiming(0.08, { duration: 300 }))
    scanTranslateY.value = withDelay(
      300,
      withRepeat(withTiming(H + 120, { duration: 5200, easing: Easing.linear }), -1, false),
    )

    return () => {
      cancelAnimation(scanTranslateY)
    }
  }, [H, headerOpacity, headerTranslateY, cardOpacity, cardTranslateY, scanOpacity, scanTranslateY])

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
  }))

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }))

  const scanStyle = useAnimatedStyle(() => ({
    opacity: scanOpacity.value,
    transform: [{ translateY: scanTranslateY.value }],
  }))

  const handleLogin = async () => {
    if (!email || !password || loading) return
    setLoading(true)
    setErrorMsg(null)

    try {
      await signIn(email.trim(), password)
    } catch (e: any) {
      const msg = (e?.message || "").toLowerCase()

      // Mensajes humanos (ajústalos si tu backend devuelve otros textos)
      if (msg.includes("invalid") || msg.includes("credentials") || msg.includes("password")) {
        setErrorMsg("Correo o contraseña incorrectos.")
      } else if (msg.includes("network") || msg.includes("fetch") || msg.includes("connection")) {
        setErrorMsg("No pudimos conectar. Revisa tu internet e inténtalo de nuevo.")
      } else {
        setErrorMsg("No pudimos iniciar sesión. Intenta nuevamente.")
      }
    } finally {
      setLoading(false)
    }
  }
  const canSubmit = !!email && !!password && !loading
  const Container: any = KeyboardAvoidingView
  const containerProps = {
    behavior: Platform.OS === "ios" ? "padding" : "height",
    keyboardVerticalOffset: 0,
    style: styles.root,
  }

  return (
    <Container {...containerProps}>
      {/* Fondo futurista sutil */}
      <View pointerEvents="none" style={styles.background}>
        {stars.map((s) => (
          <View
            key={s.id}
            style={[
              styles.star,
              { left: s.x, top: s.y, width: s.size, height: s.size, opacity: s.opacity },
            ]}
          />
        ))}
        <View pointerEvents="none" style={styles.auroraBeam1} />
        <View pointerEvents="none" style={styles.auroraBeam2} />
        <View pointerEvents="none" style={styles.vignette} />

        <Animated.View style={[styles.scanLine, scanStyle]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.header, headerStyle]}>
          <View style={styles.logoWrap}>
            <View style={styles.logoHalo} />
            <AnimaLogo size={180} />
          </View>

          <Text style={styles.title}>ANIMA</Text>
          <Text style={styles.subtitle}>Control de Asistencia</Text>
        </Animated.View>

        {/* Card */}
        <Animated.View style={[styles.cardShell, cardStyle]}>
          <View style={styles.cardGlass} />
          <View style={styles.cardInner}>
            <Text style={styles.cardTitle}>Ingresar</Text>
            <Text style={styles.cardHint}>Usa las credenciales proporcionadas por tu empleador</Text>


            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                placeholder="tu@email.com"
                value={email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                textContentType="username"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                placeholderTextColor={COLORS.neutral}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                onChangeText={(t) => {
                  setEmail(t)
                  if (errorMsg) setErrorMsg(null)
                }}
                style={[styles.input, emailFocused && styles.inputFocused]}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  ref={passwordRef}
                  placeholder="••••••••"
                  value={password}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  onChangeText={(t) => {
                    setPassword(t)
                    if (errorMsg) setErrorMsg(null)
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  textContentType="password"
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  placeholderTextColor={COLORS.neutral}
                  style={[styles.input, styles.passwordInput, passwordFocused && styles.inputFocused]}
                />

                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  style={({ pressed }) => [styles.showButton, pressed ? { opacity: 0.85 } : null]}
                  hitSlop={10}
                >
                  <Text style={styles.showButtonText}>{showPassword ? "Ocultar" : "Mostrar"}</Text>
                </Pressable>
              </View>
            </View>
            <Pressable
              onPress={handleLogin}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.primaryButton,
                !canSubmit && styles.primaryButtonDisabled,
                pressed && canSubmit ? styles.primaryButtonPressed : null,
              ]}
            >
              <View style={styles.primaryButtonInner}>
                <Text style={styles.primaryButtonText}>Iniciar Sesión</Text>
                {loading ? <ActivityIndicator size="small" color={COLORS.white} /> : null}
              </View>
            </Pressable>

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <TouchableOpacity
              onPress={() => router.push("/invite")}
              style={styles.inviteLink}
            >
              <Text style={styles.inviteLinkText}>Tengo un codigo de invitacion</Text>
            </TouchableOpacity>

            <Text style={styles.footerNote}>
              Si tienes problemas para ingresar, solicita soporte a tu administrador.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </Container>
  )
}
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.porcelain,
  },

  background: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    backgroundColor: COLORS.porcelain,
  },
  star: {
    position: "absolute",
    borderRadius: 99,
    backgroundColor: COLORS.text,
  },
  auroraBeam1: {
    position: "absolute",
    width: 520,
    height: 180,
    borderRadius: 999,
    top: -60,
    left: -180,
    backgroundColor: COLORS.accentViolet,
    opacity: 0.10,
    transform: [{ rotate: "-12deg" }],
  },
  auroraBeam2: {
    position: "absolute",
    width: 460,
    height: 170,
    borderRadius: 999,
    bottom: -80,
    right: -220,
    backgroundColor: COLORS.accent,
    opacity: 0.08,
    transform: [{ rotate: "14deg" }],
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.025)",
  },

  scanLine: {
    position: "absolute",
    left: -40,
    right: -40,
    height: 2,
    backgroundColor: COLORS.rosegold,
    opacity: 0.06,
  },

  page: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 64,
    paddingBottom: 34,
    justifyContent: "center",
  },

  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoHalo: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.accent,
    opacity: 0.10,
    transform: [{ scaleX: 1.05 }, { scaleY: 0.85 }],
  },

  title: {
    fontSize: 36,
    fontWeight: "500",
    letterSpacing: 7,
    color: COLORS.text,
    marginTop: 10,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
    letterSpacing: 0.6,
    color: "rgba(46, 16, 101, 0.70)",
  },

  cardShell: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.10,
    shadowRadius: 28,
    elevation: 8,
    backgroundColor: "rgba(255,255,255,0.22)",
  },

  cardGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.26)",
  },

  cardInner: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
  },


  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  cardHint: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 6,
    marginBottom: 14,
  },

  field: {
    marginTop: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },

  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(46, 16, 101, 0.12)",
    color: COLORS.text,
    fontSize: 14,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  passwordRow: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 92,
  },
  showButton: {
    position: "absolute",
    right: 10,
    top: "50%",
    marginTop: -16,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "rgba(226, 0, 106, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(226, 0, 106, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  showButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.accent,
    letterSpacing: 0.3,
  },
  inputFocused: {
    borderColor: "rgba(226, 0, 106, 0.35)",
    shadowColor: COLORS.accent,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },

  primaryButtonPressed: {
    transform: [{ scale: 0.985 }],
  },
  primaryButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  errorText: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(140, 20, 60, 0.95)",
    textAlign: "center",
    fontWeight: "600",
  },

  primaryButton: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 8,
  },

  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.white,
    letterSpacing: 0.2,
  },

  footerNote: {
    marginTop: 14,
    fontSize: 12,
    color: COLORS.neutral,
    textAlign: "center",
  },
  inviteLink: {
    marginTop: 12,
    alignSelf: "center",
  },
  inviteLinkText: {
    color: COLORS.accent,
    fontWeight: "700",
  },
})
