import {
  Keyboard,
  KeyboardEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useEffect, useMemo, useState } from "react";
import { COLORS } from "@/constants/colors";
import { MODAL_MAX_WIDTH } from "@/constants/layout";
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
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const isKeyboardVisible = keyboardHeight > 0;
  const modalTopGap = 18;
  const modalBottomGap = 20;
  const modalMaxHeight = useMemo(() => {
    if (isKeyboardVisible) {
      return Math.max(220, windowHeight - keyboardHeight - modalTopGap - modalBottomGap);
    }
    return Math.max(280, windowHeight - modalBottomGap * 2);
  }, [isKeyboardVisible, keyboardHeight, windowHeight]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates.height);
    };
    const onHide = () => {
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return (
    <Modal transparent visible={visible} animationType="fade">
      <Pressable
        style={[
          styles.modalOverlay,
          isKeyboardVisible ? styles.modalOverlayKeyboard : styles.modalOverlayCentered,
          { paddingTop: isKeyboardVisible ? modalTopGap : 20, paddingBottom: 20 },
        ]}
        onPress={onCancel}
      >
        <View style={styles.keyboardWrap}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.modalCard, { maxHeight: modalMaxHeight }]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              <Text style={styles.modalTitle}>Incidencia</Text>
              <Text style={styles.modalSubtitle}>
                Describe lo que paso en este registro.
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
            </ScrollView>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalOverlayCentered: {
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalOverlayKeyboard: {
    justifyContent: "flex-start",
    paddingHorizontal: 20,
  },
  keyboardWrap: {
    width: "100%",
    maxWidth: MODAL_MAX_WIDTH,
    alignSelf: "center",
  },
  modalCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scrollContent: {
    paddingBottom: 4,
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
    flexWrap: "wrap",
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
