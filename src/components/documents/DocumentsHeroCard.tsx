import { Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { COLORS } from "@/constants/colors"

import { DOCUMENTS_UI } from "./ui"

type Props = {
  canManageScopes: boolean
  totalDocuments: number
  alertCount: number
  onUpload: () => void
}

export function DocumentsHeroCard({
  canManageScopes,
  totalDocuments,
  alertCount,
  onUpload,
}: Props) {
  return (
    <View style={[DOCUMENTS_UI.card, { padding: 18 }]}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: COLORS.text }}>Documentos</Text>
          <Text style={{ marginTop: 6, fontSize: 13, color: COLORS.neutral, lineHeight: 19 }}>
            {canManageScopes
              ? "Consulta, sube y organiza PDFs personales o de sede sin salir de la app."
              : "Consulta tus documentos personales y los archivos relevantes de tu sede."}
          </Text>
        </View>

        {canManageScopes ? (
          <TouchableOpacity
            onPress={onUpload}
            style={[
              DOCUMENTS_UI.chip,
              {
                borderColor: COLORS.accent,
                backgroundColor: "rgba(226, 0, 106, 0.12)",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 14,
              },
            ]}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={COLORS.accent} />
            <Text style={{ fontWeight: "800", color: COLORS.accent }}>Subir</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
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
          <Text style={{ fontSize: 11, color: COLORS.neutral }}>Disponibles</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text, marginTop: 6 }}>
            {totalDocuments}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            borderRadius: 16,
            padding: 12,
            backgroundColor: alertCount > 0 ? "rgba(226, 0, 106, 0.08)" : COLORS.porcelainAlt,
            borderWidth: 1,
            borderColor: alertCount > 0 ? "rgba(226, 0, 106, 0.18)" : COLORS.border,
          }}
        >
          <Text style={{ fontSize: 11, color: COLORS.neutral }}>Por revisar</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text, marginTop: 6 }}>
            {alertCount}
          </Text>
        </View>
      </View>
    </View>
  )
}
