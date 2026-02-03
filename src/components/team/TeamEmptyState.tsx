import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import { TEAM_UI } from "@/components/team/ui";

type TeamEmptyStateProps = {
  title?: string;
  subtitle?: string;
};

export default function TeamEmptyState({
  title = "Sin trabajadores",
  subtitle = "Aún no hay perfiles de equipo para este filtro.",
}: TeamEmptyStateProps) {
  return (
    <View style={styles.wrapper}>
      <View style={[TEAM_UI.card, styles.card]}>
        <View style={styles.iconWrap}>
          <Ionicons name="people-outline" size={22} color={COLORS.accent} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 18,
  },
  card: {
    padding: 18,
    alignItems: "center",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(226, 0, 106, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(226, 0, 106, 0.18)",
  },
  title: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 6,
    color: COLORS.neutral,
    textAlign: "center",
  },
});
