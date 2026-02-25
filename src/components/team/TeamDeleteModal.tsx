import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import { TEAM_UI } from "@/components/team/ui";

type TeamDeleteModalProps = {
  visible: boolean;
  insets: EdgeInsets;
  employeeName: string;
  confirmText: string;
  isDeleting: boolean;
  onChangeConfirmText: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export default function TeamDeleteModal({
  visible,
  insets,
  employeeName,
  confirmText,
  isDeleting,
  onChangeConfirmText,
  onClose,
  onConfirm,
}: TeamDeleteModalProps) {
  const canDelete = confirmText.trim().toUpperCase() === "ELIMINAR";

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={[styles.card, { marginTop: insets.top + 24 }]}
        >
          <View style={styles.headerRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="warning-outline" size={18} color={COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Eliminar trabajador</Text>
              <Text style={styles.subtitle}>
                Esta acción elimina cuenta, acceso y registros asociados.
              </Text>
            </View>
          </View>

          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Se eliminará de forma permanente: {employeeName}
            </Text>
            <Text style={[styles.warningText, { marginTop: 4 }]}>
              Para confirmar escribe exactamente: ELIMINAR
            </Text>
          </View>

          <TextInput
            value={confirmText}
            onChangeText={onChangeConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="ELIMINAR"
            placeholderTextColor={COLORS.neutral}
            style={styles.input}
          />

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onClose}
              disabled={isDeleting}
              style={[
                TEAM_UI.chip,
                {
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.porcelainAlt,
                  opacity: isDeleting ? 0.6 : 1,
                },
              ]}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={!canDelete || isDeleting}
              style={[
                TEAM_UI.chip,
                {
                  borderColor: COLORS.accent,
                  backgroundColor: "rgba(226, 0, 106, 0.12)",
                  opacity: !canDelete || isDeleting ? 0.6 : 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                },
              ]}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : (
                <Ionicons name="trash-outline" size={16} color={COLORS.accent} />
              )}
              <Text style={styles.deleteText}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 20,
  },
  card: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 520,
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(226, 0, 106, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(226, 0, 106, 0.25)",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.neutral,
  },
  warningBox: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    padding: 12,
  },
  warningText: {
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 17,
  },
  input: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
  },
  actions: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelText: {
    color: COLORS.text,
    fontWeight: "700",
  },
  deleteText: {
    color: COLORS.accent,
    fontWeight: "800",
  },
});
