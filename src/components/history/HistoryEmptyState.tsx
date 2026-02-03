import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "@/constants/colors";

type HistoryEmptyStateProps = {
  title?: string;
  subtitle?: string;
};

export default function HistoryEmptyState({
  title = "Sin registros",
  subtitle = "No hay movimientos en este periodo.",
}: HistoryEmptyStateProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 6,
    color: COLORS.neutral,
  },
});
