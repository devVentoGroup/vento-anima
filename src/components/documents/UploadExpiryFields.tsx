import { Modal, Platform, Text, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { COLORS } from "@/constants/colors";
import { DOCUMENTS_UI } from "@/components/documents/ui";
import { DocumentDatePickerSheet } from "@/components/documents/DocumentDatePickerSheet";
import type { DocumentType } from "@/components/documents/types";

type UploadExpiryFieldsProps = {
  styles: Record<string, any>;
  selectedType: DocumentType | null;
  issueDate: Date | null;
  setIssueDate: (value: Date | null) => void;
  expiryDate: Date | null;
  setExpiryDate: (value: Date | null) => void;
  showIssuePicker: boolean;
  setShowIssuePicker: (value: boolean) => void;
  showExpiryPicker: boolean;
  setShowExpiryPicker: (value: boolean) => void;
  tempIssueDate: Date | null;
  setTempIssueDate: (value: Date | null) => void;
  tempExpiryDate: Date | null;
  setTempExpiryDate: (value: Date | null) => void;
  isExpiryManual: boolean;
  setIsExpiryManual: (value: boolean) => void;
  addMonthsSafe: (date: Date, months: number) => Date;
  formatDateOnly: (value: Date) => string;
  formatShortDate: (value: string | null) => string;
};

export function UploadExpiryFields({
  styles,
  selectedType,
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
  addMonthsSafe,
  formatDateOnly,
  formatShortDate,
}: UploadExpiryFieldsProps) {
  if (!selectedType?.requires_expiry) return null;

  const defaultExpiry = issueDate
    ? addMonthsSafe(issueDate, selectedType.validity_months ?? 3)
    : new Date();

  return (
    <>
      <Text style={styles.modalLabel}>Fecha de expedición</Text>
      <TouchableOpacity
        onPress={() => {
          setTempIssueDate(issueDate ?? new Date());
          setShowIssuePicker(true);
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
        <DocumentDatePickerSheet
          visible={showIssuePicker}
          title="Fecha de expedición"
          value={tempIssueDate ?? new Date()}
          maximumDate={new Date()}
          onClose={() => {
            setShowIssuePicker(false);
            setTempIssueDate(null);
          }}
          onChange={setTempIssueDate}
          onConfirm={() => {
            if (tempIssueDate) {
              setIssueDate(tempIssueDate);
              setIsExpiryManual(false);
            }
            setShowIssuePicker(false);
            setTempIssueDate(null);
          }}
        />
      ) : showIssuePicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={issueDate ?? new Date()}
          mode="date"
          display="default"
          onChange={(_, date) => {
            setShowIssuePicker(false);
            if (date) {
              setIssueDate(date);
              setIsExpiryManual(false);
            }
          }}
          maximumDate={new Date()}
        />
      ) : null}

      <Text style={styles.modalLabel}>Vencimiento</Text>
      <TouchableOpacity
        onPress={() => {
          setIsExpiryManual(true);
          setTempExpiryDate(expiryDate ?? defaultExpiry);
          setShowExpiryPicker(true);
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
        <DocumentDatePickerSheet
          visible={showExpiryPicker}
          title="Fecha de vencimiento"
          value={tempExpiryDate ?? defaultExpiry}
          minimumDate={issueDate ?? undefined}
          onClose={() => {
            setShowExpiryPicker(false);
            setTempExpiryDate(null);
          }}
          onChange={setTempExpiryDate}
          onConfirm={() => {
            if (tempExpiryDate) {
              setExpiryDate(tempExpiryDate);
              setIsExpiryManual(true);
            }
            setShowExpiryPicker(false);
            setTempExpiryDate(null);
          }}
        />
      ) : showExpiryPicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={expiryDate ?? defaultExpiry}
          mode="date"
          display="default"
          onChange={(_, date) => {
            setShowExpiryPicker(false);
            if (date) {
              setExpiryDate(date);
              setIsExpiryManual(true);
            }
          }}
          minimumDate={issueDate ?? undefined}
        />
      ) : null}

      {selectedType.validity_months ? (
        <Text style={styles.modalHint}>
          Vigencia sugerida: {selectedType.validity_months} meses.
        </Text>
      ) : null}
    </>
  );
}
