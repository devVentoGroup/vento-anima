import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

import { PALETTE, RGBA } from "@/components/home/theme";
import {
  formatShiftDateLabel,
  getShiftRangeLabel,
  getShiftSiteName,
  type ShiftRow,
} from "@/components/shifts/utils";

type ShiftPreviewBannerProps = {
  todayShift: ShiftRow | null;
  nextScheduledShift: ShiftRow | null;
  onPress: () => void;
};

export function ShiftPreviewBanner({
  todayShift,
  nextScheduledShift,
  onPress,
}: ShiftPreviewBannerProps) {
  const shift = todayShift ?? nextScheduledShift;

  if (!shift) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        backgroundColor: "white",
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: PALETTE.border,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: RGBA.washRoseGlow,
            borderWidth: 1,
            borderColor: RGBA.borderPink,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="calendar-outline" size={20} color={PALETTE.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: PALETTE.neutral }}>
            {todayShift ? "Tu turno hoy" : "Tu próximo turno"}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: "800", color: PALETTE.text, marginTop: 2 }}>
            {formatShiftDateLabel(shift.shift_date)} · {getShiftRangeLabel(shift)}
          </Text>
          <Text style={{ fontSize: 13, color: PALETTE.neutral, marginTop: 2 }}>
            {getShiftSiteName(shift.sites)}
          </Text>
          {todayShift ? (
            <Text
              style={{
                fontSize: 12,
                color: PALETTE.neutral,
                marginTop: 4,
                fontStyle: "italic",
              }}
            >
              Según tu turno programado
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color={PALETTE.neutral} />
      </View>
      <Text style={{ fontSize: 12, fontWeight: "700", color: PALETTE.accent, marginTop: 10 }}>
        Ver mis turnos
      </Text>
    </TouchableOpacity>
  );
}
