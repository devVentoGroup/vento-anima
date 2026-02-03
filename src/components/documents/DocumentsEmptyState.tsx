import { Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { COLORS } from "@/constants/colors"
import { DOCUMENTS_UI } from "@/components/documents/ui"

type DocumentsEmptyStateProps = {
  canManageScopes: boolean
  onUpload: () => void
}

export function DocumentsEmptyState({ canManageScopes, onUpload }: DocumentsEmptyStateProps) {
  return (
    <View
      style={{
        marginTop: 12,
        alignItems: "center",
        paddingVertical: 28,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.porcelainAlt,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: "rgba(226, 0, 106, 0.30)",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(226, 0, 106, 0.08)",
        }}
      >
        <Ionicons name="document-text-outline" size={22} color={COLORS.accent} />
      </View>

      <Text style={{ marginTop: 10, fontSize: 14, fontWeight: "800", color: COLORS.text }}>
        Sin documentos
      </Text>
      <Text style={{ marginTop: 6, color: COLORS.neutral, textAlign: "center" }}>
        Aún no hay documentos cargados.
      </Text>

      {canManageScopes ? (
        <TouchableOpacity
          onPress={onUpload}
          style={[
            DOCUMENTS_UI.chip,
            {
              marginTop: 12,
              borderColor: COLORS.accent,
              backgroundColor: "rgba(226, 0, 106, 0.12)",
              paddingVertical: 10,
              paddingHorizontal: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            },
          ]}
        >
          <Ionicons name="cloud-upload-outline" size={16} color={COLORS.accent} />
          <Text style={{ fontWeight: "800", color: COLORS.accent }}>Subir documento</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}
