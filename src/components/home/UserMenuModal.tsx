import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native"

import { ANIMA_COPY } from "@/brand/anima/copy/app-copy"
import { COLORS } from "@/constants/colors"

type UserMenuModalProps = {
  visible: boolean
  topPadding: number
  onClose: () => void
  onSettings: () => void
  onSignOut: () => void
}

export function UserMenuModal({
  visible,
  topPadding,
  onClose,
  onSettings,
  onSignOut,
}: UserMenuModalProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.10)" }} onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            position: "absolute",
            top: topPadding + 44,
            right: 20,
            backgroundColor: "white",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: COLORS.border,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: 8,
            minWidth: 220,
          }}
        >
          <TouchableOpacity onPress={onSettings} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }}>Configuración</Text>
            <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 2 }}>
              Privacidad, permisos y cuenta
            </Text>
          </TouchableOpacity>

          <View style={{ height: 1, backgroundColor: COLORS.border }} />

          <TouchableOpacity onPress={onSignOut} style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: COLORS.text }}>Cerrar sesión</Text>
            <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 2 }}>
              {ANIMA_COPY.userMenuSignOutSubtitle}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

