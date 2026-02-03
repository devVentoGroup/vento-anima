import { Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { COLORS } from "@/constants/colors"
import { DOCUMENTS_UI } from "@/components/documents/ui"

type DocumentCardProps = {
  title: string
  fileName: string
  expiryDateLabel: string
  scopeLabel: string
  expiryLabel?: string | null
  expiryTone?: string
  onOpen: () => void
  onDelete?: () => void
  showDelete?: boolean
}

export function DocumentCard({
  title,
  fileName,
  expiryDateLabel,
  scopeLabel,
  expiryLabel,
  expiryTone,
  onOpen,
  onDelete,
  showDelete,
}: DocumentCardProps) {
  return (
    <View style={[DOCUMENTS_UI.card, { padding: 14 }]}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(226, 0, 106, 0.10)",
              borderWidth: 1,
              borderColor: "rgba(226, 0, 106, 0.18)",
            }}
          >
            <Ionicons name="document-text-outline" size={20} color={COLORS.accent} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: COLORS.text }} numberOfLines={1}>
              {title}
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }} numberOfLines={1}>
              {fileName}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", marginTop: 10 }}>
        <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>{expiryDateLabel}</Text>
        <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4, marginLeft: 12 }}>
          {scopeLabel}
        </Text>
      </View>

      {expiryLabel ? (
        <Text style={{ fontSize: 12, color: expiryTone ?? COLORS.neutral, marginTop: 4 }}>
          {expiryLabel}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <TouchableOpacity
          onPress={onOpen}
          style={[
            DOCUMENTS_UI.chip,
            {
              flex: 1,
              borderColor: COLORS.accent,
              backgroundColor: "rgba(226, 0, 106, 0.10)",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 10,
            },
          ]}
        >
          <Ionicons name="open-outline" size={16} color={COLORS.accent} />
          <Text style={{ textAlign: "center", fontWeight: "800", color: COLORS.accent }}>
            Abrir PDF
          </Text>
        </TouchableOpacity>

        {showDelete && onDelete ? (
          <TouchableOpacity
            onPress={onDelete}
            style={[
              DOCUMENTS_UI.chip,
              {
                borderColor: COLORS.neutral,
                backgroundColor: COLORS.porcelainAlt,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 16,
              },
            ]}
          >
            <Ionicons name="trash-outline" size={16} color={COLORS.neutral} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}
