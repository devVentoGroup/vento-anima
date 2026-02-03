import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native"
import DateTimePicker from "@react-native-community/datetimepicker"
import { Ionicons } from "@expo/vector-icons"

import { COLORS } from "@/constants/colors"
import { DOCUMENTS_UI } from "@/components/documents/ui"

type DocumentScope = "employee" | "site" | "group"
type DocumentType = {
  id: string
  name: string
  scope: DocumentScope
  requires_expiry: boolean
  validity_months: number | null
  reminder_days: number | null
  is_active: boolean
  display_order?: number | null
}
type SiteOption = {
  id: string
  name: string
}
type SelectedFile = {
  uri: string
  name: string
  size: number | null
  mime: string
}

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
  availableEmployees: Array<{ id: string; full_name: string }>
  loadAvailableEmployees: () => void | Promise<void>
  selectedEmployee: { id: string; full_name: string } | null
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
  filteredEmployees: Array<{ id: string; full_name: string }>
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
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => setScope("employee")}
                style={[
                  DOCUMENTS_UI.chip,
                  {
                    flex: 1,
                    borderColor: scope === "employee" ? COLORS.accent : COLORS.border,
                    backgroundColor: scope === "employee" ? "rgba(226, 0, 106, 0.10)" : "white",
                  },
                ]}
              >
                <Text style={{ textAlign: "center", fontWeight: "700", color: COLORS.text }}>
                  Personal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setScope("site")}
                disabled={!canManageScopes}
                style={[
                  DOCUMENTS_UI.chip,
                  {
                    flex: 1,
                    borderColor: scope === "site" ? COLORS.accent : COLORS.border,
                    backgroundColor: scope === "site" ? "rgba(226, 0, 106, 0.10)" : "white",
                    opacity: canManageScopes ? 1 : 0.4,
                  },
                ]}
              >
                <Text style={{ textAlign: "center", fontWeight: "700", color: COLORS.text }}>Sede</Text>
              </TouchableOpacity>
            </View>

            {scope === "employee" ? (
              <>
                <Text style={styles.modalLabel}>Trabajador</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (availableEmployees.length === 0) {
                      void loadAvailableEmployees()
                    }
                    setPickerQuery("")
                    setActivePicker("employee")
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
                      void loadDocumentTypes()
                    }
                    setPickerQuery("")
                    setActivePicker("type")
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
                    setPickerQuery("")
                    setActivePicker("site")
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
                        ? sites.find((site) => site.id === activeSiteId)?.name ?? "Selecciona la sede"
                        : "Selecciona la sede"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={COLORS.neutral} />
                  </View>
                </TouchableOpacity>
              </>
            ) : null}

            {selectedType?.requires_expiry ? (
              <>
                <Text style={styles.modalLabel}>Fecha de expedición</Text>
                <TouchableOpacity
                  onPress={() => {
                    setTempIssueDate(issueDate ?? new Date())
                    setShowIssuePicker(true)
                  }}
                  style={[
                    DOCUMENTS_UI.chip,
                    { borderColor: COLORS.border, backgroundColor: COLORS.porcelainAlt, marginTop: 6 },
                  ]}
                >
                  <Text style={{ fontWeight: "700", color: COLORS.text }}>
                    {issueDate ? formatShortDate(formatDateOnly(issueDate)) : "Seleccionar fecha"}
                  </Text>
                </TouchableOpacity>

                {showIssuePicker && Platform.OS === "ios" ? (
                  <Modal
                    transparent
                    visible={showIssuePicker}
                    animationType="slide"
                    onRequestClose={() => {
                      setShowIssuePicker(false)
                      setTempIssueDate(null)
                    }}
                  >
                    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
                      <View
                        style={{
                          backgroundColor: "white",
                          borderTopLeftRadius: 20,
                          borderTopRightRadius: 20,
                          padding: 20,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 16,
                          }}
                        >
                          <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text }}>
                            Fecha de expedición
                          </Text>
                          <TouchableOpacity
                            onPress={() => {
                              setShowIssuePicker(false)
                              setTempIssueDate(null)
                            }}
                            style={{ padding: 8 }}
                          >
                            <Ionicons name="close" size={24} color={COLORS.text} />
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={tempIssueDate ?? new Date()}
                          mode="date"
                          display="spinner"
                          onChange={(event, date) => {
                            if (date) {
                              setTempIssueDate(date)
                            }
                          }}
                          maximumDate={new Date()}
                          style={{ height: 200 }}
                        />
                        <TouchableOpacity
                          onPress={() => {
                            if (tempIssueDate) {
                              setIssueDate(tempIssueDate)
                              setIsExpiryManual(false)
                            }
                            setShowIssuePicker(false)
                            setTempIssueDate(null)
                          }}
                          style={[
                            DOCUMENTS_UI.chip,
                            {
                              marginTop: 16,
                              borderColor: COLORS.accent,
                              backgroundColor: "rgba(226, 0, 106, 0.10)",
                              paddingVertical: 12,
                              alignItems: "center",
                            },
                          ]}
                        >
                          <Text style={{ fontWeight: "800", color: COLORS.accent }}>Confirmar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Modal>
                ) : showIssuePicker && Platform.OS === "android" ? (
                  <DateTimePicker
                    value={issueDate ?? new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowIssuePicker(false)
                      if (date) {
                        setIssueDate(date)
                        setIsExpiryManual(false)
                      }
                    }}
                    maximumDate={new Date()}
                  />
                ) : null}

                <Text style={styles.modalLabel}>Vencimiento</Text>
                <TouchableOpacity
                  onPress={() => {
                    setIsExpiryManual(true)
                    const defaultExpiry = issueDate
                      ? addMonthsSafe(issueDate, selectedType?.validity_months ?? 3)
                      : new Date()
                    setTempExpiryDate(expiryDate ?? defaultExpiry)
                    setShowExpiryPicker(true)
                  }}
                  style={[
                    DOCUMENTS_UI.chip,
                    { borderColor: COLORS.border, backgroundColor: COLORS.porcelainAlt, marginTop: 6 },
                  ]}
                >
                  <Text style={{ fontWeight: "700", color: COLORS.text }}>
                    {expiryDate ? formatShortDate(formatDateOnly(expiryDate)) : "Seleccionar fecha"}
                  </Text>
                </TouchableOpacity>

                {showExpiryPicker && Platform.OS === "ios" ? (
                  <Modal
                    transparent
                    visible={showExpiryPicker}
                    animationType="slide"
                    onRequestClose={() => {
                      setShowExpiryPicker(false)
                      setTempExpiryDate(null)
                    }}
                  >
                    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
                      <View
                        style={{
                          backgroundColor: "white",
                          borderTopLeftRadius: 20,
                          borderTopRightRadius: 20,
                          padding: 20,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 16,
                          }}
                        >
                          <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text }}>
                            Fecha de vencimiento
                          </Text>
                          <TouchableOpacity
                            onPress={() => {
                              setShowExpiryPicker(false)
                              setTempExpiryDate(null)
                            }}
                            style={{ padding: 8 }}
                          >
                            <Ionicons name="close" size={24} color={COLORS.text} />
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={
                            tempExpiryDate ??
                            (issueDate ? addMonthsSafe(issueDate, selectedType?.validity_months ?? 3) : new Date())
                          }
                          mode="date"
                          display="spinner"
                          onChange={(event, date) => {
                            if (date) {
                              setTempExpiryDate(date)
                            }
                          }}
                          minimumDate={issueDate ?? undefined}
                          style={{ height: 200 }}
                        />
                        <TouchableOpacity
                          onPress={() => {
                            if (tempExpiryDate) {
                              setExpiryDate(tempExpiryDate)
                              setIsExpiryManual(true)
                            }
                            setShowExpiryPicker(false)
                            setTempExpiryDate(null)
                          }}
                          style={[
                            DOCUMENTS_UI.chip,
                            {
                              marginTop: 16,
                              borderColor: COLORS.accent,
                              backgroundColor: "rgba(226, 0, 106, 0.10)",
                              paddingVertical: 12,
                              alignItems: "center",
                            },
                          ]}
                        >
                          <Text style={{ fontWeight: "800", color: COLORS.accent }}>Confirmar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Modal>
                ) : showExpiryPicker && Platform.OS === "android" ? (
                  <DateTimePicker
                    value={
                      expiryDate ??
                      (issueDate ? addMonthsSafe(issueDate, selectedType?.validity_months ?? 3) : new Date())
                    }
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowExpiryPicker(false)
                      if (date) {
                        setExpiryDate(date)
                        setIsExpiryManual(true)
                      }
                    }}
                    minimumDate={issueDate ?? undefined}
                  />
                ) : null}

                {selectedType?.validity_months ? (
                  <Text style={styles.modalHint}>Vigencia sugerida: {selectedType.validity_months} meses.</Text>
                ) : null}
              </>
            ) : null}

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
              <TouchableOpacity onPress={() => setActivePicker(null)} style={styles.pickerBack}>
                <Ionicons name="arrow-back" size={18} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.pickerTitle}>
                {activePicker === "type" ? "Tipo de documento" : activePicker === "employee" ? "Trabajador" : "Sede"}
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
                    const active = selectedTypeId === type.id
                    return (
                      <TouchableOpacity
                        key={type.id}
                        onPress={() => {
                          setSelectedTypeId(type.id)
                          setActivePicker(null)
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
                    )
                  })
                )
              ) : activePicker === "employee" ? (
                availableEmployees.length === 0 ? (
                  <View style={{ padding: 20, alignItems: "center" }}>
                    <ActivityIndicator size="small" color={COLORS.accent} />
                    <Text style={[styles.modalHint, { marginTop: 12 }]}>Cargando trabajadores...</Text>
                    <TouchableOpacity
                      onPress={() => {
                        void loadAvailableEmployees()
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
                    const active = selectedEmployeeId === emp.id
                    return (
                      <TouchableOpacity
                        key={emp.id}
                        onPress={() => {
                          setSelectedEmployeeId(emp.id)
                          setActivePicker(null)
                        }}
                        style={[styles.pickerItem, active ? styles.pickerItemActive : null]}
                      >
                        <Text style={styles.pickerItemTitle}>{emp.full_name}</Text>
                      </TouchableOpacity>
                    )
                  })
                )
              ) : filteredSites.length === 0 ? (
                <Text style={styles.modalHint}>No hay sedes disponibles para seleccionar.</Text>
              ) : (
                filteredSites.map((site) => {
                  const active = activeSiteId === site.id
                  return (
                    <TouchableOpacity
                      key={site.id}
                      onPress={() => {
                        setSiteId(site.id)
                        setActivePicker(null)
                      }}
                      style={[styles.pickerItem, active ? styles.pickerItemActive : null]}
                    >
                      <Text style={styles.pickerItemTitle}>{site.name}</Text>
                    </TouchableOpacity>
                  )
                })
              )}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  )
}
