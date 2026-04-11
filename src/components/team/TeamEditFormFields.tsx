import { Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/constants/colors";
import { TEAM_UI } from "@/components/team/ui";
import type { EditFormState } from "@/components/team/types";

type TeamEditFormFieldsProps = {
  styles: Record<string, any>;
  form: EditFormState;
  roleName: string | null;
  primarySiteLabel: string | null;
  canPickRole: boolean;
  canPickSites: boolean;
  onOpenPicker: (picker: "editRole" | "editPrimary" | "editSites") => void;
  onUpdateForm: (patch: Partial<EditFormState>) => void;
};

export function TeamEditFormFields({
  styles,
  form,
  roleName,
  primarySiteLabel,
  canPickRole,
  canPickSites,
  onOpenPicker,
  onUpdateForm,
}: TeamEditFormFieldsProps) {
  return (
    <>
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
    </>
  );
}
