import {
  ActivityIndicator,
  FlatList,
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
import { MODAL_MAX_WIDTH } from "@/constants/layout";

export type WorkerOption = {
  id: string;
  full_name: string | null;
  alias: string | null;
};

type ContactWorkerModalProps = {
  visible: boolean;
  workers: WorkerOption[];
  isLoadingWorkers: boolean;
  selectedWorker: WorkerOption | null;
  onSelectWorker: (worker: WorkerOption | null) => void;
  onClose: () => void;
  mode: "aviso" | "conversacion";
  message: string;
  onChangeMessage: (value: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
};

export default function ContactWorkerModal({
  visible,
  workers,
  isLoadingWorkers,
  selectedWorker,
  onSelectWorker,
  onClose,
  mode,
  message,
  onChangeMessage,
  isSubmitting,
  onSubmit,
}: ContactWorkerModalProps) {
  const displayName = selectedWorker
    ? selectedWorker.full_name ?? selectedWorker.alias ?? selectedWorker.id
    : "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.box} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === "aviso" ? "Enviar aviso a trabajador" : "Iniciar conversación"}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={COLORS.neutral} />
            </TouchableOpacity>
          </View>

          {!selectedWorker ? (
            <>
              <Text style={styles.label}>Selecciona un trabajador</Text>
              {isLoadingWorkers ? (
                <View style={styles.loader}>
                  <ActivityIndicator color={COLORS.accent} />
                </View>
              ) : (
                <FlatList
                  data={workers}
                  keyExtractor={(item) => item.id}
                  style={styles.list}
                  renderItem={({ item }) => {
                    const name = item.full_name ?? item.alias ?? item.id;
                    return (
                      <TouchableOpacity
                        style={styles.row}
                        onPress={() => onSelectWorker(item)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="person-outline" size={18} color={COLORS.text} />
                        <Text style={styles.rowLabel}>{name}</Text>
                        <Ionicons name="chevron-forward" size={18} color={COLORS.neutral} />
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.selectedRow}
                onPress={() => onSelectWorker(null)}
              >
                <Text style={styles.selectedLabel}>{displayName}</Text>
                <Text style={styles.changeText}>Cambiar</Text>
              </TouchableOpacity>

              <Text style={styles.label}>
                {mode === "aviso"
                  ? "Escribe el aviso (el trabajador lo verá en Soporte)"
                  : "Mensaje inicial (opcional)"}
              </Text>
              <TextInput
                value={message}
                onChangeText={onChangeMessage}
                placeholder={
                  mode === "aviso"
                    ? "Ej: Recuerda enviar el reporte antes de las 18:00"
                    : "Escribe un mensaje para iniciar la conversación..."
                }
                placeholderTextColor={COLORS.neutral}
                style={styles.input}
                multiline
                numberOfLines={3}
              />

              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={onClose}
                  disabled={isSubmitting}
                >
                  <Text style={styles.btnSecondaryText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={onSubmit}
                  disabled={isSubmitting || (mode === "aviso" && !message.trim())}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.btnPrimaryText}>
                      {mode === "aviso" ? "Enviar aviso" : "Iniciar conversación"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  box: {
    width: "100%",
    maxWidth: MODAL_MAX_WIDTH,
    maxHeight: "80%",
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  loader: {
    padding: 24,
    alignItems: "center",
  },
  list: {
    maxHeight: 280,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    marginBottom: 8,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: "rgba(226, 0, 106, 0.08)",
    marginBottom: 16,
  },
  selectedLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  changeText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.accent,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.porcelainAlt,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 90,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 100,
    alignItems: "center",
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  btnPrimary: {
    backgroundColor: COLORS.accent,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.white,
  },
});
