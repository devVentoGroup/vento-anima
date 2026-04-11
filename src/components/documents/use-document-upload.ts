import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "@/lib/supabase";
import {
  addMonthsSafe,
  formatDateOnly,
} from "@/components/documents/date-utils";
import type {
  AvailableEmployee,
  DocumentScope,
  DocumentType,
  SelectedFile,
  SiteOption,
} from "@/components/documents/types";

function base64ToBinary(base64: string): string {
  if (typeof atob !== "undefined") {
    return atob(base64);
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  let i = 0;
  while (i < base64.length) {
    const enc1 = chars.indexOf(base64.charAt(i++));
    const enc2 = chars.indexOf(base64.charAt(i++));
    const enc3 = chars.indexOf(base64.charAt(i++));
    const enc4 = chars.indexOf(base64.charAt(i++));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    result += String.fromCharCode(chr1);
    if (enc3 !== 64) result += String.fromCharCode(chr2);
    if (enc4 !== 64) result += String.fromCharCode(chr3);
  }
  return result;
}

type UseDocumentUploadArgs = {
  userId: string | undefined;
  employeeId: string | undefined;
  canManageScopes: boolean;
  selectedSiteId: string | null;
  documentTypes: DocumentType[];
  sites: SiteOption[];
  availableEmployees: AvailableEmployee[];
  loadDocuments: () => Promise<void>;
};

export function useDocumentUpload({
  userId,
  employeeId,
  canManageScopes,
  selectedSiteId,
  documentTypes,
  sites,
  availableEmployees,
  loadDocuments,
}: UseDocumentUploadArgs) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [description, setDescription] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [scope, setScope] = useState<DocumentScope>("employee");
  const [siteId, setSiteId] = useState<string | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [issueDate, setIssueDate] = useState<Date | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [showIssuePicker, setShowIssuePicker] = useState(false);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [tempIssueDate, setTempIssueDate] = useState<Date | null>(null);
  const [tempExpiryDate, setTempExpiryDate] = useState<Date | null>(null);
  const [isExpiryManual, setIsExpiryManual] = useState(false);
  const [activePicker, setActivePicker] = useState<"type" | "site" | "employee" | null>(
    null,
  );
  const [pickerQuery, setPickerQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const activeSiteId = useMemo(() => {
    if (siteId) return siteId;
    if (selectedSiteId) return selectedSiteId;
    return sites[0]?.id ?? null;
  }, [siteId, selectedSiteId, sites]);

  const availableTypes = useMemo(
    () => documentTypes.filter((type) => type.scope === scope),
    [documentTypes, scope],
  );

  const filteredTypes = useMemo(() => {
    if (!pickerQuery.trim()) return availableTypes;
    const q = pickerQuery.trim().toLowerCase();
    return availableTypes.filter((type) => type.name.toLowerCase().includes(q));
  }, [availableTypes, pickerQuery]);

  const filteredSites = useMemo(() => {
    if (!pickerQuery.trim()) return sites;
    const q = pickerQuery.trim().toLowerCase();
    return sites.filter((site) => site.name.toLowerCase().includes(q));
  }, [pickerQuery, sites]);

  const filteredEmployees = useMemo(() => {
    if (!pickerQuery.trim()) return availableEmployees;
    const q = pickerQuery.trim().toLowerCase();
    return availableEmployees.filter((emp) =>
      emp.full_name.toLowerCase().includes(q),
    );
  }, [availableEmployees, pickerQuery]);

  const selectedEmployee = useMemo(
    () => availableEmployees.find((emp) => emp.id === selectedEmployeeId) ?? null,
    [availableEmployees, selectedEmployeeId],
  );

  const selectedType = useMemo(
    () => documentTypes.find((type) => type.id === selectedTypeId) ?? null,
    [documentTypes, selectedTypeId],
  );

  useEffect(() => {
    setIssueDate(null);
    setExpiryDate(null);
    setIsExpiryManual(false);
  }, [selectedTypeId]);

  useEffect(() => {
    if (scope !== "site") {
      setCustomTitle("");
    }
  }, [scope]);

  useEffect(() => {
    setActivePicker(null);
    setPickerQuery("");
  }, [scope]);

  useEffect(() => {
    if (!selectedType || !selectedType.requires_expiry) return;
    if (!issueDate) return;
    if (isExpiryManual) return;
    if (selectedType.validity_months) {
      setExpiryDate(addMonthsSafe(issueDate, selectedType.validity_months));
    }
  }, [selectedType, issueDate, isExpiryManual]);

  useEffect(() => {
    if (!selectedTypeId) return;
    const match = documentTypes.find((type) => type.id === selectedTypeId);
    if (!match || match.scope !== scope) {
      setSelectedTypeId(null);
    }
  }, [documentTypes, scope, selectedTypeId]);

  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return;
    const file = result.assets[0];
    setSelectedFile({
      uri: file.uri,
      name: file.name ?? "documento.pdf",
      size: file.size ?? null,
      mime: file.mimeType ?? "application/pdf",
    });
  }, []);

  const resetUpload = useCallback(() => {
    setSelectedFile(null);
    setDescription("");
    setCustomTitle("");
    setScope("employee");
    setSiteId(selectedSiteId ?? null);
    setSelectedTypeId(null);
    setIssueDate(null);
    setExpiryDate(null);
    setIsExpiryManual(false);
    setShowIssuePicker(false);
    setShowExpiryPicker(false);
    setActivePicker(null);
    setPickerQuery("");
    setSelectedEmployeeId(null);
    setTempIssueDate(null);
    setTempExpiryDate(null);
  }, [selectedSiteId]);

  const closeUploadModal = useCallback(() => {
    setIsUploadOpen(false);
    setActivePicker(null);
    setShowIssuePicker(false);
    setShowExpiryPicker(false);
  }, []);

  const openUpload = useCallback(() => {
    resetUpload();
    setIsUploadOpen(true);
  }, [resetUpload]);

  const handleSaveDocument = useCallback(async () => {
    if (!userId || !employeeId) return;
    if (!selectedFile) {
      Alert.alert("Documento", "Selecciona un PDF.");
      return;
    }
    if (scope === "site" && !activeSiteId) {
      Alert.alert("Documento", "Selecciona una sede.");
      return;
    }
    if (scope === "employee") {
      if (!selectedTypeId) {
        Alert.alert("Documento", "Selecciona un tipo de documento.");
        return;
      }
      if (!selectedEmployeeId) {
        Alert.alert("Documento", "Selecciona un trabajador.");
        return;
      }
    }
    if (scope === "site" && !customTitle.trim()) {
      Alert.alert("Documento", "Escribe el nombre del documento.");
      return;
    }

    const activeType = scope === "employee" ? selectedType ?? null : null;
    if (scope === "employee" && !activeType) {
      Alert.alert("Documento", "Selecciona un tipo de documento.");
      return;
    }

    let issueDateValue: string | null = null;
    let expiryDateValue: string | null = null;

    if (activeType && activeType.requires_expiry) {
      if (!issueDate) {
        Alert.alert("Documento", "Selecciona la fecha de expedición.");
        return;
      }

      const computedExpiry =
        expiryDate ??
        (activeType.validity_months
          ? addMonthsSafe(issueDate, activeType.validity_months)
          : null);

      if (!computedExpiry) {
        Alert.alert("Documento", "Selecciona la fecha de vencimiento.");
        return;
      }

      issueDateValue = formatDateOnly(issueDate);
      expiryDateValue = formatDateOnly(computedExpiry);
    }

    setIsSaving(true);
    try {
      const safeName = selectedFile.name.replace(/\s+/g, "_");
      const storagePath = `${userId}/${Date.now()}_${safeName}`;

      const insertPayload = {
        scope,
        owner_employee_id: userId,
        target_employee_id: scope === "employee" ? (selectedEmployeeId ?? userId) : null,
        site_id: scope === "site" ? activeSiteId : null,
        title: scope === "site" ? customTitle.trim() : activeType?.name ?? "",
        description: description.trim() || null,
        storage_path: storagePath,
        file_name: selectedFile.name,
        file_size_bytes: selectedFile.size,
        file_mime: selectedFile.mime,
        document_type_id: activeType?.id ?? null,
        issue_date: issueDateValue,
        expiry_date: expiryDateValue,
      };

      const base64Data = await FileSystem.readAsStringAsync(selectedFile.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!base64Data || base64Data.length === 0) {
        throw new Error("El archivo está vacío o no se pudo leer");
      }

      const binaryString = base64ToBinary(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const arrayBuffer = bytes.buffer;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, arrayBuffer, {
          contentType: "application/pdf",
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: insertError } = await supabase
        .from("documents")
        .insert(insertPayload);

      if (insertError) {
        await supabase.storage.from("documents").remove([storagePath]);
        throw insertError;
      }

      await loadDocuments();
      setIsUploadOpen(false);
      Alert.alert("Documento", "Documento subido correctamente.");
    } catch (err) {
      console.error("Upload error:", err);
      Alert.alert(
        "Documento",
        `No se pudo subir el documento: ${err instanceof Error ? err.message : "Error desconocido"}`,
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    activeSiteId,
    customTitle,
    description,
    employeeId,
    expiryDate,
    issueDate,
    loadDocuments,
    scope,
    selectedEmployeeId,
    selectedFile,
    selectedType,
    selectedTypeId,
    userId,
  ]);

  return {
    isUploadOpen,
    setIsUploadOpen,
    selectedFile,
    description,
    setDescription,
    customTitle,
    setCustomTitle,
    scope,
    setScope,
    siteId,
    setSiteId,
    selectedTypeId,
    setSelectedTypeId,
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
    isSaving,
    selectedEmployeeId,
    setSelectedEmployeeId,
    availableTypes,
    filteredTypes,
    filteredSites,
    filteredEmployees,
    selectedEmployee,
    selectedType,
    activeSiteId,
    pickDocument,
    resetUpload,
    closeUploadModal,
    openUpload,
    handleSaveDocument,
  };
}
