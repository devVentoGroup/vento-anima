import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native"

import { COLORS } from "@/constants/colors"
import { UploadExpiryFields } from "@/components/documents/UploadExpiryFields"
import { UploadPickerOverlay } from "@/components/documents/UploadPickerOverlay"
import { UploadScopeSelector } from "@/components/documents/UploadScopeSelector"
import { UploadTargetFields } from "@/components/documents/UploadTargetFields"
import { DOCUMENTS_UI } from "@/components/documents/ui"
import type {
  AvailableEmployee,
  DocumentScope,
  DocumentType,
  SelectedFile,
  SiteOption,
} from "@/components/documents/types"

type UploadDocumentModalProps = {
  visible: boolean
  insets: { top: number; bottom: number }
  styles: Record<string, any>
  onClose: () => void
  onSave: () => void
  isSaving: boolean
  scope: DocumentScope
  setScope: (value: DocumentScope) => void
  canManageScopes: boolean
  availableEmployees: AvailableEmployee[]
  loadAvailableEmployees: () => void | Promise<void>
  selectedEmployee: AvailableEmployee | null
  selectedEmployeeId: string | null
  setSelectedEmployeeId: (value: string | null) => void
  documentTypes: DocumentType[]
  loadDocumentTypes: () => void | Promise<void>
  selectedType: DocumentType | null
  selectedTypeId: string | null
  setSelectedTypeId: (value: string | null) => void
  selectedFile: SelectedFile | null
  pickDocument: () => void
  description: string
  setDescription: (value: string) => void
  customTitle: string
  setCustomTitle: (value: string) => void
  activeSiteId: string | null
  sites: SiteOption[]
  setSiteId: (value: string | null) => void
  issueDate: Date | null
  setIssueDate: (value: Date | null) => void
  expiryDate: Date | null
  setExpiryDate: (value: Date | null) => void
  showIssuePicker: boolean
  setShowIssuePicker: (value: boolean) => void
  showExpiryPicker: boolean
  setShowExpiryPicker: (value: boolean) => void
  tempIssueDate: Date | null
  setTempIssueDate: (value: Date | null) => void
  tempExpiryDate: Date | null
  setTempExpiryDate: (value: Date | null) => void
  isExpiryManual: boolean
  setIsExpiryManual: (value: boolean) => void
  activePicker: "type" | "site" | "employee" | null
  setActivePicker: (value: "type" | "site" | "employee" | null) => void
  pickerQuery: string
  setPickerQuery: (value: string) => void
  filteredTypes: DocumentType[]
  filteredEmployees: AvailableEmployee[]
  filteredSites: SiteOption[]
  addMonthsSafe: (date: Date, months: number) => Date
  formatDateOnly: (value: Date) => string
  formatShortDate: (value: string | null) => string
}

export function UploadDocumentModal({
  visible,
  insets,
  styles,
  onClose,
  onSave,
  isSaving,
  scope,
  setScope,
  canManageScopes,
  availableEmployees,
  loadAvailableEmployees,
  selectedEmployee,
  selectedEmployeeId,
  setSelectedEmployeeId,
  documentTypes,
  loadDocumentTypes,
  selectedType,
  selectedTypeId,
  setSelectedTypeId,
  selectedFile,
  pickDocument,
  description,
  setDescription,
  customTitle,
  setCustomTitle,
  activeSiteId,
  sites,
  setSiteId,
  issueDate,
  setIssueDate,
  expiryDate,
  setExpiryDate,
  showIssuePicker,
  setShowIssuePicker,
  showExpiryPicker,
  setShowExpiryPicker,
  tempIssueDate,
  setTempIssueDate,
  tempExpiryDate,
  setTempExpiryDate,
  isExpiryManual,
  setIsExpiryManual,
  activePicker,
  setActivePicker,
  pickerQuery,
  setPickerQuery,
  filteredTypes,
  filteredEmployees,
  filteredSites,
  addMonthsSafe,
  formatDateOnly,
  formatShortDate,
}: UploadDocumentModalProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Subir documento</Text>
            <Text style={styles.modalSubtitle}>Solo PDF. Selecciona el tipo y agrega fechas si aplica.</Text>

            <Text style={styles.modalLabel}>Alcance</Text>
            <UploadScopeSelector
              scope={scope}
              canManageScopes={canManageScopes}
              setScope={setScope}
            />

            <Text style={styles.modalLabel}>Documento PDF</Text>
            <TouchableOpacity
              onPress={pickDocument}
              style={[
                DOCUMENTS_UI.chip,
                { borderColor: COLORS.border, backgroundColor: COLORS.porcelainAlt, marginTop: 6 },
              ]}
            >
              <Text style={{ fontWeight: "700", color: COLORS.text }}>
                {selectedFile ? selectedFile.name : "Seleccionar PDF"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Descripción</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Descripción (opcional)"
              placeholderTextColor={COLORS.neutral}
              style={styles.input}
            />

            <UploadTargetFields
              styles={styles}
              scope={scope}
              availableEmployees={availableEmployees}
              loadAvailableEmployees={loadAvailableEmployees}
              selectedEmployee={selectedEmployee}
              documentTypes={documentTypes}
              loadDocumentTypes={loadDocumentTypes}
              selectedType={selectedType}
              activeSiteId={activeSiteId}
              sites={sites}
              customTitle={customTitle}
              setCustomTitle={setCustomTitle}
              setPickerQuery={setPickerQuery}
              setActivePicker={setActivePicker}
            />

            <UploadExpiryFields
              styles={styles}
              selectedType={selectedType}
              issueDate={issueDate}
              setIssueDate={setIssueDate}
              expiryDate={expiryDate}
              setExpiryDate={setExpiryDate}
              showIssuePicker={showIssuePicker}
              setShowIssuePicker={setShowIssuePicker}
              showExpiryPicker={showExpiryPicker}
              setShowExpiryPicker={setShowExpiryPicker}
              tempIssueDate={tempIssueDate}
              setTempIssueDate={setTempIssueDate}
              tempExpiryDate={tempExpiryDate}
              setTempExpiryDate={setTempExpiryDate}
              isExpiryManual={isExpiryManual}
              setIsExpiryManual={setIsExpiryManual}
              addMonthsSafe={addMonthsSafe}
              formatDateOnly={formatDateOnly}
              formatShortDate={formatShortDate}
            />

            <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <TouchableOpacity
                onPress={onClose}
                style={[
                  DOCUMENTS_UI.chip,
                  { borderColor: COLORS.border, backgroundColor: COLORS.porcelainAlt },
                ]}
              >
                <Text style={{ fontWeight: "700", color: COLORS.text }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onSave}
                disabled={isSaving}
                style={[
                  DOCUMENTS_UI.chip,
                  {
                    borderColor: COLORS.rosegold,
                    backgroundColor: "rgba(242, 198, 192, 0.25)",
                    opacity: isSaving ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ fontWeight: "700", color: COLORS.rosegold }}>
                  {isSaving ? "Guardando..." : "Subir"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <UploadPickerOverlay
          activePicker={activePicker}
          insets={insets}
          styles={styles}
          pickerQuery={pickerQuery}
          setPickerQuery={setPickerQuery}
          setActivePicker={setActivePicker}
          filteredTypes={filteredTypes}
          filteredEmployees={filteredEmployees}
          filteredSites={filteredSites}
          availableEmployees={availableEmployees}
          selectedTypeId={selectedTypeId}
          setSelectedTypeId={setSelectedTypeId}
          selectedEmployeeId={selectedEmployeeId}
          setSelectedEmployeeId={setSelectedEmployeeId}
          activeSiteId={activeSiteId}
          setSiteId={setSiteId}
          loadAvailableEmployees={loadAvailableEmployees}
        />
      </View>
    </Modal>
  )
}
