import { Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "@/constants/colors";

type OfflineStatusCardProps = {
  onRetry: () => void;
};

export function OfflineStatusCard({ onRetry }: OfflineStatusCardProps) {
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
        Sin conexión
      </Text>
      <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
        No pudimos actualizar tu jornada. Revisa tu conexión e intenta de nuevo.
      </Text>

      <TouchableOpacity
        onPress={onRetry}
        style={{
          marginTop: 12,
          alignSelf: "flex-start",
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 12,
          backgroundColor: COLORS.accent,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "800", color: "white" }}>
          Reintentar
        </Text>
      </TouchableOpacity>
    </View>
  );
}
