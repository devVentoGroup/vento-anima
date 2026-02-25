import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native"

import { COLORS } from "@/constants/colors"
import { PALETTE } from "@/components/home/theme"

export type ReportFilterOption = {
  id: string
  label: string
  caption?: string | null
}

type ReportFilterModalProps = {
  visible: boolean
  title: string
  subtitle?: string
  options: ReportFilterOption[]
  selectedId: string | null
  includeAll?: boolean
  allLabel?: string
  modalWidth: number
  onSelect: (id: string | null) => void
  onClose: () => void
}

export function ReportFilterModal({
  visible,
  title,
  subtitle,
  options,
  selectedId,
  includeAll = true,
  allLabel = "Todos",
  modalWidth,
  onSelect,
  onClose,
}: ReportFilterModalProps) {
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
            borderWidth: 1,
            borderColor: COLORS.border,
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 12 },
            elevation: 10,
            width: modalWidth,
            maxHeight: "75%",
            alignSelf: "center",
            overflow: "hidden",
          }}
        >
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.text }}>{title}</Text>
            {subtitle ? (
              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>{subtitle}</Text>
            ) : null}
          </View>

          <ScrollView
            style={{ borderTopWidth: 1, borderTopColor: COLORS.border }}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {includeAll ? (
              <TouchableOpacity
                onPress={() => {
                  onSelect(null)
                  onClose()
                }}
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: selectedId == null ? COLORS.accent : PALETTE.border,
                  backgroundColor: selectedId == null ? "rgba(226, 0, 106, 0.12)" : "white",
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color: selectedId == null ? COLORS.accent : COLORS.text,
                  }}
                >
                  {allLabel}
                </Text>
              </TouchableOpacity>
            ) : null}

            {options.map((option) => {
              const active = selectedId === option.id
              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => {
                    onSelect(option.id)
                    onClose()
                  }}
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: active ? COLORS.accent : PALETTE.border,
                    backgroundColor: active ? "rgba(226, 0, 106, 0.12)" : "white",
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: active ? COLORS.accent : COLORS.text,
                    }}
                  >
                    {option.label}
                  </Text>
                  {option.caption ? (
                    <Text style={{ fontSize: 11, color: COLORS.neutral, marginTop: 2 }}>
                      {option.caption}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: PALETTE.border,
                paddingVertical: 10,
                alignItems: "center",
                backgroundColor: PALETTE.porcelain2,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: PALETTE.text }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
