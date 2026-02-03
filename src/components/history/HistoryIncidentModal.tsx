import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "@/constants/colors";
import { HISTORY_UI } from "@/components/history/ui";

type HistoryIncidentModalProps = {
  visible: boolean;
  incidentText: string;
  isSaving: boolean;
  onChangeText: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

export default function HistoryIncidentModal({
  visible,
  incidentText,
  isSaving,
  onChangeText,
  onCancel,
  onSave,
}: HistoryIncidentModalProps) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={onCancel}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={styles.modalCard}
        >
          <Text style={styles.modalTitle}>Incidencia</Text>
          <Text style={styles.modalSubtitle}>
            Describe lo que pasó en este registro.
          </Text>

          <TextInput
            value={incidentText}
            onChangeText={onChangeText}
            placeholderTextColor={COLORS.neutral}
            placeholder="Escribe el detalle..."
            multiline
            style={styles.input}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={onCancel}
              style={[
                HISTORY_UI.chip,
                {
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.porcelainAlt,
                },
              ]}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSave}
              disabled={isSaving}
              style={[
                HISTORY_UI.chip,
                {
                  borderColor: COLORS.rosegold,
                  backgroundColor: "rgba(242, 198, 192, 0.25)",
                  opacity: isSaving ? 0.7 : 1,
                },
              ]}
            >
              <Text style={styles.saveText}>
                {isSaving ? "Guardando..." : "Guardar"}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 20,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 6,
  },
  input: {
    minHeight: 90,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    padding: 12,
    marginTop: 12,
    marginBottom: 12,
    color: COLORS.text,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  cancelText: {
    fontWeight: "700",
    color: COLORS.text,
  },
  saveText: {
    fontWeight: "700",
    color: COLORS.rosegold,
  },
});
