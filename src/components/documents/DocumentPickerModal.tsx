import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"

import { COLORS } from "@/constants/colors"
import { DOCUMENTS_UI } from "@/components/documents/ui"

type DocumentPickerModalProps = {
  visible: boolean
  insets: { top: number; bottom: number }
  styles: Record<string, any>
  pickerQuery: string
  setPickerQuery: (value: string) => void
  availableEmployees: Array<{ id: string; full_name: string }>
  filteredEmployees: Array<{ id: string; full_name: string }>
  filterEmployeeId: string | null
  setFilterEmployeeId: (value: string | null) => void
  onClose: () => void
  onRetryEmployees: () => void | Promise<void>
}

export function DocumentPickerModal({
  visible,
  insets,
  styles,
  pickerQuery,
  setPickerQuery,
  availableEmployees,
  filteredEmployees,
  filterEmployeeId,
  setFilterEmployeeId,
  onClose,
  onRetryEmployees,
}: DocumentPickerModalProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.pickerOverlay,
          {
            paddingTop: Math.max(16, insets.top + 8),
            paddingBottom: Math.max(16, insets.bottom + 12),
          },
        ]}
      >
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={onClose} style={styles.pickerBack}>
            <Ionicons name="arrow-back" size={18} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.pickerTitle}>Trabajador</Text>
        </View>

        <View style={styles.pickerSearchWrap}>
          <TextInput
            value={pickerQuery}
            onChangeText={setPickerQuery}
            placeholder="Buscar trabajador..."
            placeholderTextColor={COLORS.neutral}
            style={styles.pickerSearchInput}
          />
        </View>

        <ScrollView contentContainerStyle={styles.pickerList}>
          {availableEmployees.length === 0 ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={[styles.modalHint, { marginTop: 12 }]}>Cargando trabajadores...</Text>
              <TouchableOpacity
                onPress={() => {
                  void onRetryEmployees()
                }}
                style={[
                  DOCUMENTS_UI.chip,
                  { marginTop: 16, borderColor: COLORS.accent, backgroundColor: "rgba(226, 0, 106, 0.10)" },
                ]}
              >
                <Text style={{ fontWeight: "700", color: COLORS.accent }}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : filteredEmployees.length === 0 ? (
            <Text style={styles.modalHint}>No se encontraron trabajadores con ese nombre.</Text>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => {
                  setFilterEmployeeId(null)
                  onClose()
                }}
                style={[styles.pickerItem, !filterEmployeeId ? styles.pickerItemActive : null]}
              >
                <Text style={styles.pickerItemTitle}>Todos los trabajadores</Text>
              </TouchableOpacity>
              {filteredEmployees.map((emp) => {
                const active = filterEmployeeId === emp.id
                return (
                  <TouchableOpacity
                    key={emp.id}
                    onPress={() => {
                      setFilterEmployeeId(emp.id)
                      onClose()
                    }}
                    style={[styles.pickerItem, active ? styles.pickerItemActive : null]}
                  >
                    <Text style={styles.pickerItemTitle}>{emp.full_name}</Text>
                  </TouchableOpacity>
                )
              })}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}
