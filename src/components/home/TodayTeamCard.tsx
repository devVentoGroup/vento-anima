import { Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { COLORS } from "@/constants/colors"

type Props = {
  isLoading: boolean
  coworkerCount: number
  coworkerNames: string[]
  onPress: () => void
}

function formatNames(names: string[]) {
  if (names.length === 0) return "Aún no hay más turnos publicados para hoy."
  if (names.length <= 3) return names.join(", ")
  return `${names.slice(0, 3).join(", ")} y ${names.length - 3} más`
}

export function TodayTeamCard({ isLoading, coworkerCount, coworkerNames, onPress }: Props) {
  if (!isLoading && coworkerCount === 0) return null

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
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.accent, letterSpacing: 0.4 }}>
              HOY EN TU SEDE
            </Text>
            <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text, marginTop: 8 }}>
              {isLoading ? "Consultando equipo" : coworkerCount === 1 ? "Trabajas con 1 persona" : `Trabajas con ${coworkerCount} personas`}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onPress}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 14,
              backgroundColor: COLORS.porcelainAlt,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.text }}>Ver semana</Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            marginTop: 14,
            flexDirection: "row",
            gap: 10,
            alignItems: "flex-start",
            borderRadius: 16,
            padding: 14,
            backgroundColor: COLORS.porcelainAlt,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              backgroundColor: COLORS.accentSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="people-outline" size={18} color={COLORS.accent} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: COLORS.text }}>
              {isLoading ? "Cargando compañeros de hoy..." : "Con quién coincides hoy"}
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.neutral, marginTop: 6, lineHeight: 19 }}>
              {isLoading ? "Estamos trayendo la programación publicada de tu sede." : formatNames(coworkerNames)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
