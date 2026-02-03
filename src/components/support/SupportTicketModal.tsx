import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import { SUPPORT_UI } from "@/components/support/ui";

type SupportTicketModalProps = {
  visible: boolean;
  message: string;
  onChangeMessage: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export default function SupportTicketModal({
  visible,
  message,
  onChangeMessage,
  onClose,
  onSubmit,
}: SupportTicketModalProps) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={styles.modalCard}
        >
          <Text style={styles.modalTitle}>Nuevo ticket</Text>
          <Text style={styles.modalSubtitle}>
            Describe el problema con el mayor detalle posible.
          </Text>
          <TextInput
            value={message}
            onChangeText={onChangeMessage}
            placeholder="Ej: No puedo registrar entrada en Vento Group."
            placeholderTextColor={COLORS.neutral}
            multiline
            style={styles.input}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                SUPPORT_UI.chip,
                {
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.porcelainAlt,
                },
              ]}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSubmit}
              style={[
                SUPPORT_UI.chip,
                {
                  borderColor: COLORS.accent,
                  backgroundColor: "rgba(226, 0, 106, 0.12)",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                },
              ]}
            >
              <Ionicons name="send-outline" size={16} color={COLORS.accent} />
              <Text style={styles.sendText}>Enviar</Text>
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
    minHeight: 110,
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
  sendText: {
    fontWeight: "800",
    color: COLORS.accent,
  },
});

