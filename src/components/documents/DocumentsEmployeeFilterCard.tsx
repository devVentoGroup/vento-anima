import { Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { COLORS } from "@/constants/colors"

import type { AvailableEmployee } from "./types"
import { DOCUMENTS_UI } from "./ui"

type Props = {
  filterEmployeeId: string | null
  availableEmployees: AvailableEmployee[]
  onOpen: () => void | Promise<void>
  onClear: () => void
}

export function DocumentsEmployeeFilterCard({
  filterEmployeeId,
  availableEmployees,
  onOpen,
  onClear,
}: Props) {
  const selectedEmployee =
    availableEmployees.find((employee) => employee.id === filterEmployeeId)?.full_name ?? null

  return (
    <View style={{ marginTop: 14 }}>
      <Text style={{ fontSize: 12, color: COLORS.neutral, marginBottom: 8 }}>Filtrar por trabajador</Text>
      <TouchableOpacity
        onPress={() => void onOpen()}
        style={[
          DOCUMENTS_UI.card,
          {
            padding: 14,
            borderColor: filterEmployeeId ? COLORS.accent : COLORS.border,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: filterEmployeeId ? "rgba(226, 0, 106, 0.10)" : COLORS.porcelainAlt,
              borderWidth: 1,
              borderColor: filterEmployeeId ? "rgba(226, 0, 106, 0.18)" : COLORS.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="people-outline" size={18} color={filterEmployeeId ? COLORS.accent : COLORS.neutral} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.text }}>
              {selectedEmployee ?? "Todos los trabajadores"}
            </Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: COLORS.neutral }}>
              {selectedEmployee ? "Mostrando solo sus documentos." : "Cambia el foco para revisar un trabajador puntual."}
            </Text>
          </View>

          {filterEmployeeId ? (
            <TouchableOpacity
              onPress={onClear}
              style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close-circle" size={18} color={COLORS.accent} />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={COLORS.neutral} />
          )}
        </View>
      </TouchableOpacity>
    </View>
  )
}
