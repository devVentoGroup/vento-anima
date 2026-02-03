import { useState, type RefObject } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { TextInput as RNTextInput } from "react-native";
import Animated from "react-native-reanimated";
import { COLORS } from "@/constants/colors";

type LoginFormProps = {
  email: string;
  password: string;
  showPassword: boolean;
  loading: boolean;
  errorMsg: string | null;
  canSubmit: boolean;
  passwordRef: RefObject<RNTextInput>;
  cardStyle: Record<string, unknown>;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onSubmit: () => void;
  onInvitePress: () => void;
};

export default function LoginForm({
  email,
  password,
  showPassword,
  loading,
  errorMsg,
  canSubmit,
  passwordRef,
  cardStyle,
  onEmailChange,
  onPasswordChange,
  onToggleShowPassword,
  onSubmit,
  onInvitePress,
}: LoginFormProps) {
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  return (
    <Animated.View style={[styles.cardShell, cardStyle]}>
      <View style={styles.cardGlass} />
      <View style={styles.cardInner}>
        <Text style={styles.cardTitle}>Ingresar</Text>
        <Text style={styles.cardHint}>
          Usa las credenciales proporcionadas por tu empleador
        </Text>

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
            onChangeText={onEmailChange}
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
              onChangeText={onPasswordChange}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textContentType="password"
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={onSubmit}
              placeholderTextColor={COLORS.neutral}
              style={[
                styles.input,
                styles.passwordInput,
                passwordFocused && styles.inputFocused,
              ]}
            />

            <Pressable
              onPress={onToggleShowPassword}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              style={({ pressed }) => [
                styles.showButton,
                pressed ? { opacity: 0.85 } : null,
              ]}
              hitSlop={10}
            >
              <Text style={styles.showButtonText}>
                {showPassword ? "Ocultar" : "Mostrar"}
              </Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.primaryButton,
            !canSubmit && styles.primaryButtonDisabled,
            pressed && canSubmit ? styles.primaryButtonPressed : null,
          ]}
        >
          <View style={styles.primaryButtonInner}>
            <Text style={styles.primaryButtonText}>Iniciar Sesión</Text>
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : null}
          </View>
        </Pressable>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <TouchableOpacity onPress={onInvitePress} style={styles.inviteLink}>
          <Text style={styles.inviteLinkText}>Tengo una invitación</Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Si tienes problemas para ingresar, solicita soporte a tu administrador.
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
  primaryButtonPressed: {
    transform: [{ scale: 0.985 }],
  },
  primaryButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.white,
    letterSpacing: 0.2,
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(140, 20, 60, 0.95)",
    textAlign: "center",
    fontWeight: "600",
  },
  inviteLink: {
    marginTop: 12,
    alignSelf: "center",
  },
  inviteLinkText: {
    color: COLORS.accent,
    fontWeight: "700",
  },
  footerNote: {
    marginTop: 14,
    fontSize: 12,
    color: COLORS.neutral,
    textAlign: "center",
  },
});

