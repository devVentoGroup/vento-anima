import { Text, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { PALETTE } from "@/components/home/theme"
import { COLORS } from "@/constants/colors"

type QuickActionItemProps = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle: string
  onPress: () => void
}

function QuickActionItem({ icon, title, subtitle, onPress }: QuickActionItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: "white",
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: PALETTE.porcelain2,
          borderWidth: 1,
          borderColor: PALETTE.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={18} color={PALETTE.rose} />
      </View>
      <Text
        style={{
          fontSize: 14,
          fontWeight: "800",
          color: COLORS.text,
          marginTop: 10,
        }}
      >
        {title}
      </Text>
      <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>{subtitle}</Text>
    </TouchableOpacity>
  )
}

type QuickActionsSectionProps = {
  onHistoryPress: () => void
  onAnnouncementsPress: () => void
  onSupportPress: () => void
  onDocumentsPress: () => void
}

export function QuickActionsSection({
  onHistoryPress,
  onAnnouncementsPress,
  onSupportPress,
  onDocumentsPress,
}: QuickActionsSectionProps) {
  return (
    <View style={{ marginTop: 20 }}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: "800",
          color: COLORS.text,
          marginBottom: 10,
        }}
      >
        Accesos rápidos
      </Text>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <QuickActionItem icon="time-outline" title="Historial" subtitle="Mis registros" onPress={onHistoryPress} />
        <QuickActionItem icon="notifications-outline" title="Novedades" subtitle="Avisos del equipo" onPress={onAnnouncementsPress} />
      </View>

      <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
        <QuickActionItem icon="help-circle-outline" title="Soporte" subtitle="Reportar novedad" onPress={onSupportPress} />
        <QuickActionItem icon="document-text-outline" title="Documentos" subtitle="Formatos y solicitudes" onPress={onDocumentsPress} />
      </View>
    </View>
  )
}
