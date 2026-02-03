import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import type { TextInput as RNTextInput } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useRouter } from "expo-router";

import { COLORS } from "@/constants/colors";
import { useAuth } from "@/contexts/auth-context";
import LoginBackground from "@/components/auth/login/LoginBackground";
import LoginHeader from "@/components/auth/login/LoginHeader";
import LoginForm from "@/components/auth/login/LoginForm";
import { createStarField } from "@/components/auth/login/starfield";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const passwordRef = useRef<RNTextInput>(null);

  const { width: W, height: H } = Dimensions.get("window");

  const stars = useMemo(() => createStarField(2026, W, H), [W, H]);

  const headerOpacity = useSharedValue(0);
  const headerTranslateY = useSharedValue(14);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(22);
  const scanOpacity = useSharedValue(0);
  const scanTranslateY = useSharedValue(-120);

  useEffect(() => {
    headerOpacity.value = withTiming(1, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
    headerTranslateY.value = withTiming(0, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });

    cardOpacity.value = withDelay(
      120,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
    cardTranslateY.value = withDelay(
      120,
      withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );

    scanOpacity.value = withDelay(300, withTiming(0.08, { duration: 300 }));
    scanTranslateY.value = withDelay(
      300,
      withRepeat(
        withTiming(H + 120, { duration: 5200, easing: Easing.linear }),
        -1,
        false,
      ),
    );

    return () => {
      cancelAnimation(scanTranslateY);
    };
  }, [H, headerOpacity, headerTranslateY, cardOpacity, cardTranslateY, scanOpacity, scanTranslateY]);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  const scanStyle = useAnimatedStyle(() => ({
    opacity: scanOpacity.value,
    transform: [{ translateY: scanTranslateY.value }],
  }));

  const handleLogin = async () => {
    if (!email || !password || loading) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      await signIn(email.trim(), password);
    } catch (e: any) {
      const msg = (e?.message || "").toLowerCase();

      if (
        msg.includes("invalid") ||
        msg.includes("credentials") ||
        msg.includes("password")
      ) {
        setErrorMsg("Correo o contraseña incorrectos.");
      } else if (
        msg.includes("network") ||
        msg.includes("fetch") ||
        msg.includes("connection")
      ) {
        setErrorMsg("No pudimos conectar. Revisa tu internet e inténtalo de nuevo.");
      } else {
        setErrorMsg("No pudimos iniciar sesión. Intenta nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!email && !!password && !loading;
  const Container: any = KeyboardAvoidingView;
  const containerProps = {
    behavior: Platform.OS === "ios" ? "padding" : "height",
    keyboardVerticalOffset: 0,
    style: styles.root,
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (errorMsg) setErrorMsg(null);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (errorMsg) setErrorMsg(null);
  };

  return (
    <Container {...containerProps}>
      <LoginBackground stars={stars} scanStyle={scanStyle} />

      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={headerStyle}>
          <LoginHeader />
        </Animated.View>

        <LoginForm
          email={email}
          password={password}
          showPassword={showPassword}
          loading={loading}
          errorMsg={errorMsg}
          canSubmit={canSubmit}
          passwordRef={passwordRef}
          cardStyle={cardStyle}
          onEmailChange={handleEmailChange}
          onPasswordChange={handlePasswordChange}
          onToggleShowPassword={() => setShowPassword((v) => !v)}
          onSubmit={handleLogin}
          onInvitePress={() => router.push("/invite")}
        />
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.porcelain,
  },
  page: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 64,
    paddingBottom: 34,
    justifyContent: "center",
  },
});

