import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { PALETTE } from "@/components/home/theme"
import { formatShiftDateLabel, getShiftRangeLabel, getShiftSiteName, type ShiftRow } from "@/components/shifts/utils"
import { COLORS } from "@/constants/colors"

type StatusMeta = {
  bg: string
  border: string
  text: string
  label: string
} | null

type NextShiftCardProps = {
  nextScheduledShift: ShiftRow | null
  todayShift: ShiftRow | null
  isLoading: boolean
  isCheckedIn: boolean
  currentSiteId: string | null
  nextShiftDurationLabel: string | null
  nextShiftStatusMeta: StatusMeta
  onPress: () => void
}

export function NextShiftCard({
  nextScheduledShift,
  todayShift,
  isLoading,
  isCheckedIn,
  currentSiteId,
  nextShiftDurationLabel,
  nextShiftStatusMeta,
  onPress,
}: NextShiftCardProps) {
  return (
    <View style={{ marginTop: 20 }}>
      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: 20,
          padding: 18,
          borderWidth: 1,
          borderColor: COLORS.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "800",
                letterSpacing: 0.4,
                color: PALETTE.accent,
              }}
            >
              MIS TURNOS
            </Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "900",
                color: COLORS.text,
                marginTop: 8,
              }}
            >
              {nextScheduledShift ? "Tu próximo horario" : "Horario pendiente"}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onPress}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 14,
              backgroundColor: PALETTE.accent,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.white }}>Ver todo</Text>
          </TouchableOpacity>
        </View>

        {isCheckedIn && todayShift ? (
          <View
            style={{
              marginTop: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor:
                currentSiteId === todayShift.site_id ? "rgba(16, 185, 129, 0.12)" : COLORS.porcelainAlt,
              borderWidth: 1,
              borderColor: currentSiteId === todayShift.site_id ? "#10B981" : COLORS.border,
            }}
          >
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={currentSiteId === todayShift.site_id ? "#10B981" : COLORS.neutral}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: COLORS.text,
                flex: 1,
              }}
            >
              {currentSiteId === todayShift.site_id
                ? "Dentro de tu turno de hoy"
                : `Turno de hoy: ${getShiftSiteName(todayShift.sites)} (${getShiftRangeLabel(todayShift)}). Check-in registrado.`}
            </Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={{ paddingVertical: 18, alignItems: "center" }}>
            <ActivityIndicator color={PALETTE.accent} />
            <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 10 }}>
              Consultando turnos...
            </Text>
          </View>
        ) : nextScheduledShift ? (
          <>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "800",
                color: COLORS.text,
                marginTop: 14,
              }}
            >
              {formatShiftDateLabel(nextScheduledShift.shift_date)}
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.neutral, marginTop: 6 }}>
              {getShiftSiteName(nextScheduledShift.sites)}
            </Text>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
              <View
                style={{
                  flex: 1,
                  borderRadius: 16,
                  padding: 12,
                  backgroundColor: COLORS.porcelainAlt,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Text style={{ fontSize: 12, color: COLORS.neutral }}>Horario</Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "800",
                    color: COLORS.text,
                    marginTop: 5,
                  }}
                >
                  {getShiftRangeLabel(nextScheduledShift)}
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  borderRadius: 16,
                  padding: 12,
                  backgroundColor: COLORS.porcelainAlt,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Text style={{ fontSize: 12, color: COLORS.neutral }}>Duración neta</Text>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "800",
                    color: COLORS.text,
                    marginTop: 5,
                  }}
                >
                  {nextShiftDurationLabel}
                </Text>
              </View>
            </View>

            {nextShiftStatusMeta ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  marginTop: 14,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  backgroundColor: nextShiftStatusMeta.bg,
                  borderWidth: 1,
                  borderColor: nextShiftStatusMeta.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: nextShiftStatusMeta.text,
                  }}
                >
                  {nextShiftStatusMeta.label}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={{ fontSize: 13, color: COLORS.neutral, marginTop: 14, lineHeight: 19 }}>
            Aún no tienes turnos próximos cargados. Cuando publiquen el horario aparecerá aquí.
          </Text>
        )}
      </View>
    </View>
  )
}
