import { StyleSheet, Text, View } from "react-native";
import { AnimaLogo } from "@/components/anima-logo";
import { COLORS } from "@/constants/colors";

type LoginHeaderProps = {
  logoSize?: number;
};

export default function LoginHeader({ logoSize = 180 }: LoginHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.logoWrap}>
        <View style={styles.logoHalo} />
        <AnimaLogo size={logoSize} />
      </View>

      <Text style={styles.title}>ANIMA</Text>
      <Text style={styles.subtitle}>Control de Asistencia</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
});

