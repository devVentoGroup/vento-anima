import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/constants/colors";
import type { InviteFormState, RoleRow, SiteRow } from "@/components/team/types";

type TeamInvitePickerOverlayProps = {
  activePicker: "inviteRole" | "inviteSite" | null;
  insets: { top: number; bottom: number };
  styles: Record<string, any>;
  pickerQuery: string;
  filteredRoleOptions: RoleRow[];
  filteredSiteOptions: SiteRow[];
  form: InviteFormState;
  onClosePicker: () => void;
  onSetPickerQuery: (value: string) => void;
  onUpdateForm: (patch: Partial<InviteFormState>) => void;
};

export function TeamInvitePickerOverlay({
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
}: TeamInvitePickerOverlayProps) {
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
  );
}
