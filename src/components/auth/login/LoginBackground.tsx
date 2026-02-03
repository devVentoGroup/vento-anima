import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { COLORS } from "@/constants/colors";
import type { Star } from "@/components/auth/login/starfield";

type LoginBackgroundProps = {
  stars: Star[];
  scanStyle: Record<string, unknown>;
};

export default function LoginBackground({ stars, scanStyle }: LoginBackgroundProps) {
  return (
    <View pointerEvents="none" style={styles.background}>
      {stars.map((star) => (
        <View
          key={star.id}
          style={[
            styles.star,
            {
              left: star.x,
              top: star.y,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
            },
          ]}
        />
      ))}
      <View pointerEvents="none" style={styles.auroraBeam1} />
      <View pointerEvents="none" style={styles.auroraBeam2} />
      <View pointerEvents="none" style={styles.vignette} />

      <Animated.View style={[styles.scanLine, scanStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
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
});

