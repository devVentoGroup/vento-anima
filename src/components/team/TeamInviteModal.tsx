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
import { TeamInviteFormFields } from "@/components/team/TeamInviteFormFields";
import { TeamInvitePickerOverlay } from "@/components/team/TeamInvitePickerOverlay";
import { TEAM_UI } from "@/components/team/ui";
import type { InviteFormState, RoleRow, SiteRow } from "@/components/team/types";

type TeamInviteModalProps = {
  visible: boolean;
  insets: { top: number; bottom: number };
  form: InviteFormState;
  inviteEmailSent: string | null;
  // Cuando se agrega al equipo sin invitar (ya tenia cuenta).
  inviteSuccessMessage?: string | null;
  isInviting: boolean;
  canPickSites: boolean;
  inviteRoleLabel: string | null;
  inviteSiteLabel: string | null;
  activePicker: "inviteRole" | "inviteSite" | null;
  pickerQuery: string;
  filteredRoleOptions: RoleRow[];
  filteredSiteOptions: SiteRow[];
  onClose: () => void;
  onSubmit: () => void;
  onOpenPicker: (picker: "inviteRole" | "inviteSite") => void;
  onClosePicker: () => void;
  onSetPickerQuery: (value: string) => void;
  onUpdateForm: (patch: Partial<InviteFormState>) => void;
};

export default function TeamInviteModal({
  visible,
  insets,
  form,
  inviteEmailSent,
  inviteSuccessMessage = null,
  isInviting,
  canPickSites,
  inviteRoleLabel,
  inviteSiteLabel,
  activePicker,
  pickerQuery,
  filteredRoleOptions,
  filteredSiteOptions,
  onClose,
  onSubmit,
  onOpenPicker,
  onClosePicker,
  onSetPickerQuery,
  onUpdateForm,
}: TeamInviteModalProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const isKeyboardVisible = keyboardHeight > 0;
  const modalTopGap = Math.max(14, insets.top + 8);
  const modalBottomGap = 20;
  const modalMaxHeight = useMemo(() => {
    if (isKeyboardVisible) {
      return Math.max(220, windowHeight - keyboardHeight - modalTopGap - modalBottomGap);
    }
    return Math.max(320, windowHeight - modalBottomGap * 2);
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
              <TeamInviteFormFields
                styles={styles}
                form={form}
                inviteEmailSent={inviteEmailSent}
                inviteSuccessMessage={inviteSuccessMessage}
                isInviting={isInviting}
                canPickSites={canPickSites}
                inviteRoleLabel={inviteRoleLabel}
                inviteSiteLabel={inviteSiteLabel}
                onClose={onClose}
                onSubmit={onSubmit}
                onOpenPicker={onOpenPicker}
                onUpdateForm={onUpdateForm}
              />
            </ScrollView>
          </View>
        </View>

        <TeamInvitePickerOverlay
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
  successBox: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    padding: 12,
  },
  successTitle: {
    fontWeight: "800",
    color: COLORS.text,
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
});

