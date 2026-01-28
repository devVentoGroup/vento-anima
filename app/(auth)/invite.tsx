import { useState } from "react"
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { COLORS } from "@/constants/colors"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"

export default function InviteScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { signIn } = useAuth()

  const [token, setToken] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleAccept = async () => {
    if (!token.trim()) {
      Alert.alert("Invitacion", "Escribe el codigo de invitacion.")
      return
    }
    if (!password || password.length < 8) {
      Alert.alert("Invitacion", "La contrasena debe tener al menos 8 caracteres.")
      return
    }
    if (password !== confirmPassword) {
      Alert.alert("Invitacion", "Las contrasenas no coinciden.")
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke(
        "staff-invitations-accept",
        {
          body: { token: token.trim(), password },
        },
      )
      if (error) throw error

      if (data?.email) {
        await signIn(data.email, password)
      } else {
        Alert.alert(
          "Invitacion",
          "Cuenta creada. Inicia sesion con el correo invitado.",
        )
        router.replace("/login")
      }
    } catch (err) {
      console.error("Invite accept error:", err)
      Alert.alert("Invitacion", "No se pudo activar la invitacion.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: Math.max(24, insets.top + 16),
          paddingBottom: Math.max(24, insets.bottom + 24),
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Activar invitacion</Text>
        <Text style={styles.subtitle}>
          Ingresa el codigo y crea tu contrasena.
        </Text>

        <Text style={styles.label}>Codigo</Text>
        <TextInput
          value={token}
          onChangeText={setToken}
          placeholder="Ej: 7c2e..."
          placeholderTextColor={COLORS.neutral}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Contrasena</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Minimo 8 caracteres"
          placeholderTextColor={COLORS.neutral}
          style={styles.input}
          secureTextEntry
        />

        <Text style={styles.label}>Confirmar contrasena</Text>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Repite la contrasena"
          placeholderTextColor={COLORS.neutral}
          style={styles.input}
          secureTextEntry
        />

        <TouchableOpacity
          onPress={handleAccept}
          disabled={loading}
          style={[
            styles.primaryButton,
            loading ? { opacity: 0.7 } : null,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? "Activando..." : "Activar cuenta"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/login")}>
          <Text style={styles.link}>Volver a iniciar sesion</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.porcelain,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.neutral,
  },
  label: {
    marginTop: 16,
    fontSize: 12,
    color: COLORS.neutral,
  },
  input: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 12,
    color: COLORS.text,
  },
  primaryButton: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: "center",
  },
  primaryButtonText: {
    fontWeight: "800",
    color: "white",
  },
  link: {
    marginTop: 16,
    color: COLORS.accent,
    textAlign: "center",
    fontWeight: "700",
  },
})
