import { Text, View } from "react-native"

import { COLORS } from "@/constants/colors"

import { DOCUMENTS_UI } from "./ui"

type AlertItem = {
  id: string
  title: string
  label: string
  tone: string
}

type Props = {
  notificationsEnabled: boolean
  isScheduling: boolean
  items: AlertItem[]
}

export function DocumentAlertsCard({ notificationsEnabled, isScheduling, items }: Props) {
  if (!notificationsEnabled && items.length === 0) {
    return (
      <View style={{ marginTop: 14 }}>
        <View style={[DOCUMENTS_UI.card, { padding: 14 }]}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.text }}>
            Notificaciones desactivadas
          </Text>
          <Text style={{ marginTop: 4, fontSize: 12, color: COLORS.neutral, lineHeight: 18 }}>
            Activa permisos desde Home para recibir alertas cuando un documento vaya a vencer.
          </Text>
        </View>
      </View>
    )
  }

  if (items.length === 0) return null

  return (
    <View style={{ marginTop: 14 }}>
      <View style={[DOCUMENTS_UI.card, { padding: 14 }]}>
        <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.text }}>
          Alertas de vencimiento
        </Text>
        <Text style={{ marginTop: 4, fontSize: 12, color: COLORS.neutral, lineHeight: 18 }}>
          {items.length} documentos por vencer o vencidos.
        </Text>
        {isScheduling ? (
          <Text style={{ marginTop: 4, fontSize: 12, color: COLORS.neutral }}>
            Configurando recordatorios...
          </Text>
        ) : null}

        <View style={{ marginTop: 10, gap: 8 }}>
          {items.slice(0, 3).map((item) => (
            <View
              key={item.id}
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: COLORS.porcelainAlt,
                paddingVertical: 8,
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.text }} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 11, color: item.tone }}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
