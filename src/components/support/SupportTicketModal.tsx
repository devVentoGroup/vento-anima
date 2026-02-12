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
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import { MODAL_MAX_WIDTH } from "@/constants/layout";
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
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const isKeyboardVisible = keyboardHeight > 0;
  const modalTopGap = 18;
  const modalBottomGap = 20;
  const modalMaxHeight = useMemo(() => {
    if (isKeyboardVisible) {
      return Math.max(220, windowHeight - keyboardHeight - modalTopGap - modalBottomGap);
    }
    return Math.max(300, windowHeight - modalBottomGap * 2);
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
        onPress={onClose}
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

