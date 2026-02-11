import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import * as Linking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { COLORS } from "@/constants/colors";
import { supabase } from "@/lib/supabase";
import InviteContent from "@/components/auth/invite/InviteContent";
import { getUserFacingAuthError } from "@/utils/error-messages";

const parseTokensFromUrl = (url: string) => {
  const hash = url.split("#")[1] ?? "";
  const hashParams = new URLSearchParams(hash);
  const query = url.split("?")[1]?.split("#")[0] ?? "";
  const queryParams = new URLSearchParams(query);
  const accessToken =
    hashParams.get("access_token") ?? queryParams.get("access_token");
  const refreshToken =
    hashParams.get("refresh_token") ?? queryParams.get("refresh_token");
  const type = hashParams.get("type") ?? queryParams.get("type");
  return {
    accessToken,
    refreshToken,
    isRecovery: type === "recovery",
  };
};

export default function InviteScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    let active = true;

    const applyTokens = async (url: string | null) => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      if (data.session) {
        setReady(true);
        return;
      }

      if (!url) {
        setErrorMessage(
          "Abre el enlace que te enviamos por correo para crear tu contraseña (en el navegador). Después podrás entrar aquí con tu correo y contraseña. Si no recibiste el correo, revisa spam o pide que te reenvíen la invitación.",
        );
        return;
      }

      const { accessToken, refreshToken, isRecovery: recovery } = parseTokensFromUrl(url);
      if (!accessToken || !refreshToken) {
        setErrorMessage(
          recovery
            ? "El enlace para crear contraseña no es válido o venció."
            : "El enlace de invitación no es válido o venció.",
        );
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!active) return;

      if (error) {
        console.error("Invite session error:", error);
        setErrorMessage("No se pudo validar el enlace.");
        return;
      }

      setIsRecovery(recovery);
      setReady(true);
    };

    void Linking.getInitialURL().then((url) => applyTokens(url));

    const subscription = Linking.addEventListener("url", (event) => {
      void applyTokens(event.url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let active = true;

    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      const metaName = String(data.user?.user_metadata?.full_name ?? "").trim();
      if (metaName && !fullName) {
        setFullName(metaName);
        return;
      }
      const email = data.user?.email;
      if (!email || fullName) return;
      const { data: profile } = await supabase
        .from("users")
        .select("full_name")
        .eq("email", email)
        .maybeSingle();
      if (!active) return;
      const profileName = String(profile?.full_name ?? "").trim();
      if (profileName && !fullName) {
        setFullName(profileName);
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [ready, fullName]);

  const handleAccept = async () => {
    if (!ready) {
      Alert.alert(
        isRecovery ? "Crear contraseña" : "Invitación",
        isRecovery
          ? "Aún estamos validando el enlace."
          : "Aún estamos validando la invitación.",
      );
      return;
    }
    if (!isRecovery && !fullName.trim()) {
      Alert.alert("Invitación", "Escribe tu nombre completo.");
      return;
    }
    if (!password || password.length < 8) {
      Alert.alert(
        isRecovery ? "Crear contraseña" : "Invitación",
        "La contraseña debe tener al menos 8 caracteres.",
      );
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(
        isRecovery ? "Crear contraseña" : "Invitación",
        "Las contraseñas no coinciden.",
      );
      return;
    }

    setLoading(true);
    try {
      if (isRecovery) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        router.replace("/home");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const { data, error } = await supabase.functions.invoke(
        "staff-invitations-accept",
        {
          body: {
            password,
            full_name: fullName.trim() || null,
            alias: alias.trim() || null,
          },
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : undefined,
        },
      );

      if (error) throw error;
      const errMsg = (data as { error?: string } | null)?.error;
      if (errMsg) throw new Error(errMsg);
      router.replace("/home");
    } catch (err) {
      console.error("Invite accept error:", err);
      const msg = getUserFacingAuthError(
        err,
        "No se pudo procesar la invitación. Intenta nuevamente.",
      );
      Alert.alert(isRecovery ? "Crear contraseña" : "Invitación", msg);
    } finally {
      setLoading(false);
    }
  };

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
        <InviteContent
          fullName={fullName}
          alias={alias}
          password={password}
          confirmPassword={confirmPassword}
          loading={loading}
          ready={ready}
          errorMessage={errorMessage}
          isRecovery={isRecovery}
          onFullNameChange={setFullName}
          onAliasChange={setAlias}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onSubmit={handleAccept}
          onBack={() => router.replace("/login")}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.porcelain,
  },
});
