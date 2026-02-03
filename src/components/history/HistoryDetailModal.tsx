import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "@/constants/colors";
import { HISTORY_UI } from "@/components/history/ui";
import type { DerivedLog } from "@/components/history/types";

type HistoryDetailModalProps = {
  visible: boolean;
  log: DerivedLog | null;
  onClose: () => void;
  formatHour: (value: string) => string;
  formatDuration: (minutes: number | null) => string;
  getSiteName: (
    sites: { name: string | null } | { name: string | null }[] | null,
  ) => string | null;
};

export default function HistoryDetailModal({
  visible,
  log,
  onClose,
  formatHour,
  formatDuration,
  getSiteName,
}: HistoryDetailModalProps) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={styles.modalCard}
        >
          <Text style={styles.modalTitle}>Detalle del registro</Text>
          {log ? (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.modalLabel}>Acción</Text>
              <Text style={styles.modalValue}>
                {log.action === "check_in" ? "Entrada" : "Salida"}
              </Text>

              <Text style={styles.modalLabel}>Hora</Text>
              <Text style={styles.modalValue}>{formatHour(log.occurred_at)}</Text>

              <Text style={styles.modalLabel}>Sede</Text>
              <Text style={styles.modalValue}>
                {getSiteName(log.sites) ?? "Sin sede"}
              </Text>

              <Text style={styles.modalLabel}>Estado</Text>
              <Text style={styles.modalValue}>{log.statusLabel}</Text>

              <Text style={styles.modalLabel}>Duración</Text>
              <Text style={styles.modalValue}>
                {formatDuration(log.durationMinutes)}
              </Text>

              <Text style={styles.modalLabel}>Precisión</Text>
              <Text style={styles.modalValue}>
                {log.accuracy_meters != null
                  ? `${Math.round(log.accuracy_meters)}m`
                  : "--"}
              </Text>
            </View>
          ) : null}
          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                HISTORY_UI.chip,
                {
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.porcelainAlt,
                },
              ]}
            >
              <Text style={styles.cancelText}>Cerrar</Text>
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
  modalLabel: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 10,
  },
  modalValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 16,
  },
  cancelText: {
    fontWeight: "700",
    color: COLORS.text,
  },
});
