import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native"

import { COLORS } from "@/constants/colors"
import type { SiteCandidate } from "@/hooks/use-attendance"

type SitePickerModalProps = {
  visible: boolean
  modalWidth: number
  candidateSites: SiteCandidate[]
  onClose: () => void
  onSelectSite: (siteId: string) => void
}

export function SitePickerModal({
  visible,
  modalWidth,
  candidateSites,
  onClose,
  onSelectSite,
}: SitePickerModalProps) {
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
            width: modalWidth,
            borderWidth: 1,
            borderColor: COLORS.border,
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 12 },
            elevation: 10,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.text }}>
            Selecciona tu sede
          </Text>
          <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 6 }}>
            Estás cerca de varias sedes. Elige la correcta para continuar.
          </Text>

          <View style={{ marginTop: 12, gap: 10 }}>
            {candidateSites.length === 0 ? (
              <Text style={{ fontSize: 12, color: COLORS.neutral }}>
                No hay sedes disponibles para seleccionar.
              </Text>
            ) : (
              candidateSites.map((site) => (
                <TouchableOpacity
                  key={site.id}
                  onPress={() => onSelectSite(site.id)}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    backgroundColor: COLORS.porcelain,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.text }}>
                    {site.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
                    {site.distanceMeters}m - radio {site.effectiveRadiusMeters}m
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={{
              alignSelf: "flex-end",
              marginTop: 14,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: COLORS.accent,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "800", color: "white" }}>Cancelar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
