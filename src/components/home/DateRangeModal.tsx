import { Calendar, type DateData } from "react-native-calendars"
import { Ionicons } from "@expo/vector-icons"
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native"

import { COLORS } from "@/constants/colors"
import { PALETTE } from "@/components/home/theme"

type DateRangeModalProps = {
  visible: boolean
  modalWidth: number
  calendarTheme: Record<string, unknown>
  calendarMonth: Date
  markedDates: Record<string, any>
  draftStartDate: Date | null
  draftEndDate: Date | null
  surfaceStyle: {
    backgroundColor: string
    borderRadius: number
    borderWidth: number
    borderColor: string
  }
  onClose: () => void
  onApply: () => void
  onSelectDay: (dateString: string) => void
  onMonthChange: (month: DateData) => void
  shiftCalendarMonth: (delta: number) => void
  toDateKey: (date: Date) => string
  formatShortDate: (date: Date) => string
  formatMonthLabel: (date: Date) => string
}

export function DateRangeModal({
  visible,
  modalWidth,
  calendarTheme,
  calendarMonth,
  markedDates,
  draftStartDate,
  draftEndDate,
  surfaceStyle,
  onClose,
  onApply,
  onSelectDay,
  onMonthChange,
  shiftCalendarMonth,
  toDateKey,
  formatShortDate,
  formatMonthLabel,
}: DateRangeModalProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.35)",
          padding: 20,
          justifyContent: "center",
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: "white",
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: COLORS.border,
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 12 },
            elevation: 10,
            width: modalWidth,
            alignSelf: "center",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.text }}>
            Rango del reporte
          </Text>
          <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 6 }}>
            Selecciona un rango exacto desde el calendario.
          </Text>

          <View style={{ marginTop: 16 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, ...surfaceStyle, padding: 12 }}>
                <Text style={{ fontSize: 12, color: COLORS.neutral }}>Inicio</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: COLORS.text, marginTop: 4 }}>
                  {draftStartDate ? formatShortDate(draftStartDate) : "Selecciona"}
                </Text>
              </View>
              <View style={{ flex: 1, ...surfaceStyle, padding: 12 }}>
                <Text style={{ fontSize: 12, color: COLORS.neutral }}>Fin</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: COLORS.text, marginTop: 4 }}>
                  {draftEndDate ? formatShortDate(draftEndDate) : "Selecciona"}
                </Text>
              </View>
            </View>

            <View
              style={{
                marginTop: 12,
                borderRadius: 16,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Calendar
                key={toDateKey(calendarMonth)}
                current={toDateKey(calendarMonth)}
                enableSwipeMonths
                hideArrows
                hideExtraDays
                onDayPress={(day) => onSelectDay(day.dateString)}
                onMonthChange={onMonthChange}
                markedDates={markedDates}
                markingType="custom"
                renderHeader={() => (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 8,
                      paddingVertical: 6,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => shiftCalendarMonth(-1)}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: PALETTE.border,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: PALETTE.porcelain2,
                      }}
                    >
                      <Ionicons name="chevron-back" size={18} color={PALETTE.text} />
                    </TouchableOpacity>

                    <Text style={{ fontSize: 14, fontWeight: "700", color: PALETTE.text }}>
                      {formatMonthLabel(calendarMonth)}
                    </Text>

                    <TouchableOpacity
                      onPress={() => shiftCalendarMonth(1)}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: PALETTE.border,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: PALETTE.porcelain2,
                      }}
                    >
                      <Ionicons name="chevron-forward" size={18} color={PALETTE.text} />
                    </TouchableOpacity>
                  </View>
                )}
                theme={calendarTheme as any}
              />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                onPress={onClose}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: PALETTE.porcelain2,
                  borderWidth: 1,
                  borderColor: PALETTE.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color: PALETTE.text }}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onApply}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: COLORS.accent,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color: "white" }}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
