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
  const hasInvite = Boolean(inviteEmailSent);
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
              <Text style={styles.modalTitle}>Invitar trabajador</Text>
              <Text style={styles.modalSubtitle}>
                Si no tiene cuenta, le enviaremos un correo con el enlace para crearla. Si ya tiene cuenta (ej. en Vento Pass), se agregará al equipo y podrá entrar con su correo y contraseña.
              </Text>

              <Text style={styles.modalLabel}>Correo</Text>
              <TextInput
                value={form.email}
                onChangeText={(value) => onUpdateForm({ email: value })}
                placeholder="correo@empresa.com"
                placeholderTextColor={COLORS.neutral}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />

              <Text style={styles.modalLabel}>Nombre completo</Text>
              <TextInput
                value={form.fullName}
                onChangeText={(value) => onUpdateForm({ fullName: value })}
                placeholder="Nombre completo"
                placeholderTextColor={COLORS.neutral}
                style={styles.input}
              />

              <Text style={styles.modalLabel}>Rol</Text>
              <TouchableOpacity
                onPress={() => onOpenPicker("inviteRole")}
                style={[
                  TEAM_UI.chip,
                  {
                    borderColor: COLORS.border,
                    backgroundColor: COLORS.porcelainAlt,
                    marginTop: 6,
                  },
                ]}
              >
                <View style={styles.selectRow}>
                  <Text style={styles.selectText}>
                    {inviteRoleLabel ?? "Selecciona un rol"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.neutral} />
                </View>
              </TouchableOpacity>

              <Text style={styles.modalLabel}>Sede principal</Text>
              <TouchableOpacity
                onPress={canPickSites ? () => onOpenPicker("inviteSite") : undefined}
                disabled={!canPickSites}
                style={[
                  TEAM_UI.chip,
                  {
                    borderColor: COLORS.border,
                    backgroundColor: COLORS.porcelainAlt,
                    marginTop: 6,
                    opacity: canPickSites ? 1 : 0.6,
                  },
                ]}
              >
                <View style={styles.selectRow}>
                  <Text style={styles.selectText}>
                    {inviteSiteLabel ?? "Selecciona la sede"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.neutral} />
                </View>
              </TouchableOpacity>

              {hasInvite ? (
                <View style={styles.successBox}>
                  <Text style={styles.successTitle}>
                    {inviteSuccessMessage ? "Agregado al equipo" : "Invitacion enviada"}
                  </Text>
                  <Text style={styles.modalHint}>
                    {inviteSuccessMessage ?? `Correo enviado a ${inviteEmailSent}.`}
                  </Text>
                </View>
              ) : null}

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
                  <Text style={styles.cancelText}>{hasInvite ? "Cerrar" : "Cancelar"}</Text>
                </TouchableOpacity>
                {!hasInvite ? (
                  <TouchableOpacity
                    onPress={onSubmit}
                    disabled={isInviting}
                    style={[
                      TEAM_UI.chip,
                      {
                        borderColor: COLORS.rosegold,
                        backgroundColor: "rgba(242, 198, 192, 0.25)",
                        opacity: isInviting ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={styles.saveText}>
                      {isInviting ? "Enviando..." : "Enviar invitación"}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>

        {activePicker ? (
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
              <TouchableOpacity onPress={onClosePicker} style={styles.pickerBack}>
                <Ionicons name="arrow-back" size={18} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>
                {activePicker === "inviteRole" ? "Rol" : "Sede principal"}
              </Text>
            </View>

            <View style={styles.pickerSearchWrap}>
              <TextInput
                value={pickerQuery}
                onChangeText={onSetPickerQuery}
                placeholder={activePicker === "inviteRole" ? "Buscar rol..." : "Buscar sede..."}
                placeholderTextColor={COLORS.neutral}
                style={styles.pickerSearchInput}
              />
            </View>

            <ScrollView contentContainerStyle={styles.pickerList}>
              {activePicker === "inviteRole" ? (
                filteredRoleOptions.length === 0 ? (
                  <Text style={styles.modalHint}>No hay roles disponibles.</Text>
                ) : (
                  filteredRoleOptions.map((item) => {
                    const active = form.role === item.code;
                    return (
                      <TouchableOpacity
                        key={item.code}
                        onPress={() => {
                          onUpdateForm({ role: item.code });
                          onClosePicker();
                        }}
                        style={[styles.pickerItem, active ? styles.pickerItemActive : null]}
                      >
                        <Text style={styles.pickerItemTitle}>{item.name}</Text>
                      </TouchableOpacity>
                    );
                  })
                )
              ) : (
                filteredSiteOptions.map((site) => {
                  const active = form.siteId === site.id;
                  return (
                    <TouchableOpacity
                      key={site.id}
                      onPress={() => {
                        onUpdateForm({ siteId: site.id });
                        onClosePicker();
                      }}
                      style={[styles.pickerItem, active ? styles.pickerItemActive : null]}
                    >
                      <Text style={styles.pickerItemTitle}>{site.name}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        ) : null}
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

