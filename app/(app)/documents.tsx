import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as IntentLauncher from "expo-intent-launcher";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";

type DocumentScope = "employee" | "site" | "group";
type DocumentStatus = "pending_review" | "approved" | "rejected";
type DocumentType = {
  id: string;
  name: string;
  scope: DocumentScope;
  requires_expiry: boolean;
  validity_months: number | null;
  reminder_days: number | null;
  is_active: boolean;
  display_order?: number | null;
};
type SiteOption = {
  id: string;
  name: string;
};

type DocumentRow = {
  id: string;
  title: string;
  description: string | null;
  status: DocumentStatus;
  scope: DocumentScope;
  site_id: string | null;
  target_employee_id: string | null;
  document_type_id: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  storage_path: string;
  file_name: string;
  updated_at: string;
  document_type: DocumentType | null;
};

type DocumentRowDb = Omit<DocumentRow, "document_type"> & {
  document_type: DocumentType[] | DocumentType | null;
};

type SelectedFile = {
  uri: string;
  name: string;
  size: number | null;
  mime: string;
};

// Filtros de estado eliminados - solo gerentes suben documentos, no hay necesidad de estados
const DOCUMENT_NOTIFICATION_KEY = "document_notifications_v1";
const DEFAULT_REMINDER_DAYS = 7;
const DOCUMENT_NOTIFICATION_CHANNEL = "document-alerts";
const EXPO_PROJECT_ID = "2e1ba93a-039d-49e7-962d-a33ea7eaf9b3";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const UI = {
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.text,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
} as const;

function addMonthsSafe(date: Date, months: number) {
  const base = new Date(date)
  const day = base.getDate()
  base.setMonth(base.getMonth() + months)
  if (base.getDate() < day) {
    base.setDate(0)
  }
  return base
}
function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

function formatDateOnly(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatShortDate(value: string | null) {
  if (!value) return "Sin vencimiento";
  return parseDateOnly(value).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function diffDays(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime()
  return Math.ceil(ms / 86400000)
}

// Helper para convertir base64 a string binario
function base64ToBinary(base64: string): string {
  if (typeof atob !== 'undefined') {
    return atob(base64);
  }
  // Implementación manual para React Native
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
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

type NotificationMap = Record<string, { id: string; fireAt: number }>

async function loadNotificationMap(): Promise<NotificationMap> {
  const stored = await SecureStore.getItemAsync(DOCUMENT_NOTIFICATION_KEY)
  if (!stored) return {}
  try {
    return JSON.parse(stored) as NotificationMap
  } catch {
    return {}
  }
}

async function saveNotificationMap(map: NotificationMap) {
  await SecureStore.setItemAsync(
    DOCUMENT_NOTIFICATION_KEY,
    JSON.stringify(map),
  )
}

async function clearLocalNotifications() {
  const map = await loadNotificationMap()
  const ids = Object.values(map)
    .map((entry) => entry.id)
    .filter(Boolean)
  for (const id of ids) {
    await Notifications.cancelScheduledNotificationAsync(id)
  }
  await saveNotificationMap({})
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return
  await Notifications.setNotificationChannelAsync(
    DOCUMENT_NOTIFICATION_CHANNEL,
    {
      name: "Alertas de documentos",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    },
  )
}

// Funciones de estado eliminadas - no se usan más

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const { user, employee, employeeSites, selectedSiteId } = useAuth();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [description, setDescription] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [scope, setScope] = useState<DocumentScope>("employee");
  const [siteId, setSiteId] = useState<string | null>(null);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
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
  const [managedSites, setManagedSites] = useState<SiteOption[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [pushTokenReady, setPushTokenReady] = useState(false);
  const pushRegistrationRef = useRef(false);
  const [availableEmployees, setAvailableEmployees] = useState<Array<{ id: string; full_name: string }>>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string | null>(null);

  const canManageScopes = useMemo(() => {
    const role = employee?.role ?? null;
    return (
      role === "propietario" || role === "gerente_general" || role === "gerente"
    );
  }, [employee?.role]);
  const canViewAllSites = useMemo(() => {
    const role = employee?.role ?? null;
    return role === "propietario" || role === "gerente_general";
  }, [employee?.role]);
  const isManager = useMemo(() => employee?.role === "gerente", [employee?.role]);

  const sites = useMemo(() => {
    if (canViewAllSites && managedSites.length > 0) return managedSites;
    if (isManager && employee?.siteId) {
      return [
        {
          id: employee.siteId,
          name: employee.siteName ?? "Sede",
        },
      ];
    }
    if (employeeSites.length === 0) return [];
    return employeeSites.map((site) => ({
      id: site.siteId,
      name: site.siteName,
    }));
  }, [
    employeeSites,
    managedSites,
    canViewAllSites,
    isManager,
    employee?.siteId,
    employee?.siteName,
  ]);

  const activeSiteId = useMemo(() => {
    if (siteId) return siteId;
    if (selectedSiteId) return selectedSiteId;
    return sites[0]?.id ?? null;
  }, [siteId, selectedSiteId, sites]);

  const managerSiteId = useMemo(() => {
    if (isManager && employee?.siteId) return employee.siteId;
    return null;
  }, [isManager, employee?.siteId]);
  const availableTypes = useMemo(() => {
    return documentTypes.filter((type) => type.scope === scope)
  }, [documentTypes, scope])

  const filteredTypes = useMemo(() => {
    if (!pickerQuery.trim()) return availableTypes
    const q = pickerQuery.trim().toLowerCase()
    return availableTypes.filter((type) => type.name.toLowerCase().includes(q))
  }, [availableTypes, pickerQuery])

  const filteredSites = useMemo(() => {
    if (!pickerQuery.trim()) return sites
    const q = pickerQuery.trim().toLowerCase()
    return sites.filter((site) => site.name.toLowerCase().includes(q))
  }, [sites, pickerQuery])

  const filteredEmployees = useMemo(() => {
    if (!pickerQuery.trim()) return availableEmployees
    const q = pickerQuery.trim().toLowerCase()
    return availableEmployees.filter((emp) => emp.full_name.toLowerCase().includes(q))
  }, [availableEmployees, pickerQuery])

  const selectedEmployee = useMemo(() => {
    return availableEmployees.find((emp) => emp.id === selectedEmployeeId) ?? null
  }, [availableEmployees, selectedEmployeeId])

  const selectedType = useMemo(() => {
    const type = documentTypes.find((type) => type.id === selectedTypeId) ?? null
    if (type) {
      console.log('[DOCUMENTS] Selected type:', type.name, 'requires_expiry:', type.requires_expiry, 'validity_months:', type.validity_months)
    }
    return type
  }, [documentTypes, selectedTypeId])
  useEffect(() => {
    setIssueDate(null)
    setExpiryDate(null)
    setIsExpiryManual(false)
  }, [selectedTypeId])
  useEffect(() => {
    if (scope !== "site") {
      setCustomTitle("")
    }
  }, [scope])
  useEffect(() => {
    setActivePicker(null)
    setPickerQuery("")
  }, [scope])
  useEffect(() => {
    if (!selectedType || !selectedType.requires_expiry) return
    if (!issueDate) return
    if (isExpiryManual) return
    if (selectedType.validity_months) {
      setExpiryDate(addMonthsSafe(issueDate, selectedType.validity_months))
    }
  }, [selectedType, issueDate, isExpiryManual])
  useEffect(() => {
    if (!selectedTypeId) return
    const match = documentTypes.find((type) => type.id === selectedTypeId)
    if (!match || match.scope !== scope) {
      setSelectedTypeId(null)
    }
  }, [documentTypes, scope, selectedTypeId])

  const loadDocuments = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      let query = supabase
        .from("documents")
        .select(
          "id, title, description, status, scope, site_id, document_type_id, issue_date, expiry_date, storage_path, file_name, updated_at, target_employee_id, document_type:document_types (id, name, scope, requires_expiry, validity_months, reminder_days, is_active)",
        )
        .order("updated_at", { ascending: false })

      // Si hay filtro de trabajador, aplicarlo
      if (filterEmployeeId && canManageScopes) {
        query = query.eq("target_employee_id", filterEmployeeId)
      }

      const { data, error } = await query

      if (error) throw error
      const normalized = ((data as DocumentRowDb[]) ?? []).map((row) => ({
        ...row,
        document_type: Array.isArray(row.document_type)
          ? row.document_type[0] ?? null
          : row.document_type,
      }))
      setDocuments(normalized)
    } catch (err) {
      console.error("Documents error:", err)
      Alert.alert("Error", "No se pudieron cargar los documentos.")
    } finally {
      setIsLoading(false)
    }
  }, [user, filterEmployeeId, canManageScopes])

  const loadDocumentTypes = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from("document_types")
        .select("id, name, scope, requires_expiry, validity_months, reminder_days, is_active, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true })

      if (error) throw error
      const types = (data as DocumentType[]) ?? []
      console.log('[DOCUMENTS] Loaded document types:', types.map(t => ({ name: t.name, requires_expiry: t.requires_expiry, validity_months: t.validity_months })))
      setDocumentTypes(types)
    } catch (err) {
      console.error("Document types error:", err)
      Alert.alert("Error", "No se pudieron cargar los tipos de documento.")
    }
  }, [user])

  const loadManagedSites = useCallback(async () => {
    if (!user || !canViewAllSites) return
    try {
      const { data, error } = await supabase
        .from("sites")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true })

      if (error) throw error
      setManagedSites((data as SiteOption[]) ?? [])
    } catch (err) {
      console.error("Sites error:", err)
    }
  }, [user, canViewAllSites])

  const loadAvailableEmployees = useCallback(async () => {
    if (!user || !canManageScopes) {
      console.log('[DOCUMENTS] Cannot load employees: user=', !!user, 'canManageScopes=', canManageScopes);
      return;
    }
    try {
      console.log('[DOCUMENTS] Loading available employees...', { isManager, managerSiteId });
      let query = supabase
        .from("employees")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name", { ascending: true })

      // Si es gerente, solo cargar empleados de su sede
      if (isManager && managerSiteId) {
        query = query.eq("site_id", managerSiteId)
        console.log('[DOCUMENTS] Filtering employees by site:', managerSiteId);
      }

      const { data, error } = await query
      if (error) {
        console.error('[DOCUMENTS] Error loading employees:', error);
        throw error;
      }
      console.log('[DOCUMENTS] Loaded employees:', data?.length ?? 0);
      setAvailableEmployees((data ?? []) as Array<{ id: string; full_name: string }>)
    } catch (err) {
      console.error("[DOCUMENTS] Employees load error:", err)
      Alert.alert("Error", "No se pudieron cargar los trabajadores.");
    }
  }, [user, canManageScopes, isManager, managerSiteId])

  const refreshNotificationPermission = useCallback(async () => {
    const permissions = await Notifications.getPermissionsAsync()
    setNotificationsEnabled(permissions.status === "granted")
  }, [])

  const requestNotificationPermission = useCallback(async () => {
    const permissions = await Notifications.requestPermissionsAsync()
    const granted = permissions.status === "granted"
    setNotificationsEnabled(granted)
    if (granted) {
      await ensureAndroidChannel()
      pushRegistrationRef.current = false
    }
  }, [])

  const registerPushToken = useCallback(async () => {
    if (!user || !notificationsEnabled) return
    if (!Device.isDevice) return
    if (pushRegistrationRef.current) {
      console.log('[DOCUMENTS] Push token registration already in progress, skipping')
      return
    }
    pushRegistrationRef.current = true

    try {
      console.log('[DOCUMENTS] Starting push token registration...')
      
      // Timeout para evitar que se quede pendiente
      const tokenPromise = Notifications.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID,
      })
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Push token timeout')), 10000) // 10 segundos timeout
      })
      
      const tokenResult = await Promise.race([tokenPromise, timeoutPromise]) as Awaited<ReturnType<typeof Notifications.getExpoPushTokenAsync>>
      const token = tokenResult.data
      if (!token) {
        console.warn('[DOCUMENTS] No push token received')
        pushRegistrationRef.current = false
        return
      }

      console.log('[DOCUMENTS] Push token obtained, saving to database...')
      
      // Upsert con timeout manual
      const upsertTimeout = setTimeout(() => {
        console.error('[DOCUMENTS] Push token upsert timeout')
        pushRegistrationRef.current = false
      }, 8000)
      
      const { error } = await supabase.from("employee_push_tokens").upsert(
        {
          employee_id: user.id,
          token,
          platform: Platform.OS,
          is_active: true,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "token" },
      )
      
      clearTimeout(upsertTimeout)

      if (error) {
        console.error("[DOCUMENTS] Push token save error:", error)
        pushRegistrationRef.current = false // Resetear para permitir reintento
      } else {
        console.log('[DOCUMENTS] Push token saved successfully')
        setPushTokenReady(true)
      }
    } catch (err) {
      console.error("[DOCUMENTS] Push token registration error:", err)
      pushRegistrationRef.current = false // Resetear para permitir reintento
    }
  }, [user, notificationsEnabled])

  const syncDocumentNotifications = useCallback(
    async (docs: DocumentRow[]) => {
      if (!notificationsEnabled) return
      setIsScheduling(true)
      try {
        await ensureAndroidChannel()
        const map = await loadNotificationMap()
        const nextMap: NotificationMap = {}
        const now = new Date()
        const today = parseDateOnly(formatDateOnly(now))
        const activeDocIds = new Set<string>()

        for (const doc of docs) {
          if (!doc.expiry_date) continue
          // No hay documentos rechazados - solo gerentes suben documentos

          const reminderDays =
            doc.document_type?.reminder_days ?? DEFAULT_REMINDER_DAYS
          const expiry = parseDateOnly(doc.expiry_date)
          const daysLeft = diffDays(expiry, today)
          if (daysLeft <= 0) continue

          const fireDate = new Date(expiry)
          fireDate.setDate(expiry.getDate() - reminderDays)
          fireDate.setHours(9, 0, 0, 0)

          if (fireDate.getTime() <= now.getTime()) continue

          const fireAt = fireDate.getTime()
          activeDocIds.add(doc.id)

          const existing = map[doc.id]
          if (existing && existing.fireAt === fireAt) {
            nextMap[doc.id] = existing
            continue
          }

          if (existing?.id) {
            await Notifications.cancelScheduledNotificationAsync(existing.id)
          }

          const title =
            doc.document_type?.name ?? doc.title ?? "Documento por vencer"
          const body = `Vence el ${formatShortDate(doc.expiry_date)}`
          const content: Notifications.NotificationContentInput = {
            title: "Documento por vencer",
            body: `${title}. ${body}.`,
            data: { documentId: doc.id },
            sound: "default",
          }
          const trigger: Notifications.NotificationTriggerInput =
            Platform.OS === "android"
              ? {
                  type: Notifications.SchedulableTriggerInputTypes.DATE,
                  date: fireDate,
                  channelId: DOCUMENT_NOTIFICATION_CHANNEL,
                }
              : {
                  type: Notifications.SchedulableTriggerInputTypes.DATE,
                  date: fireDate,
                }

          const notificationId = await Notifications.scheduleNotificationAsync({
            content,
            trigger,
          })

          nextMap[doc.id] = { id: notificationId, fireAt }
        }

        for (const docId of Object.keys(map)) {
          if (activeDocIds.has(docId)) continue
          const existing = map[docId]
          if (existing?.id) {
            await Notifications.cancelScheduledNotificationAsync(existing.id)
          }
        }

        await saveNotificationMap(nextMap)
      } catch (err) {
        console.error("Notifications sync error:", err)
      } finally {
        setIsScheduling(false)
      }
    },
    [notificationsEnabled],
  )

  useFocusEffect(
    useCallback(() => {
      void loadDocuments()
      void loadDocumentTypes()
      void loadManagedSites()
      void loadAvailableEmployees()
    }, [loadDocuments, loadDocumentTypes, loadManagedSites, loadAvailableEmployees]),
  )

  useEffect(() => {
    void refreshNotificationPermission()
  }, [refreshNotificationPermission])

  // Ref para evitar múltiples ejecuciones de registerPushToken
  const pushTokenRegisteredRef = useRef(false)
  
  useEffect(() => {
    if (!notificationsEnabled) {
      pushTokenRegisteredRef.current = false
      return
    }
    if (pushTokenRegisteredRef.current) return // Ya se registró
    if (pushTokenReady) {
      pushTokenRegisteredRef.current = true
      return // Ya está listo
    }
    
    pushTokenRegisteredRef.current = true
    void registerPushToken()
  }, [notificationsEnabled, pushTokenReady]) // Sin dependencia de función

  useEffect(() => {
    if (!notificationsEnabled) return
    if (pushTokenReady) return
    void syncDocumentNotifications(documents)
  }, [notificationsEnabled, pushTokenReady, documents, syncDocumentNotifications])

  useEffect(() => {
    if (!pushTokenReady) return
    void clearLocalNotifications()
  }, [pushTokenReady])

  const alertDocuments = useMemo(() => {
    const today = parseDateOnly(formatDateOnly(new Date()))
    return documents
      .filter((doc) => !!doc.expiry_date)
      .map((doc) => {
        const expiry = parseDateOnly(doc.expiry_date!)
        const daysLeft = diffDays(expiry, today)
        const reminderDays =
          doc.document_type?.reminder_days ?? DEFAULT_REMINDER_DAYS
        return { doc, daysLeft, reminderDays }
      })
      .filter(({ daysLeft, reminderDays }) => daysLeft <= reminderDays)
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }, [documents])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadDocuments()
    await loadDocumentTypes()
    setIsRefreshing(false)
  }

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: false,
    })

    if (result.canceled) return
    const file = result.assets[0]
    setSelectedFile({
      uri: file.uri,
      name: file.name ?? "documento.pdf",
      size: file.size ?? null,
      mime: file.mimeType ?? "application/pdf",
    })
  }

  const resetUpload = () => {
    setSelectedFile(null)
    setDescription("")
    setCustomTitle("")
    setScope("employee")
    setSiteId(selectedSiteId ?? null)
    setSelectedTypeId(null)
    setIssueDate(null)
    setExpiryDate(null)
    setIsExpiryManual(false)
    setShowIssuePicker(false)
    setShowExpiryPicker(false)
    setActivePicker(null)
    setPickerQuery("")
    setSelectedEmployeeId(null)
    setTempIssueDate(null)
    setTempExpiryDate(null)
  }

  const closeUploadModal = () => {
    setIsUploadOpen(false)
    setActivePicker(null)
    setShowIssuePicker(false)
    setShowExpiryPicker(false)
    // No resetear el picker si está abierto desde el filtro
    if (!isUploadOpen && activePicker === "employee") {
      // Mantener el picker abierto si es para filtrar
    } else if (isUploadOpen) {
      setActivePicker(null)
    }
  }

  const openUpload = () => {
    resetUpload()
    setIsUploadOpen(true)
  }
  const handleSaveDocument = async () => {
    if (!user || !employee) return
    if (!selectedFile) {
      Alert.alert("Documento", "Selecciona un PDF.")
      return
    }
    if (scope === "site" && !activeSiteId) {
      Alert.alert("Documento", "Selecciona una sede.")
      return
    }

    if (scope === "employee") {
      if (!selectedTypeId) {
        Alert.alert("Documento", "Selecciona un tipo de documento.")
        return
      }
      if (!selectedEmployeeId) {
        Alert.alert("Documento", "Selecciona un trabajador.")
        return
      }
    }
    if (scope === "site" && !customTitle.trim()) {
      Alert.alert("Documento", "Escribe el nombre del documento.")
      return
    }

    const activeType = scope === "employee" ? selectedType ?? null : null
    if (scope === "employee" && !activeType) {
      Alert.alert("Documento", "Selecciona un tipo de documento.")
      return
    }

    let issueDateValue: string | null = null
    let expiryDateValue: string | null = null

    if (activeType && activeType.requires_expiry) {
      if (!issueDate) {
        Alert.alert("Documento", "Selecciona la fecha de expedición.")
        return
      }

      const computedExpiry =
        expiryDate ??
        (activeType.validity_months
          ? addMonthsSafe(issueDate, activeType.validity_months)
          : null)

      if (!computedExpiry) {
        Alert.alert("Documento", "Selecciona la fecha de vencimiento.")
        return
      }

      issueDateValue = formatDateOnly(issueDate)
      expiryDateValue = formatDateOnly(computedExpiry)
    }

    setIsSaving(true)
    try {
      console.log('[DOCUMENTS] Starting upload...');
      const now = new Date().toISOString()
      const safeName = selectedFile.name.replace(/\s+/g, "_")
      const storagePath = `${user.id}/${Date.now()}_${safeName}`

      console.log('[DOCUMENTS] Storage path:', storagePath);

      // Como solo gerentes pueden subir documentos, todos se aprueban automáticamente
      const shouldAutoApprove = canManageScopes

      const insertPayload = {
        scope,
        owner_employee_id: user.id,
        target_employee_id: scope === "employee" ? (selectedEmployeeId ?? user.id) : null,
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
      }

      console.log('[DOCUMENTS] Insert payload:', JSON.stringify(insertPayload, null, 2));

      console.log('[DOCUMENTS] Reading file as base64 from URI:', selectedFile.uri);
      
      // Leer el archivo como base64 (más confiable en React Native)
      const base64Data = await FileSystem.readAsStringAsync(selectedFile.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log('[DOCUMENTS] Base64 data length:', base64Data.length, 'characters');
      
      if (!base64Data || base64Data.length === 0) {
        throw new Error('El archivo está vacío o no se pudo leer');
      }

      // Convertir base64 a ArrayBuffer
      const binaryString = base64ToBinary(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const arrayBuffer = bytes.buffer;
      
      console.log('[DOCUMENTS] ArrayBuffer created, size:', arrayBuffer.byteLength, 'bytes');

      console.log('[DOCUMENTS] Uploading ArrayBuffer to storage...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, arrayBuffer, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: false,
        })
      
      console.log('[DOCUMENTS] Upload result:', JSON.stringify(uploadData, null, 2));

      if (uploadError) {
        console.error('[DOCUMENTS] Upload error:', uploadError);
        throw uploadError;
      }

      console.log('[DOCUMENTS] Upload successful, inserting record...');
      const { error: insertError } = await supabase
        .from("documents")
        .insert(insertPayload)

      if (insertError) {
        console.error('[DOCUMENTS] Insert error:', insertError);
        console.log('[DOCUMENTS] Cleaning up uploaded file...');
        await supabase.storage.from("documents").remove([storagePath])
        throw insertError
      }

      console.log('[DOCUMENTS] Document saved successfully, reloading list...');
      await loadDocuments()
      console.log('[DOCUMENTS] Closing modal...');
      setIsUploadOpen(false)
      Alert.alert("Documento", "Documento subido correctamente.");
    } catch (err) {
      console.error("[DOCUMENTS] Upload error:", err)
      console.error("[DOCUMENTS] Error details:", JSON.stringify(err, null, 2));
      Alert.alert("Documento", `No se pudo subir el documento: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      console.log('[DOCUMENTS] Resetting isSaving to false');
      setIsSaving(false)
    }
  }

  const openDocument = async (row: DocumentRow) => {
    try {
      console.log('[DOCUMENTS] Opening document:', row.storage_path);
      
      // Obtener URL pública del documento
      const { data: { publicUrl } } = supabase.storage
        .from("documents")
        .getPublicUrl(row.storage_path);

      console.log('[DOCUMENTS] Opening URL:', publicUrl);
      
      // Abrir en navegador externo (única opción sin custom development build)
      await Linking.openURL(publicUrl);
    } catch (err) {
      console.error("[DOCUMENTS] Open document error:", err);
      Alert.alert(
        "Error", 
        `No se pudo abrir el PDF: ${err instanceof Error ? err.message : 'Error desconocido'}`
      );
    }
  };

  const handleDeleteDocument = async (doc: DocumentRow) => {
    Alert.alert(
      "Eliminar documento",
      `¿Estás seguro de que quieres eliminar "${doc.document_type?.name ?? doc.title}"? Esta acción no se puede deshacer.`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              console.log('[DOCUMENTS] Deleting document:', doc.id, doc.storage_path);
              
              // Eliminar inmediatamente de la UI para feedback rápido
              setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
              
              // Primero eliminar el registro de la base de datos (más importante)
              const { error: deleteError, data: deleteData } = await supabase
                .from("documents")
                .delete()
                .eq("id", doc.id)
                .select();

              if (deleteError) {
                console.error("[DOCUMENTS] Error deleting document from DB:", deleteError);
                // Revertir el cambio en la UI si falla
                await loadDocuments();
                throw deleteError;
              }

              console.log('[DOCUMENTS] Document deleted from DB:', deleteData);

              // Luego intentar eliminar el archivo del storage
              const { error: storageError } = await supabase.storage
                .from("documents")
                .remove([doc.storage_path]);

              if (storageError) {
                console.warn("[DOCUMENTS] Error deleting file from storage (non-critical):", storageError);
                // No lanzar error, el documento ya fue eliminado de la BD
              } else {
                console.log('[DOCUMENTS] File deleted from storage successfully');
              }

              // Recargar la lista de documentos para asegurar sincronización
              console.log('[DOCUMENTS] Reloading documents list...');
              await loadDocuments();
              
              // Verificar que el documento ya no esté en la lista
              console.log('[DOCUMENTS] Document deletion completed');
              
              Alert.alert("Documento", "Documento eliminado correctamente.");
            } catch (err) {
              console.error("[DOCUMENTS] Error deleting document:", err);
              // Recargar para restaurar el estado correcto
              await loadDocuments();
              Alert.alert(
                "Error", 
                `No se pudo eliminar el documento: ${err instanceof Error ? err.message : 'Error desconocido'}`
              );
            }
          },
        },
      ]
    );
  };

  // Métricas de estado eliminadas - no se necesitan

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Math.max(16, insets.top + 8),
          paddingBottom: Math.max(24, insets.bottom + 24),
        }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Documentos</Text>
            <Text style={styles.subtitle}>
              {canManageScopes 
                ? "PDFs personales y de sede. Solo gerentes pueden subir."
                : "Consulta tus documentos personales y de sede."}
            </Text>
          </View>
          {canManageScopes ? (
            <TouchableOpacity
              onPress={openUpload}
              style={[
                UI.chip,
                {
                  borderColor: COLORS.accent,
                  backgroundColor: "rgba(226, 0, 106, 0.12)",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                },
              ]}
            >
              <Ionicons
                name="cloud-upload-outline"
                size={16}
                color={COLORS.accent}
              />
              <Text style={{ fontWeight: "800", color: COLORS.accent }}>
                Subir
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {!notificationsEnabled ? (
          <View style={{ marginTop: 14 }}>
            <View style={[UI.card, { padding: 14 }]}>
              <Text style={styles.alertTitle}>Activa recordatorios</Text>
              <Text style={styles.alertSubtitle}>
                Te avisaremos antes de que un documento venza.
              </Text>
              <TouchableOpacity
                onPress={requestNotificationPermission}
                style={[
                  UI.chip,
                  {
                    marginTop: 10,
                    borderColor: COLORS.accent,
                    backgroundColor: "rgba(226, 0, 106, 0.10)",
                  },
                ]}
              >
                <Text style={{ fontWeight: "800", color: COLORS.accent }}>
                  Activar alertas
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {alertDocuments.length > 0 ? (
          <View style={{ marginTop: 14 }}>
            <View style={[UI.card, { padding: 14 }]}>
              <Text style={styles.alertTitle}>Alertas de vencimiento</Text>
              <Text style={styles.alertSubtitle}>
                {alertDocuments.length} documentos por vencer o vencidos.
              </Text>
              {isScheduling ? (
                <Text style={styles.alertSubtitle}>
                  Configurando recordatorios...
                </Text>
              ) : null}
              <View style={{ marginTop: 10, gap: 6 }}>
                {alertDocuments.slice(0, 3).map(({ doc, daysLeft }) => {
                  const label =
                    daysLeft < 0
                      ? `Vencido hace ${Math.abs(daysLeft)} días`
                      : daysLeft === 0
                        ? "Vence hoy"
                        : `Vence en ${daysLeft} días`;
                  const labelTone =
                    daysLeft < 0 ? COLORS.neutral : COLORS.accent;
                  return (
                    <View key={doc.id} style={styles.alertRow}>
                      <Text style={styles.alertRowTitle} numberOfLines={1}>
                        {doc.document_type?.name ?? doc.title}
                      </Text>
                      <Text style={[styles.alertRowMeta, { color: labelTone }]}>
                        {label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        {canManageScopes ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.modalLabel}>Filtrar por trabajador</Text>
            <TouchableOpacity
              onPress={async () => {
                console.log('[DOCUMENTS] Filter button pressed, availableEmployees:', availableEmployees.length);
                if (availableEmployees.length === 0) {
                  console.log('[DOCUMENTS] No employees loaded, loading...');
                  await loadAvailableEmployees();
                }
                console.log('[DOCUMENTS] Setting activePicker to employee, availableEmployees:', availableEmployees.length);
                setPickerQuery("")
                setActivePicker("employee")
              }}
              style={[
                UI.chip,
                {
                  borderColor: filterEmployeeId ? COLORS.accent : COLORS.border,
                  backgroundColor: filterEmployeeId 
                    ? "rgba(226, 0, 106, 0.10)" 
                    : COLORS.porcelainAlt,
                  marginTop: 6,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontWeight: "700", color: COLORS.text, flex: 1 }}>
                  {filterEmployeeId 
                    ? availableEmployees.find(e => e.id === filterEmployeeId)?.full_name ?? "Todos"
                    : "Todos los trabajadores"}
                </Text>
                {filterEmployeeId ? (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation()
                      setFilterEmployeeId(null)
                    }}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="close-circle" size={18} color={COLORS.accent} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="chevron-down" size={16} color={COLORS.neutral} />
                )}
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {isLoading ? (
          <View style={{ paddingTop: 30, alignItems: "center" }}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        ) : null}

        {documents.length === 0 && !isLoading ? (
          <View style={{ marginTop: 18 }}>
            <View style={[UI.card, { padding: 18, alignItems: "center" }]}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(226, 0, 106, 0.10)",
                  borderWidth: 1,
                  borderColor: "rgba(226, 0, 106, 0.18)",
                }}
              >
                <Ionicons
                  name="document-text-outline"
                  size={22}
                  color={COLORS.accent}
                />
              </View>

              <Text
                style={{
                  marginTop: 10,
                  fontSize: 14,
                  fontWeight: "800",
                  color: COLORS.text,
                }}
              >
                Sin documentos
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  color: COLORS.neutral,
                  textAlign: "center",
                }}
              >
                Aún no hay documentos cargados.
              </Text>

              {canManageScopes ? (
                <TouchableOpacity
                  onPress={openUpload}
                  style={[
                    UI.chip,
                    {
                      marginTop: 12,
                      borderColor: COLORS.accent,
                      backgroundColor: "rgba(226, 0, 106, 0.12)",
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    },
                  ]}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={16}
                    color={COLORS.accent}
                  />
                  <Text style={{ fontWeight: "800", color: COLORS.accent }}>
                    Subir documento
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: 18, gap: 12 }}>
          {documents.map((doc) => {
            const today = parseDateOnly(formatDateOnly(new Date()))
            const expiry = doc.expiry_date ? parseDateOnly(doc.expiry_date) : null
            const daysLeft = expiry ? diffDays(expiry, today) : null
            const reminderDays =
              doc.document_type?.reminder_days ?? DEFAULT_REMINDER_DAYS
            let expiryLabel: string | null = null
            let expiryTone: string = COLORS.neutral
            if (daysLeft !== null) {
              if (daysLeft < 0) {
                expiryLabel = `Vencido hace ${Math.abs(daysLeft)} días`
                expiryTone = COLORS.neutral
              } else if (daysLeft === 0) {
                expiryLabel = "Vence hoy"
                expiryTone = COLORS.accent
              } else if (daysLeft <= reminderDays) {
                expiryLabel = `Vence en ${daysLeft} días`
                expiryTone = COLORS.accent
              }
            }
            return (
              <View key={doc.id} style={[UI.card, { padding: 14 }]}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flex: 1,
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(226, 0, 106, 0.10)",
                        borderWidth: 1,
                        borderColor: "rgba(226, 0, 106, 0.18)",
                      }}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={20}
                        color={COLORS.accent}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.docTitle} numberOfLines={1}>
                        {doc.document_type?.name ?? doc.title}
                      </Text>
                      <Text style={styles.docMeta} numberOfLines={1}>
                        {doc.file_name}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: "row", marginTop: 10 }}>
                  <Text style={styles.docMeta}>
                    {formatShortDate(doc.expiry_date)}
                  </Text>
                  <Text style={[styles.docMeta, { marginLeft: 12 }]}>
                    {doc.scope === "employee"
                      ? "Personal"
                      : doc.scope === "site"
                        ? "Sede"
                        : "Grupo"}
                  </Text>
                </View>
                {expiryLabel ? (
                  <Text style={[styles.docMeta, { color: expiryTone }]}>
                    {expiryLabel}
                  </Text>
                ) : null}

                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    onPress={() => openDocument(doc)}
                    style={[
                      UI.chip,
                      {
                        flex: 1,
                        borderColor: COLORS.accent,
                        backgroundColor: "rgba(226, 0, 106, 0.10)",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        paddingVertical: 10,
                      },
                    ]}
                  >
                    <Ionicons
                      name="open-outline"
                      size={16}
                      color={COLORS.accent}
                    />
                    <Text
                      style={{
                        textAlign: "center",
                        fontWeight: "800",
                        color: COLORS.accent,
                      }}
                    >
                      Abrir PDF
                    </Text>
                  </TouchableOpacity>
                  
                  {canManageScopes ? (
                    <TouchableOpacity
                      onPress={() => handleDeleteDocument(doc)}
                      style={[
                        UI.chip,
                        {
                          borderColor: COLORS.neutral,
                          backgroundColor: COLORS.porcelainAlt,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          paddingVertical: 10,
                          paddingHorizontal: 16,
                        },
                      ]}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={COLORS.neutral}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal
        transparent
        visible={isUploadOpen}
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={closeUploadModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={closeUploadModal}
          />
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Subir documento</Text>
            <Text style={styles.modalSubtitle}>
              Solo PDF. Selecciona el tipo y agrega fechas si aplica.
            </Text>

            <Text style={styles.modalLabel}>Alcance</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => setScope("employee")}
                style={[
                  UI.chip,
                  {
                    flex: 1,
                    borderColor:
                      scope === "employee" ? COLORS.accent : COLORS.border,
                    backgroundColor:
                      scope === "employee"
                        ? "rgba(226, 0, 106, 0.10)"
                        : "white",
                  },
                ]}
              >
                <Text
                  style={{
                    textAlign: "center",
                    fontWeight: "700",
                    color: COLORS.text,
                  }}
                >
                  Personal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setScope("site")}
                disabled={!canManageScopes}
                style={[
                  UI.chip,
                  {
                    flex: 1,
                    borderColor:
                      scope === "site" ? COLORS.accent : COLORS.border,
                    backgroundColor:
                      scope === "site" ? "rgba(226, 0, 106, 0.10)" : "white",
                    opacity: canManageScopes ? 1 : 0.4,
                  },
                ]}
              >
                <Text
                  style={{
                    textAlign: "center",
                    fontWeight: "700",
                    color: COLORS.text,
                  }}
                >
                  Sede
                </Text>
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
                    UI.chip,
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
                    UI.chip,
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
                UI.chip,
                {
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.porcelainAlt,
                  marginTop: 6,
                },
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
                    UI.chip,
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

            {selectedType?.requires_expiry ? (
              <>
                <Text style={styles.modalLabel}>Fecha de expedición</Text>
                <TouchableOpacity
                  onPress={() => {
                    setTempIssueDate(issueDate ?? new Date());
                    setShowIssuePicker(true);
                  }}
                  style={[
                    UI.chip,
                    {
                      borderColor: COLORS.border,
                      backgroundColor: COLORS.porcelainAlt,
                      marginTop: 6,
                    },
                  ]}
                >
                  <Text style={{ fontWeight: "700", color: COLORS.text }}>
                    {issueDate
                      ? formatShortDate(formatDateOnly(issueDate))
                      : "Seleccionar fecha"}
                  </Text>
                </TouchableOpacity>

                {showIssuePicker && Platform.OS === "ios" ? (
                  <Modal
                    transparent
                    visible={showIssuePicker}
                    animationType="slide"
                    onRequestClose={() => {
                      setShowIssuePicker(false);
                      setTempIssueDate(null);
                    }}
                  >
                    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
                      <View style={{ backgroundColor: "white", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                          <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text }}>Fecha de expedición</Text>
                          <TouchableOpacity
                            onPress={() => {
                              setShowIssuePicker(false);
                              setTempIssueDate(null);
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
                              setTempIssueDate(date);
                            }
                          }}
                          maximumDate={new Date()}
                          style={{ height: 200 }}
                        />
                        <TouchableOpacity
                          onPress={() => {
                            if (tempIssueDate) {
                              setIssueDate(tempIssueDate);
                              setIsExpiryManual(false);
                            }
                            setShowIssuePicker(false);
                            setTempIssueDate(null);
                          }}
                          style={[
                            UI.chip,
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
                    const defaultExpiry = issueDate 
                      ? addMonthsSafe(issueDate, selectedType?.validity_months ?? 3)
                      : new Date();
                    setTempExpiryDate(expiryDate ?? defaultExpiry);
                    setShowExpiryPicker(true);
                  }}
                  style={[
                    UI.chip,
                    {
                      borderColor: COLORS.border,
                      backgroundColor: COLORS.porcelainAlt,
                      marginTop: 6,
                    },
                  ]}
                >
                  <Text style={{ fontWeight: "700", color: COLORS.text }}>
                    {expiryDate
                      ? formatShortDate(formatDateOnly(expiryDate))
                      : "Seleccionar fecha"}
                  </Text>
                </TouchableOpacity>

                {showExpiryPicker && Platform.OS === "ios" ? (
                  <Modal
                    transparent
                    visible={showExpiryPicker}
                    animationType="slide"
                    onRequestClose={() => {
                      setShowExpiryPicker(false);
                      setTempExpiryDate(null);
                    }}
                  >
                    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
                      <View style={{ backgroundColor: "white", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                          <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text }}>Fecha de vencimiento</Text>
                          <TouchableOpacity
                            onPress={() => {
                              setShowExpiryPicker(false);
                              setTempExpiryDate(null);
                            }}
                            style={{ padding: 8 }}
                          >
                            <Ionicons name="close" size={24} color={COLORS.text} />
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={tempExpiryDate ?? (issueDate ? addMonthsSafe(issueDate, selectedType?.validity_months ?? 3) : new Date())}
                          mode="date"
                          display="spinner"
                          onChange={(event, date) => {
                            if (date) {
                              setTempExpiryDate(date);
                            }
                          }}
                          minimumDate={issueDate ?? undefined}
                          style={{ height: 200 }}
                        />
                        <TouchableOpacity
                          onPress={() => {
                            if (tempExpiryDate) {
                              setExpiryDate(tempExpiryDate);
                              setIsExpiryManual(true);
                            }
                            setShowExpiryPicker(false);
                            setTempExpiryDate(null);
                          }}
                          style={[
                            UI.chip,
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
                    value={expiryDate ?? (issueDate ? addMonthsSafe(issueDate, selectedType?.validity_months ?? 3) : new Date())}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowExpiryPicker(false);
                      if (date) {
                        setExpiryDate(date);
                        setIsExpiryManual(true);
                      }
                    }}
                    minimumDate={issueDate ?? undefined}
                  />
                ) : null}

                {selectedType?.validity_months ? (
                  <Text style={styles.modalHint}>
                    Vigencia sugerida: {selectedType.validity_months} meses.
                  </Text>
                ) : null}
              </>
            ) : null}

            <View
              style={{
                flexDirection: "row",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: 16,
              }}
            >
              <TouchableOpacity
                onPress={closeUploadModal}
                style={[
                  UI.chip,
                  {
                    borderColor: COLORS.border,
                    backgroundColor: COLORS.porcelainAlt,
                  },
                ]}
              >
                <Text style={{ fontWeight: "700", color: COLORS.text }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveDocument}
                disabled={isSaving}
                style={[
                  UI.chip,
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

          {activePicker && isUploadOpen ? (
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
                <TouchableOpacity
                  onPress={() => setActivePicker(null)}
                  style={styles.pickerBack}
                >
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
                    <Text style={styles.modalHint}>
                      No hay tipos disponibles para este alcance.
                    </Text>
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
                          style={[
                            styles.pickerItem,
                            active ? styles.pickerItemActive : null,
                          ]}
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
                      <Text style={[styles.modalHint, { marginTop: 12 }]}>
                        Cargando trabajadores...
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          void loadAvailableEmployees();
                        }}
                        style={[
                          UI.chip,
                          {
                            marginTop: 16,
                            borderColor: COLORS.accent,
                            backgroundColor: "rgba(226, 0, 106, 0.10)",
                          },
                        ]}
                      >
                        <Text style={{ fontWeight: "700", color: COLORS.accent }}>
                          Reintentar
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : filteredEmployees.length === 0 ? (
                    <Text style={styles.modalHint}>
                      No se encontraron trabajadores con ese nombre.
                    </Text>
                  ) : (
                    <>
                      {!isUploadOpen ? (
                        <TouchableOpacity
                          onPress={() => {
                            setFilterEmployeeId(null)
                            setActivePicker(null)
                          }}
                          style={[
                            styles.pickerItem,
                            !filterEmployeeId ? styles.pickerItemActive : null,
                          ]}
                        >
                          <Text style={styles.pickerItemTitle}>Todos los trabajadores</Text>
                        </TouchableOpacity>
                      ) : null}
                      {filteredEmployees.map((emp) => {
                        const active = isUploadOpen 
                          ? selectedEmployeeId === emp.id
                          : filterEmployeeId === emp.id
                        return (
                          <TouchableOpacity
                            key={emp.id}
                            onPress={() => {
                              if (isUploadOpen) {
                                setSelectedEmployeeId(emp.id)
                              } else {
                                setFilterEmployeeId(emp.id)
                              }
                              setActivePicker(null)
                            }}
                            style={[
                              styles.pickerItem,
                              active ? styles.pickerItemActive : null,
                            ]}
                          >
                            <Text style={styles.pickerItemTitle}>{emp.full_name}</Text>
                          </TouchableOpacity>
                        )
                      })}
                    </>
                  )
                ) : filteredSites.length === 0 ? (
                  <Text style={styles.modalHint}>
                    No hay sedes disponibles para seleccionar.
                  </Text>
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
                        style={[
                          styles.pickerItem,
                          active ? styles.pickerItemActive : null,
                        ]}
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

      {/* Modal separado para el picker cuando se usa fuera del modal de upload */}
      <Modal
        transparent
        visible={activePicker !== null && !isUploadOpen}
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => setActivePicker(null)}
      >
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
            <TouchableOpacity
              onPress={() => setActivePicker(null)}
              style={styles.pickerBack}
            >
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
            {activePicker === "employee" ? (
              availableEmployees.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
                  <Text style={[styles.modalHint, { marginTop: 12 }]}>
                    Cargando trabajadores...
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      void loadAvailableEmployees();
                    }}
                    style={[
                      UI.chip,
                      {
                        marginTop: 16,
                        borderColor: COLORS.accent,
                        backgroundColor: "rgba(226, 0, 106, 0.10)",
                      },
                    ]}
                  >
                    <Text style={{ fontWeight: "700", color: COLORS.accent }}>
                      Reintentar
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : filteredEmployees.length === 0 ? (
                <Text style={styles.modalHint}>
                  No se encontraron trabajadores con ese nombre.
                </Text>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => {
                      setFilterEmployeeId(null)
                      setActivePicker(null)
                    }}
                    style={[
                      styles.pickerItem,
                      !filterEmployeeId ? styles.pickerItemActive : null,
                    ]}
                  >
                    <Text style={styles.pickerItemTitle}>Todos los trabajadores</Text>
                  </TouchableOpacity>
                  {filteredEmployees.map((emp) => {
                    const active = filterEmployeeId === emp.id
                    return (
                      <TouchableOpacity
                        key={emp.id}
                        onPress={() => {
                          setFilterEmployeeId(emp.id)
                          setActivePicker(null)
                        }}
                        style={[
                          styles.pickerItem,
                          active ? styles.pickerItemActive : null,
                        ]}
                      >
                        <Text style={styles.pickerItemTitle}>{emp.full_name}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </>
              )
            ) : null}
          </ScrollView>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.porcelain,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.neutral,
  },
  metricCard: {
    flex: 1,
    padding: 12,
    alignItems: "flex-start",
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.neutral,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 6,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },
  alertSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.neutral,
  },
  alertRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  alertRowTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.text,
  },
  alertRowMeta: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.accent,
  },
  docTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  docMeta: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 20,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  pickerItemHint: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.neutral,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    padding: 12,
    marginTop: 12,
    color: COLORS.text,
  },
});

























