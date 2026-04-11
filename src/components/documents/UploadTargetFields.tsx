import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/constants/colors";
import { DOCUMENTS_UI } from "@/components/documents/ui";
import type { AvailableEmployee, DocumentType, SiteOption } from "@/components/documents/types";

type UploadTargetFieldsProps = {
  styles: Record<string, any>;
  scope: "employee" | "site" | "group";
  availableEmployees: AvailableEmployee[];
  loadAvailableEmployees: () => void | Promise<void>;
  selectedEmployee: AvailableEmployee | null;
  documentTypes: DocumentType[];
  loadDocumentTypes: () => void | Promise<void>;
  selectedType: DocumentType | null;
  activeSiteId: string | null;
  sites: SiteOption[];
  customTitle: string;
  setCustomTitle: (value: string) => void;
  setPickerQuery: (value: string) => void;
  setActivePicker: (value: "type" | "site" | "employee" | null) => void;
};

export function UploadTargetFields({
  styles,
  scope,
  availableEmployees,
  loadAvailableEmployees,
  selectedEmployee,
  documentTypes,
  loadDocumentTypes,
  selectedType,
  activeSiteId,
  sites,
  customTitle,
  setCustomTitle,
  setPickerQuery,
  setActivePicker,
}: UploadTargetFieldsProps) {
  return (
    <>
      {scope === "employee" ? (
        <>
          <Text style={styles.modalLabel}>Trabajador</Text>
          <TouchableOpacity
            onPress={() => {
              if (availableEmployees.length === 0) {
                void loadAvailableEmployees();
              }
              setPickerQuery("");
              setActivePicker("employee");
            }}
            style={[
              DOCUMENTS_UI.chip,
              {
                borderColor: COLORS.border,
                backgroundColor: COLORS.porcelainAlt,
                marginTop: 6,
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontWeight: "700", color: COLORS.text, flex: 1 }}>
                {selectedEmployee ? selectedEmployee.full_name : "Selecciona un trabajador"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.neutral} />
            </View>
          </TouchableOpacity>

          <Text style={styles.modalLabel}>Tipo de documento</Text>
          <TouchableOpacity
            onPress={() => {
              if (documentTypes.length === 0) {
                void loadDocumentTypes();
              }
              setPickerQuery("");
              setActivePicker("type");
            }}
            style={[
              DOCUMENTS_UI.chip,
              {
                borderColor: COLORS.border,
                backgroundColor: COLORS.porcelainAlt,
                marginTop: 6,
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontWeight: "700", color: COLORS.text, flex: 1 }}>
                {selectedType ? selectedType.name : "Selecciona un tipo"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.neutral} />
            </View>
          </TouchableOpacity>
        </>
      ) : null}

      {scope === "site" ? (
        <>
          <Text style={styles.modalLabel}>Nombre del documento</Text>
          <TextInput
            value={customTitle}
            onChangeText={setCustomTitle}
            placeholder="Ej: Manual de sede, checklist, etc."
            placeholderTextColor={COLORS.neutral}
            style={styles.input}
          />

          <Text style={styles.modalLabel}>Sede</Text>
          <TouchableOpacity
            onPress={() => {
              setPickerQuery("");
              setActivePicker("site");
            }}
            style={[
              DOCUMENTS_UI.chip,
              {
                borderColor: COLORS.border,
                backgroundColor: COLORS.porcelainAlt,
                marginTop: 6,
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontWeight: "700", color: COLORS.text, flex: 1 }}>
                {activeSiteId
                  ? sites.find((site) => site.id === activeSiteId)?.name ??
                    "Selecciona la sede"
                  : "Selecciona la sede"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.neutral} />
            </View>
          </TouchableOpacity>
        </>
      ) : null}
    </>
  );
}
