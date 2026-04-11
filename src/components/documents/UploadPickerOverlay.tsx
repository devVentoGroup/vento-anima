import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/constants/colors";
import { DOCUMENTS_UI } from "@/components/documents/ui";
import type { AvailableEmployee, DocumentType, SiteOption } from "@/components/documents/types";

type UploadPickerOverlayProps = {
  activePicker: "type" | "site" | "employee" | null;
  insets: { top: number; bottom: number };
  styles: Record<string, any>;
  pickerQuery: string;
  setPickerQuery: (value: string) => void;
  setActivePicker: (value: "type" | "site" | "employee" | null) => void;
  filteredTypes: DocumentType[];
  filteredEmployees: AvailableEmployee[];
  filteredSites: SiteOption[];
  availableEmployees: AvailableEmployee[];
  selectedTypeId: string | null;
  setSelectedTypeId: (value: string | null) => void;
  selectedEmployeeId: string | null;
  setSelectedEmployeeId: (value: string | null) => void;
  activeSiteId: string | null;
  setSiteId: (value: string | null) => void;
  loadAvailableEmployees: () => void | Promise<void>;
};

export function UploadPickerOverlay({
  activePicker,
  insets,
  styles,
  pickerQuery,
  setPickerQuery,
  setActivePicker,
  filteredTypes,
  filteredEmployees,
  filteredSites,
  availableEmployees,
  selectedTypeId,
  setSelectedTypeId,
  selectedEmployeeId,
  setSelectedEmployeeId,
  activeSiteId,
  setSiteId,
  loadAvailableEmployees,
}: UploadPickerOverlayProps) {
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
        <TouchableOpacity onPress={() => setActivePicker(null)} style={styles.pickerBack}>
          <Ionicons name="arrow-back" size={18} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.pickerTitle}>
          {activePicker === "type"
            ? "Tipo de documento"
            : activePicker === "employee"
              ? "Trabajador"
              : "Sede"}
        </Text>
      </View>

      <View style={styles.pickerSearchWrap}>
        <TextInput
          value={pickerQuery}
          onChangeText={setPickerQuery}
          placeholder={
            activePicker === "type"
              ? "Buscar tipo..."
              : activePicker === "employee"
                ? "Buscar trabajador..."
                : "Buscar sede..."
          }
          placeholderTextColor={COLORS.neutral}
          style={styles.pickerSearchInput}
        />
      </View>

      <ScrollView contentContainerStyle={styles.pickerList}>
        {activePicker === "type" ? (
          filteredTypes.length === 0 ? (
            <Text style={styles.modalHint}>No hay tipos disponibles para este alcance.</Text>
          ) : (
            filteredTypes.map((type) => {
              const active = selectedTypeId === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  onPress={() => {
                    setSelectedTypeId(type.id);
                    setActivePicker(null);
                  }}
                  style={[styles.pickerItem, active ? styles.pickerItemActive : null]}
                >
                  <Text style={styles.pickerItemTitle}>{type.name}</Text>
                  {type.validity_months ? (
                    <Text style={styles.pickerItemHint}>
                      Vigencia sugerida: {type.validity_months} meses
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )
        ) : activePicker === "employee" ? (
          availableEmployees.length === 0 ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={[styles.modalHint, { marginTop: 12 }]}>Cargando trabajadores...</Text>
              <TouchableOpacity
                onPress={() => {
                  void loadAvailableEmployees();
                }}
                style={[
                  DOCUMENTS_UI.chip,
                  {
                    marginTop: 16,
                    borderColor: COLORS.accent,
                    backgroundColor: "rgba(226, 0, 106, 0.10)",
                  },
                ]}
              >
                <Text style={{ fontWeight: "700", color: COLORS.accent }}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : filteredEmployees.length === 0 ? (
            <Text style={styles.modalHint}>No se encontraron trabajadores con ese nombre.</Text>
          ) : (
            filteredEmployees.map((emp) => {
              const active = selectedEmployeeId === emp.id;
              return (
                <TouchableOpacity
                  key={emp.id}
                  onPress={() => {
                    setSelectedEmployeeId(emp.id);
                    setActivePicker(null);
                  }}
                  style={[styles.pickerItem, active ? styles.pickerItemActive : null]}
                >
                  <Text style={styles.pickerItemTitle}>{emp.full_name}</Text>
                </TouchableOpacity>
              );
            })
          )
        ) : filteredSites.length === 0 ? (
          <Text style={styles.modalHint}>No hay sedes disponibles para seleccionar.</Text>
        ) : (
          filteredSites.map((site) => {
            const active = activeSiteId === site.id;
            return (
              <TouchableOpacity
                key={site.id}
                onPress={() => {
                  setSiteId(site.id);
                  setActivePicker(null);
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
