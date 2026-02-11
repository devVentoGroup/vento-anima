import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "@/constants/colors";

type InviteContentProps = {
  fullName: string;
  alias: string;
  password: string;
  confirmPassword: string;
  loading: boolean;
  ready: boolean;
  errorMessage: string | null;
  /** Flujo "olvidé mi contraseña": solo crear contraseña, sin nombre/alias. */
  isRecovery?: boolean;
  onFullNameChange: (value: string) => void;
  onAliasChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
};

export default function InviteContent({
  fullName,
  alias,
  password,
  confirmPassword,
  loading,
  ready,
  errorMessage,
  isRecovery = false,
  onFullNameChange,
  onAliasChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onBack,
}: InviteContentProps) {
  return (
    <View>
      <Text style={styles.title}>
        {isRecovery ? "Crear contraseña" : "Completa tu cuenta"}
      </Text>
      <Text style={styles.subtitle}>
        {ready
          ? isRecovery
            ? "Crea una contraseña para entrar a ANIMA."
            : "Tu invitación fue validada. Crea tu contraseña."
          : isRecovery
            ? "Validando enlace..."
            : "Validando invitación..."}
      </Text>

      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : null}

      {!isRecovery ? (
        <>
          <Text style={styles.label}>Nombre completo (obligatorio)</Text>
          <TextInput
            value={fullName}
            onChangeText={onFullNameChange}
            placeholder="Nombre completo"
            placeholderTextColor={COLORS.neutral}
            style={styles.input}
          />

          <Text style={styles.label}>Alias (opcional)</Text>
          <TextInput
            value={alias}
            onChangeText={onAliasChange}
            placeholder="Cómo te llaman en el equipo"
            placeholderTextColor={COLORS.neutral}
            style={styles.input}
          />
        </>
      ) : null}

      <Text style={styles.label}>Contraseña</Text>
      <TextInput
        value={password}
        onChangeText={onPasswordChange}
        placeholder="Mínimo 8 caracteres"
        placeholderTextColor={COLORS.neutral}
        style={styles.input}
        secureTextEntry
      />

      <Text style={styles.label}>Confirmar contraseña</Text>
      <TextInput
        value={confirmPassword}
        onChangeText={onConfirmPasswordChange}
        placeholder="Repite la contraseña"
        placeholderTextColor={COLORS.neutral}
        style={styles.input}
        secureTextEntry
      />

      <TouchableOpacity
        onPress={onSubmit}
        disabled={loading || !ready}
        style={[styles.primaryButton, loading ? { opacity: 0.7 } : null]}
      >
        <Text style={styles.primaryButtonText}>
          {loading
            ? isRecovery
              ? "Guardando..."
              : "Activando..."
            : isRecovery
              ? "Crear contraseña"
              : "Activar cuenta"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack}>
        <Text style={styles.link}>
          {isRecovery ? "Volver al login" : "Volver a iniciar sesión"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
  errorText: {
    marginTop: 12,
    color: COLORS.rosegold,
    fontWeight: "700",
    fontSize: 12,
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
});
