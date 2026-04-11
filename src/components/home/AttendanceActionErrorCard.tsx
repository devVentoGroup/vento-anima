import { Text, View } from "react-native";

import { COLORS } from "@/constants/colors";

type AttendanceActionErrorCardProps = {
  message: string;
};

export function AttendanceActionErrorCard({
  message,
}: AttendanceActionErrorCardProps) {
  return (
    <View
      style={{
        backgroundColor: "white",
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.text }}>
        No se pudo registrar
      </Text>
      <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
        {message}
      </Text>
    </View>
  );
}
