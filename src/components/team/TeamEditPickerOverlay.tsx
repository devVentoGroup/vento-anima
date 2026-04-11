import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/constants/colors";
import type { EditFormState, RoleRow, SiteRow } from "@/components/team/types";

type TeamEditPickerOverlayProps = {
  activePicker: "editRole" | "editPrimary" | "editSites" | null;
  insets: { top: number; bottom: number };
  styles: Record<string, any>;
  pickerQuery: string;
  filteredRoleOptions: RoleRow[];
  filteredSiteOptions: SiteRow[];
  form: EditFormState;
  onClosePicker: () => void;
  onSetPickerQuery: (value: string) => void;
  onUpdateForm: (patch: Partial<EditFormState>) => void;
  onToggleSite: (siteId: string) => void;
  onSetPrimarySite: (siteId: string) => void;
};

export function TeamEditPickerOverlay({
  activePicker,
  insets,
  styles,
  pickerQuery,
  filteredRoleOptions,
  filteredSiteOptions,
  form,
  onClosePicker,
  onSetPickerQuery,
  onUpdateForm,
  onToggleSite,
  onSetPrimarySite,
}: TeamEditPickerOverlayProps) {
  if (!activePicker) return null;

  return (
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
  );
}
