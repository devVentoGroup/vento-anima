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
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import { MODAL_MAX_WIDTH } from "@/constants/layout";
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
              <Text style={styles.modalTitle}>Editar trabajador</Text>
              <Text style={styles.modalSubtitle}>
                Actualiza datos basicos, rol y sedes.
              </Text>

              <Text style={styles.modalLabel}>Nombre completo</Text>
              <TextInput
                value={form.fullName}
                onChangeText={(value) => onUpdateForm({ fullName: value })}
                placeholder="Nombre completo"
                placeholderTextColor={COLORS.neutral}
                style={styles.input}
              />

              <Text style={styles.modalLabel}>Alias</Text>
              <TextInput
                value={form.alias}
                onChangeText={(value) => onUpdateForm({ alias: value })}
                placeholder="Alias (opcional)"
                placeholderTextColor={COLORS.neutral}
                style={styles.input}
              />

              <Text style={styles.modalLabel}>Rol</Text>
              <TouchableOpacity
                onPress={canPickRole ? () => onOpenPicker("editRole") : undefined}
                disabled={!canPickRole}
                style={[
                  TEAM_UI.chip,
                  {
                    borderColor: COLORS.border,
                    backgroundColor: COLORS.porcelainAlt,
                    marginTop: 6,
                    opacity: canPickRole ? 1 : 0.6,
                  },
                ]}
              >
                <View style={styles.selectRow}>
                  <Text style={styles.selectText}>{roleName ?? "Selecciona un rol"}</Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.neutral} />
                </View>
              </TouchableOpacity>

              <Text style={styles.modalLabel}>Sede principal</Text>
              <TouchableOpacity
                onPress={canPickSites ? () => onOpenPicker("editPrimary") : undefined}
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
                    {primarySiteLabel ?? "Selecciona la sede principal"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={COLORS.neutral} />
                </View>
              </TouchableOpacity>

              {canPickSites ? (
                <>
                  <Text style={styles.modalLabel}>Sedes asignadas</Text>
                  <TouchableOpacity
                    onPress={() => onOpenPicker("editSites")}
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
                        {form.siteIds.length
                          ? `${form.siteIds.length} sedes seleccionadas`
                          : "Selecciona sedes"}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={COLORS.neutral} />
                    </View>
                  </TouchableOpacity>
                </>
              ) : null}

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Activo</Text>
                <Switch
                  value={form.isActive}
                  onValueChange={(value) => onUpdateForm({ isActive: value })}
                  trackColor={{ false: COLORS.border, true: COLORS.rosegoldBright }}
                  thumbColor={form.isActive ? COLORS.rosegold : COLORS.neutral}
                />
              </View>

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
                {activePicker === "editRole"
                  ? "Rol"
                  : activePicker === "editPrimary"
                    ? "Sede principal"
                    : "Sedes asignadas"}
              </Text>
            </View>

            <View style={styles.pickerSearchWrap}>
              <TextInput
                value={pickerQuery}
                onChangeText={onSetPickerQuery}
                placeholder={activePicker === "editRole" ? "Buscar rol..." : "Buscar sede..."}
                placeholderTextColor={COLORS.neutral}
                style={styles.pickerSearchInput}
              />
            </View>

            <ScrollView contentContainerStyle={styles.pickerList}>
              {activePicker === "editRole" ? (
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
              ) : activePicker === "editPrimary" ? (
                filteredSiteOptions.map((site) => {
                  const active = form.primarySiteId === site.id;
                  return (
                    <TouchableOpacity
                      key={site.id}
                      onPress={() => {
                        onSetPrimarySite(site.id);
                        onClosePicker();
                      }}
                      style={[styles.pickerItem, active ? styles.pickerItemActive : null]}
                    >
                      <Text style={styles.pickerItemTitle}>{site.name}</Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                filteredSiteOptions.map((site) => {
                  const selected = form.siteIds.includes(site.id);
                  const isPrimary = form.primarySiteId === site.id;
                  return (
                    <View key={site.id} style={styles.siteRow}>
                      <TouchableOpacity onPress={() => onToggleSite(site.id)} style={styles.siteRowLeft}>
                        <Ionicons
                          name={selected ? "checkbox" : "square-outline"}
                          size={18}
                          color={selected ? COLORS.accent : COLORS.neutral}
                        />
                        <Text style={styles.siteRowText}>{site.name}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => onSetPrimarySite(site.id)}
                        disabled={!selected}
                        style={styles.siteRowPrimary}
                      >
                        <Ionicons
                          name={isPrimary ? "star" : "star-outline"}
                          size={18}
                          color={isPrimary ? COLORS.rosegold : COLORS.neutral}
                        />
                      </TouchableOpacity>
                    </View>
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
