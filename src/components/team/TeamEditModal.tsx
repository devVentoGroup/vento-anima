import {
  Keyboard,
  KeyboardEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useEffect, useMemo, useState } from "react";
import { COLORS } from "@/constants/colors";
import { MODAL_MAX_WIDTH } from "@/constants/layout";
import { TeamEditFormFields } from "@/components/team/TeamEditFormFields";
import { TeamEditPickerOverlay } from "@/components/team/TeamEditPickerOverlay";
import { TEAM_UI } from "@/components/team/ui";
import type { EditFormState, RoleRow, SiteRow } from "@/components/team/types";

type TeamEditModalProps = {
  visible: boolean;
  insets: { top: number; bottom: number };
  form: EditFormState;
  roleName: string | null;
  primarySiteLabel: string | null;
  canPickRole: boolean;
  canPickSites: boolean;
  isSaving: boolean;
  activePicker: "editRole" | "editPrimary" | "editSites" | null;
  pickerQuery: string;
  filteredRoleOptions: RoleRow[];
  filteredSiteOptions: SiteRow[];
  onClose: () => void;
  onSave: () => void;
  onOpenPicker: (picker: "editRole" | "editPrimary" | "editSites") => void;
  onClosePicker: () => void;
  onSetPickerQuery: (value: string) => void;
  onUpdateForm: (patch: Partial<EditFormState>) => void;
  onToggleSite: (siteId: string) => void;
  onSetPrimarySite: (siteId: string) => void;
};

export default function TeamEditModal({
  visible,
  insets,
  form,
  roleName,
  primarySiteLabel,
  canPickRole,
  canPickSites,
  isSaving,
  activePicker,
  pickerQuery,
  filteredRoleOptions,
  filteredSiteOptions,
  onClose,
  onSave,
  onOpenPicker,
  onClosePicker,
  onSetPickerQuery,
  onUpdateForm,
  onToggleSite,
  onSetPrimarySite,
}: TeamEditModalProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const isKeyboardVisible = keyboardHeight > 0;
  const modalTopGap = Math.max(14, insets.top + 8);
  const modalBottomGap = 20;
  const modalMaxHeight = useMemo(() => {
    if (isKeyboardVisible) {
      return Math.max(240, windowHeight - keyboardHeight - modalTopGap - modalBottomGap);
    }
    return Math.max(340, windowHeight - modalBottomGap * 2);
  }, [isKeyboardVisible, keyboardHeight, windowHeight, modalTopGap]);

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
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modalOverlay,
          isKeyboardVisible ? styles.modalOverlayKeyboard : styles.modalOverlayCentered,
          { paddingTop: isKeyboardVisible ? modalTopGap : 20, paddingBottom: 20 },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <View style={styles.keyboardWrap}>
          <View style={[styles.modalCard, { maxHeight: modalMaxHeight }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              <TeamEditFormFields
                styles={styles}
                form={form}
                roleName={roleName}
                primarySiteLabel={primarySiteLabel}
                canPickRole={canPickRole}
                canPickSites={canPickSites}
                onOpenPicker={onOpenPicker}
                onUpdateForm={onUpdateForm}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={onClose}
                  style={[
                    TEAM_UI.chip,
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
                    TEAM_UI.chip,
                    {
                      borderColor: COLORS.rosegold,
                      backgroundColor: "rgba(242, 198, 192, 0.25)",
                      opacity: isSaving ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={styles.saveText}>{isSaving ? "Guardando..." : "Guardar"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>

        <TeamEditPickerOverlay
          activePicker={activePicker}
          insets={insets}
          styles={styles}
          pickerQuery={pickerQuery}
          filteredRoleOptions={filteredRoleOptions}
          filteredSiteOptions={filteredSiteOptions}
          form={form}
          onClosePicker={onClosePicker}
          onSetPickerQuery={onSetPickerQuery}
          onUpdateForm={onUpdateForm}
          onToggleSite={onToggleSite}
          onSetPrimarySite={onSetPrimarySite}
        />
      </View>
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
  modalLabel: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 12,
  },
  modalHint: {
    fontSize: 11,
    color: COLORS.neutral,
    marginTop: 6,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    padding: 12,
    marginTop: 6,
    color: COLORS.text,
  },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectText: {
    fontWeight: "700",
    color: COLORS.text,
    flex: 1,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 16,
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
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.porcelain,
    paddingTop: 20,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  pickerBack: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  pickerSearchWrap: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  pickerSearchInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 12,
    color: COLORS.text,
  },
  pickerList: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 10,
  },
  pickerItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 14,
  },
  pickerItemActive: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(226, 0, 106, 0.10)",
  },
  pickerItemTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },
  siteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  siteRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  siteRowText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "600",
  },
  siteRowPrimary: {
    padding: 6,
  },
});
