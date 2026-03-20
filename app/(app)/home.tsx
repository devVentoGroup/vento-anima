import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as MailComposer from "expo-mail-composer";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import type { DateData } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "expo-router";
import { Platform } from "react-native";
import { useAttendanceContext } from "@/contexts/attendance-context";
import { supabase } from "@/lib/supabase";
import { DateRangeModal } from "@/components/home/DateRangeModal";
import { ReportFilterModal } from "@/components/home/ReportFilterModal";
import { SitePickerModal } from "@/components/home/SitePickerModal";
import { UserMenuModal } from "@/components/home/UserMenuModal";
import {
  formatShiftDateLabel,
  formatShiftMinutes,
  getShiftDurationMinutes,
  getShiftRangeLabel,
  getShiftSiteName,
  getShiftStatusMeta,
  isUpcomingShift,
  type ShiftRow,
} from "@/components/shifts/utils";
import { PALETTE, RGBA } from "@/components/home/theme";
import { CONTENT_HORIZONTAL_PADDING, CONTENT_MAX_WIDTH } from "@/constants/layout";
import { calculateDistance } from "@/lib/geolocation";
function formatClock(value: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

const EXPO_PROJECT_ID = "2e1ba93a-039d-49e7-962d-a33ea7eaf9b3";

type ReportEmployeeOption = {
  id: string;
  label: string;
  role: string | null;
  siteIds: string[];
};

type ReportSiteOption = {
  id: string;
  label: string;
};

type ReportSummarySnapshot = {
  scheduledShifts: number;
  attendedShifts: number;
  lateCount: number;
  noShowCount: number;
  openCount: number;
  missingCloseCount: number;
  autoCloseCount: number;
  departureCount: number;
  scheduledMinutes: number;
  netMinutes: number;
  attendanceRate: number;
  punctualityRate: number;
};

type ReportEmployeeSummary = {
  employeeName: string;
  incidentCount: number;
  lateCount: number;
  noShowCount: number;
  openCount: number;
};

type ReportSiteSummary = {
  siteName: string;
  incidentCount: number;
  lateCount: number;
  noShowCount: number;
  openCount: number;
};

type ReportIncidentSummary = {
  category: string;
  employeeName: string;
  detail: string;
};

type ReportSummaryResponse = {
  summary: ReportSummarySnapshot;
  topEmployees: ReportEmployeeSummary[];
  topSites: ReportSiteSummary[];
  incidents: ReportIncidentSummary[];
  incidentCountTotal: number;
};

function formatMinutesLabel(totalMinutes: number) {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }
  return `${minutes} min`;
}

function formatRetryClock(value: number | null) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRemainingShort(ms: number) {
  const safe = Math.max(0, ms);
  const totalMinutes = Math.ceil(safe / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes} min`;
}

function formatLatency(value: number | null) {
  if (value == null) return "--";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function formatPercent(value: number) {
  return `${Math.round(Math.max(0, value) * 100)}%`;
}

function getShiftWindowDate(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const router = useRouter();
  const {
    user,
    session,
    employee,
    signOut,
    refreshEmployee,
    hasPendingSiteChanges,
    consumePendingSiteChanges,
    employeeSites,
    selectedSiteId,
    isLoading: authIsLoading,
  } = useAuth();
  const {
    attendanceState,
    geofenceState,
    refreshGeofence,
    isLoading,
    isOffline,
    pendingAttendanceCount,
    pendingAttendanceSyncingCount,
    pendingAttendanceFailedCount,
    pendingAttendanceConflictCount,
    pendingAttendanceNextRetryAt,
    pendingAttendanceLastError,
    pendingAttendanceOldestCreatedAt,
    pendingBreakCount,
    pendingBreakSyncingCount,
    pendingBreakFailedCount,
    attendanceUxState,
    attendanceUxMessage,
    attendanceDiagnostics,
    syncPendingAttendanceQueue,
    syncPendingBreakQueue,
    loadTodayAttendance,
    checkIn,
    checkOut,
    startBreak,
    endBreak,
    selectSiteForCheckIn,
    startRealtimeGeofence,
    stopRealtimeGeofence,
  } = useAttendanceContext();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSitePickerOpen, setIsSitePickerOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    return start;
  });
  const [reportEndDate, setReportEndDate] = useState(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return end;
  });
  const [draftStartDate, setDraftStartDate] = useState<Date | null>(null);
  const [draftEndDate, setDraftEndDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const base = new Date();
    base.setDate(1);
    base.setHours(0, 0, 0, 0);
    return base;
  });
  const [reportEmployees, setReportEmployees] = useState<ReportEmployeeOption[]>(
    [],
  );
  const [reportSites, setReportSites] = useState<ReportSiteOption[]>([]);
  const [reportSiteId, setReportSiteId] = useState<string | null>(null);
  const [reportEmployeeId, setReportEmployeeId] = useState<string | null>(null);
  const [isLoadingReportEmployees, setIsLoadingReportEmployees] = useState(false);
  const [isLoadingReportSites, setIsLoadingReportSites] = useState(false);
  const [isReportSiteModalOpen, setIsReportSiteModalOpen] = useState(false);
  const [isReportEmployeeModalOpen, setIsReportEmployeeModalOpen] = useState(false);
  const [reportSummary, setReportSummary] = useState<ReportSummaryResponse | null>(null);
  const [isLoadingReportSummary, setIsLoadingReportSummary] = useState(false);
  const [reportSummaryError, setReportSummaryError] = useState<string | null>(null);
  const [walletEligibility, setWalletEligibility] = useState<{
    wallet_eligible: boolean;
    contract_active: boolean;
    documents_complete: boolean;
    wallet_status: string;
  } | null>(null);
  const [isLoadingWalletEligibility, setIsLoadingWalletEligibility] = useState(false);
  const [isAddingCarnetToWallet, setIsAddingCarnetToWallet] = useState(false);
  const [isCheckActionLocked, setIsCheckActionLocked] = useState(false);
  const [recentQueuedFeedback, setRecentQueuedFeedback] = useState(false);
  const [nextScheduledShift, setNextScheduledShift] = useState<ShiftRow | null>(null);
  const [todayShift, setTodayShift] = useState<ShiftRow | null>(null);
  const [isLoadingNextShift, setIsLoadingNextShift] = useState(false);
  const [opsSectionY, setOpsSectionY] = useState(0);
  const checkActionLockRef = useRef(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const refreshGeofenceRef = useRef(refreshGeofence);
  const startRealtimeGeofenceRef = useRef(startRealtimeGeofence);
  const stopRealtimeGeofenceRef = useRef(stopRealtimeGeofence);
  const refreshEmployeeRef = useRef(refreshEmployee);
  const consumePendingSiteChangesRef = useRef(consumePendingSiteChanges);
  const loadNextScheduledShift = useCallback(async () => {
    if (!user?.id) {
      setNextScheduledShift(null);
      setTodayShift(null);
      return;
    }

    setIsLoadingNextShift(true);
    try {
      const { data, error } = await supabase
        .from("employee_shifts")
        .select(
          "id, shift_date, start_time, end_time, break_minutes, notes, status, site_id, sites(name)",
        )
        .eq("employee_id", user.id)
        .not("published_at", "is", null)
        .gte("shift_date", getShiftWindowDate(0))
        .lte("shift_date", getShiftWindowDate(30))
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(8);

      if (error) throw error;
      const rows = (data ?? []) as ShiftRow[];
      const todayIso = getShiftWindowDate(0);
      const today = rows.find((row) => row.shift_date === todayIso) ?? null;
      const upcoming = rows.find((row) => isUpcomingShift(row));
      setTodayShift(today);
      setNextScheduledShift(upcoming ?? null);
    } catch (error) {
      console.error("[HOME] Error loading next shift:", error);
      setNextScheduledShift(null);
      setTodayShift(null);
    } finally {
      setIsLoadingNextShift(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshGeofenceRef.current = refreshGeofence;
  }, [refreshGeofence]);
  useEffect(() => {
    startRealtimeGeofenceRef.current = startRealtimeGeofence;
  }, [startRealtimeGeofence]);
  useEffect(() => {
    stopRealtimeGeofenceRef.current = stopRealtimeGeofence;
  }, [stopRealtimeGeofence]);
  useEffect(() => {
    refreshEmployeeRef.current = refreshEmployee;
  }, [refreshEmployee]);
  useEffect(() => {
    consumePendingSiteChangesRef.current = consumePendingSiteChanges;
  }, [consumePendingSiteChanges]);

  const isCheckedIn = attendanceState.status === "checked_in";
  const showAttendanceDiagnostics =
    process.env.EXPO_PUBLIC_SHOW_ATTENDANCE_DIAGNOSTICS === "1";
  const isGeoChecking = geofenceState.status === "checking";
  const canRegister =
    !isLoading &&
    geofenceState.canProceed &&
    !isGeoChecking &&
    !geofenceState.requiresSelection &&
    !isCheckActionLocked;
  const ctaTextColor = canRegister ? PALETTE.porcelain : PALETTE.text;
  const ctaSubTextOpacity = canRegister ? 0.9 : 0.7;
  const hasPendingAny = pendingAttendanceCount + pendingBreakCount > 0;
  const isSyncingAny =
    pendingAttendanceSyncingCount > 0 || pendingBreakSyncingCount > 0;

  const ctaPrimaryLabel = useMemo(() => {
    if (isLoading || isGeoChecking || isCheckActionLocked) {
      return isGeoChecking ? "Validando ubicación..." : "Registrando...";
    }
    if (attendanceUxState === "ready") {
      return isCheckedIn ? "Registrar salida" : "Registrar entrada";
    }
    if (recentQueuedFeedback) return "Registro guardado";
    if (hasPendingAny || isSyncingAny) return "Pendiente de sincronización";
    if (attendanceUxState === "blocked") return "Validar ubicación en sede";
    if (attendanceUxState === "failed") return "Reintentaremos automáticamente";
    if (attendanceUxState === "syncing") return "Sincronizando registros pendientes...";
    if (attendanceUxState === "queued") return "Registro guardado. Se sincroniza automáticamente.";
    if (attendanceUxState === "checking") return "Validando ubicación...";
    if (attendanceUxMessage) return attendanceUxMessage;
    return isCheckedIn ? "Registrar salida" : "Registrar entrada";
  }, [
    isLoading,
    isGeoChecking,
    isCheckActionLocked,
    isSyncingAny,
    recentQueuedFeedback,
    hasPendingAny,
    attendanceUxState,
    attendanceUxMessage,
    isCheckedIn,
  ]);

  const ctaSecondaryLabel = useMemo(() => {
    if (isLoading || isGeoChecking || isCheckActionLocked) return null;
    if (attendanceUxState === "blocked") return "Revalidar ubicación";
    if (attendanceUxState === "failed") return "Reintentar ahora";
    if (isSyncingAny) return "Puedes seguir usando la app";
    if (recentQueuedFeedback) return "Guardado localmente";
    if (attendanceUxState === "queued") return "Se enviará automáticamente";
    return isCheckedIn ? "Terminar turno" : "Iniciar turno";
  }, [
    isLoading,
    isGeoChecking,
    isCheckActionLocked,
    attendanceUxState,
    isSyncingAny,
    recentQueuedFeedback,
    isCheckedIn,
  ]);
  const headerOpsPill = useMemo(() => {
    const pendingTotal = pendingAttendanceCount + pendingBreakCount;
    if (isSyncingAny) {
      return {
        label: "SYNC",
        bg: "rgba(242, 198, 192, 0.18)",
        border: RGBA.borderRose,
        text: PALETTE.rose,
      };
    }
    if (isOffline) {
      return {
        label: "OFFLINE",
        bg: "rgba(226, 0, 106, 0.08)",
        border: RGBA.borderPink,
        text: PALETTE.accent,
      };
    }
    if (pendingTotal > 0) {
      return {
        label: `PEND ${pendingTotal}`,
        bg: PALETTE.porcelain2,
        border: PALETTE.border,
        text: PALETTE.neutral,
      };
    }
    return {
      label: "ONLINE",
      bg: PALETTE.porcelain2,
      border: PALETTE.border,
      text: PALETTE.neutral,
    };
  }, [
    isSyncingAny,
    isOffline,
    pendingAttendanceCount,
    pendingBreakCount,
  ]);
  const showHeaderOpsPill = headerOpsPill.label !== "ONLINE";

  const handleOpsPillPress = useCallback(() => {
    const targetY = Math.max(0, opsSectionY - 12);
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
  }, [opsSectionY]);

  const initialLoadDoneRef = useRef(false);
  const lastStatusRef = useRef<string | null>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const notificationsPromptAttemptedForUserRef = useRef<string | null>(null);
  const notificationsPromptInFlightRef = useRef(false);

  type NotificationPermissionStatus = "granted" | "denied" | "undetermined" | "unknown";
  const [notificationPermissionStatus, setNotificationPermissionStatus] =
    useState<NotificationPermissionStatus>("unknown");
  const [notificationCanAskAgain, setNotificationCanAskAgain] = useState<boolean | null>(null);
  const [notificationPromptLoading, setNotificationPromptLoading] = useState(false);

  useEffect(() => {
    if (user?.id !== lastUserIdRef.current) {
      initialLoadDoneRef.current = false;
      lastStatusRef.current = null;
      lastUserIdRef.current = user?.id ?? null;
    }
  }, [user?.id]);

  useEffect(() => {
    if (authIsLoading) return;
    if (!user) {
      initialLoadDoneRef.current = false;
      return;
    }

    if (employee === undefined) return;

    if (initialLoadDoneRef.current) return;

    initialLoadDoneRef.current = true;
    console.log(
      "[HOME] Loading initial data. Employee:",
      employee?.fullName ?? "null",
      "Sites:",
      employeeSites?.length ?? 0,
    );

    void loadTodayAttendance();

    if (!employee || !employeeSites || employeeSites.length === 0) {
      console.log("[HOME] No employee or sites, skipping geofence check");
      return;
    }

    console.log("[HOME] Initial geofence check on load");
    void refreshGeofence({ force: true, source: "user" });

    const timer = setTimeout(() => {
    }, 300);
    return () => clearTimeout(timer);
  }, [user, authIsLoading, employee, employeeSites]);

  useEffect(() => {
    if (!user || !initialLoadDoneRef.current) return;

    const currentStatus = attendanceState.status;
    if (lastStatusRef.current === currentStatus) return;
    lastStatusRef.current = currentStatus;

    if (currentStatus === "not_checked_in" && !attendanceState.lastCheckIn)
      return;

    const timer = setTimeout(() => {
      void refreshGeofence({ force: true, source: "user" });
    }, 500);
    return () => clearTimeout(timer);
  }, [attendanceState.status, user]);

  useEffect(() => {
    if (!isCheckedIn || !user) return;

    const interval = setInterval(() => {
      void loadTodayAttendance();
    }, 60000);

    return () => clearInterval(interval);
  }, [isCheckedIn, user]);

  const [stuckTimeout, setStuckTimeout] = useState(false);

  useEffect(() => {
    if (geofenceState.status !== "checking") {
      setStuckTimeout(false);
      return;
    }
    if (!geofenceState.updatedAt) return;

    const timeSinceUpdate = Date.now() - geofenceState.updatedAt;
    if (timeSinceUpdate > 15000 && !stuckTimeout) {
      console.warn("[HOME] Geofence stuck in checking state for too long");
      setStuckTimeout(true);
    }
  }, [geofenceState.status, geofenceState.updatedAt, stuckTimeout]);

  useEffect(() => {
    if (!stuckTimeout) return;
    let cancelled = false;
    const recover = async () => {
      try {
        const next = await refreshGeofenceRef.current({ force: true, source: "user" });
        if (!cancelled && next.status === "checking") {
          setActionError(
            "La verificación de ubicación está tardando más de lo normal. Puedes actualizar manualmente o reintentar en unos segundos.",
          );
        }
      } finally {
        if (!cancelled) {
          setStuckTimeout(false);
        }
      }
    };
    void recover();
    return () => {
      cancelled = true;
    };
  }, [stuckTimeout]);

  const realtimeStartedRef = useRef(false);
  const siteRefreshInFlightRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      void loadNextScheduledShift();

      if (user && hasPendingSiteChanges && !siteRefreshInFlightRef.current) {
        siteRefreshInFlightRef.current = true;
        void (async () => {
          try {
            await refreshEmployeeRef.current();
            await refreshGeofenceRef.current({ force: true, source: "user" });
          } finally {
            consumePendingSiteChangesRef.current();
            siteRefreshInFlightRef.current = false;
          }
        })();
      }

      if (!user || realtimeStartedRef.current) return;
      realtimeStartedRef.current = true;
      void startRealtimeGeofenceRef.current();
      return () => {
        realtimeStartedRef.current = false;
        stopRealtimeGeofenceRef.current();
      };
    }, [user, hasPendingSiteChanges, loadNextScheduledShift]),
  );

  useEffect(() => {
    if (geofenceState.requiresSelection) {
      setIsSitePickerOpen(true);
    }
  }, [geofenceState.requiresSelection]);

  useEffect(() => {
    if (!recentQueuedFeedback) return;
    const timer = setTimeout(() => setRecentQueuedFeedback(false), 8000);
    return () => clearTimeout(timer);
  }, [recentQueuedFeedback]);

  useEffect(() => {
    if (!isDateModalOpen) return;
    setDraftStartDate(null);
    setDraftEndDate(null);
    const base = new Date(reportEndDate);
    base.setDate(1);
    base.setHours(0, 0, 0, 0);
    setCalendarMonth(base);
  }, [isDateModalOpen, reportEndDate]);

  const syncPushToken = useCallback(async () => {
    if (!user?.id || !Device.isDevice) return;
    try {
      const tokenResult = await Notifications.getExpoPushTokenAsync({
        projectId: EXPO_PROJECT_ID,
      });
      const token = tokenResult.data;
      if (!token) return;

      const { error } = await supabase.functions.invoke("register-push-token", {
        body: {
          token,
          platform: Platform.OS,
        },
      });
      if (error) {
        console.warn("[HOME] register-push-token error:", error);
      }
    } catch (err) {
      console.warn("[HOME] Push token sync failed:", err);
    }
  }, [user?.id]);

  const refreshNotificationPermission = useCallback(async () => {
    try {
      const perm = await Notifications.getPermissionsAsync();
      const status = (perm.status === "granted"
        ? "granted"
        : perm.status === "denied"
          ? "denied"
          : perm.status === "undetermined"
            ? "undetermined"
            : "unknown") as NotificationPermissionStatus;
      setNotificationPermissionStatus(status);
      setNotificationCanAskAgain(
        typeof perm.canAskAgain === "boolean" ? perm.canAskAgain : null,
      );
    } catch {
      setNotificationPermissionStatus("unknown");
      setNotificationCanAskAgain(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshNotificationPermission();
    }, [refreshNotificationPermission]),
  );

  const requestNotificationPermissionOrOpenSettings = useCallback(async () => {
    setNotificationPromptLoading(true);
    try {
      const current = await Notifications.getPermissionsAsync();
      const status = (current.status === "granted"
        ? "granted"
        : current.status === "denied"
          ? "denied"
          : current.status === "undetermined"
            ? "undetermined"
            : "unknown") as NotificationPermissionStatus;
      const canAsk =
        typeof current.canAskAgain === "boolean" ? current.canAskAgain : null;

      if (status === "granted") {
        await syncPushToken();
        await refreshNotificationPermission();
        return;
      }

      if (status === "denied" && canAsk === false) {
        Alert.alert(
          "Notificaciones desactivadas",
          "Para recibir avisos de ANIMA activa las notificaciones en Ajustes del dispositivo.",
          [
            { text: "Cerrar", style: "cancel" },
            { text: "Abrir ajustes", onPress: () => void Linking.openSettings() },
          ],
        );
        await refreshNotificationPermission();
        return;
      }

      const { status: asked } = await Notifications.requestPermissionsAsync();
      await refreshNotificationPermission();
      if (asked === "granted") {
        await syncPushToken();
        Alert.alert("Listo", "Ya recibirás avisos de ANIMA.");
      } else if (asked === "denied") {
        const again = await Notifications.getPermissionsAsync();
        const canAskAgain =
          typeof again.canAskAgain === "boolean" ? again.canAskAgain : null;
        if (canAskAgain === false) {
          Alert.alert(
            "Notificaciones desactivadas",
            "Para recibir avisos activa las notificaciones en Ajustes.",
            [
              { text: "Cerrar", style: "cancel" },
              { text: "Abrir ajustes", onPress: () => void Linking.openSettings() },
            ],
          );
        }
      }
    } catch (err) {
      console.warn("[HOME] Notification permission request failed:", err);
      Alert.alert("Error", "No se pudo solicitar el permiso. Prueba desde Ajustes de la app.");
    } finally {
      setNotificationPromptLoading(false);
    }
  }, [syncPushToken, refreshNotificationPermission]);

  useEffect(() => {
    if (!user?.id) {
      notificationsPromptAttemptedForUserRef.current = null;
      notificationsPromptInFlightRef.current = false;
      return;
    }
    const userId = user.id;
    if (authIsLoading) return;
    if (!initialLoadDoneRef.current) return;
    if (notificationsPromptAttemptedForUserRef.current === userId) return;
    if (notificationsPromptInFlightRef.current) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        if (cancelled || notificationsPromptInFlightRef.current) return;
        notificationsPromptInFlightRef.current = true;
        try {
          const permissions = await Notifications.getPermissionsAsync();
          if (permissions.status === "granted") {
            await syncPushToken();
            return;
          }
          if (permissions.status === "undetermined") {
            const asked = await Notifications.requestPermissionsAsync();
            if (asked.status === "granted") {
              await syncPushToken();
            }
          }
        } catch (err) {
          console.warn("[HOME] Notification permission flow skipped:", err);
        } finally {
          notificationsPromptInFlightRef.current = false;
          if (!cancelled) {
            notificationsPromptAttemptedForUserRef.current = userId;
          }
        }
      })();
    }, 1200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user?.id, authIsLoading, employee?.id, employeeSites.length, syncPushToken]);

  const displayName =
    employee?.alias ||
    employee?.fullName?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "Usuario";
  const fallbackSiteName = attendanceState.currentSiteName || employee?.siteName || null;
  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || "U";

  const todayLabel = useMemo(() => {
    const now = new Date();
    const day = now.toLocaleDateString("es-CO", { weekday: "long" });
    const date = now.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "long",
    });
    return `${day.charAt(0).toUpperCase()}${day.slice(1)} - ${date}`;
  }, []);

  const statusUI = useMemo(() => {
    if (attendanceState.isOnBreak) {
      return {
        label: "EN DESCANSO",
        hint: "Pausa activa",
        tone: "active" as const,
      };
    }
    if (attendanceState.status === "checked_in") {
      return {
        label: "EN TURNO",
        hint: "Registro activo",
        tone: "active" as const,
      };
    }
    if (attendanceState.status === "checked_out") {
      return {
        label: "JORNADA CERRADA",
        hint: "Listo por hoy",
        tone: "done" as const,
      };
    }
    return {
      label: "SIN INICIAR",
      hint: "Registra tu entrada",
      tone: "idle" as const,
    };
  }, [attendanceState.status, attendanceState.isOnBreak]);
  const geofenceUI = useMemo(() => {
    if (geofenceState.status === "ready" && geofenceState.isLatchedReady)
      return { label: "TEMPORAL", highlight: true };
    if (geofenceState.status === "ready")
      return { label: "VERIFICADA", highlight: true };
    if (geofenceState.status === "checking")
      return { label: "VERIFICANDO", highlight: false };
    if (geofenceState.status === "blocked")
      return { label: "BLOQUEADA", highlight: false };
    if (geofenceState.status === "error")
      return { label: "ERROR", highlight: false };
    return { label: "PENDIENTE", highlight: false };
  }, [geofenceState.status]);
  const geofencePill = useMemo(() => {
    const isBad =
      geofenceState.status === "blocked" || geofenceState.status === "error";
    const isChecking = geofenceState.status === "checking";
    const isReady = geofenceState.status === "ready";

    return {
      bg: isBad
        ? "rgba(226, 0, 106, 0.08)"
        : isReady
          ? RGBA.washRoseGlow
          : PALETTE.porcelain2,
      border: isBad
        ? RGBA.borderPink
        : isReady
          ? RGBA.borderRose
          : PALETTE.border,
      text: isBad
        ? PALETTE.accent
        : isReady
          ? PALETTE.rose
          : isChecking
            ? PALETTE.accent
            : PALETTE.neutral,
    };
  }, [geofenceState.status]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [latchNow, setLatchNow] = useState(Date.now());

  useEffect(() => {
    if (isCheckedIn) {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isCheckedIn]);

  useEffect(() => {
    if (!geofenceState.isLatchedReady || !geofenceState.latchExpiresAt) return;
    const timer = setInterval(() => {
      setLatchNow(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, [geofenceState.isLatchedReady, geofenceState.latchExpiresAt]);

  const latchedRemainingMs = useMemo(() => {
    if (!geofenceState.isLatchedReady || !geofenceState.latchExpiresAt) return null;
    return Math.max(0, geofenceState.latchExpiresAt - latchNow);
  }, [geofenceState.isLatchedReady, geofenceState.latchExpiresAt, latchNow]);

  const totalMinutes = useMemo(() => {
    const baseMinutes = Math.max(0, Math.round(attendanceState.todayMinutes ?? 0));
    if (!isCheckedIn) return baseMinutes;
    if (attendanceState.isOnBreak) return baseMinutes;
    if (!attendanceState.snapshotAt) return baseMinutes;

    const snapshotMs = new Date(attendanceState.snapshotAt).getTime();
    if (!Number.isFinite(snapshotMs)) return baseMinutes;

    const deltaMinutes = Math.max(0, (currentTime - snapshotMs) / 60000);
    return Math.max(0, Math.round(baseMinutes + deltaMinutes));
  }, [
    attendanceState.todayMinutes,
    attendanceState.snapshotAt,
    attendanceState.isOnBreak,
    currentTime,
    isCheckedIn,
  ]);

  const hoursLabel = formatMinutesLabel(totalMinutes);
  const breakMinutesLabel = formatMinutesLabel(attendanceState.todayBreakMinutes ?? 0);

  const lastCheckIn = formatClock(attendanceState.lastCheckIn);
  const lastCheckOut = formatClock(attendanceState.lastCheckOut);

  const handleRefresh = async () => {
    if (!user) return;
    setIsRefreshing(true);
    setActionError(null);
    try {
      await loadTodayAttendance();
      await refreshGeofence({ force: true, source: "user" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCheck = async () => {
    if (isLoading) return;
    if (isGeoChecking) return;
    if (checkActionLockRef.current) return;

    checkActionLockRef.current = true;
    setIsCheckActionLocked(true);
    setActionError(null);

    try {
      if (geofenceState.requiresSelection) {
        setActionError("Selecciona una sede para continuar.");
        setIsSitePickerOpen(true);
        return;
      }

      const result = isCheckedIn ? await checkOut() : await checkIn();
      if (!result.success) {
        const msg = result.error || "No se pudo completar la acción";
        setActionError(msg);
      } else if (result.queued) {
        setRecentQueuedFeedback(true);
      }
    } finally {
      checkActionLockRef.current = false;
      setIsCheckActionLocked(false);
    }
  };

  const handleToggleBreak = async () => {
    if (!isCheckedIn || isLoading) return;
    setActionError(null);

    const result = attendanceState.isOnBreak
      ? await endBreak()
      : await startBreak();

    if (!result.success) {
      const msg = result.error || "No se pudo actualizar el descanso";
      setActionError(msg);
    } else if (result.queued) {
      setRecentQueuedFeedback(true);
    }
  };

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    await signOut();
  };

  const goToHistory = () => {
    router.push("/history");
  };

  const goToShifts = () => {
    router.push("/shifts");
  };

  const goToDocuments = () => {
    router.push("/documents");
  };

  const goToAnnouncements = () => {
    router.push("/announcements");
  };

  const goToSupport = () => {
    router.push("/support");
  };

  const role = employee?.role ?? null;
  const selectedSite = useMemo(() => {
    const targetId =
      selectedSiteId ?? employee?.siteId ?? employeeSites[0]?.siteId ?? null;
    if (!targetId) return null;
    return employeeSites.find((site) => site.siteId === targetId) ?? null;
  }, [selectedSiteId, employee?.siteId, employeeSites]);
  const activeSiteName =
    geofenceState.siteName ||
    selectedSite?.siteName ||
    fallbackSiteName ||
    "Sin sede asignada";

  const GLOBAL_REPORT_ROLES = new Set(["propietario", "gerente_general"]);
  const MANAGER_REPORT_SITE_TYPES = new Set(["satellite", "production_center"]);
  const selectedSiteType = selectedSite?.siteType ?? null;
  const isGlobalReportRole = role != null && GLOBAL_REPORT_ROLES.has(role);
  const canManagerTeamReports =
    role === "gerente" &&
    selectedSiteType != null &&
    MANAGER_REPORT_SITE_TYPES.has(selectedSiteType);
  const canPersonalReports =
    role != null && !isGlobalReportRole && role !== "gerente";
  const canViewReports =
    isGlobalReportRole || canManagerTeamReports || canPersonalReports;
  const nextShiftStatusMeta = nextScheduledShift
    ? getShiftStatusMeta(nextScheduledShift.status)
    : null;
  const nextShiftDurationLabel = nextScheduledShift
    ? formatShiftMinutes(getShiftDurationMinutes(nextScheduledShift))
    : null;

  const selectedReportSite = useMemo(
    () =>
      reportSiteId
        ? reportSites.find((item) => item.id === reportSiteId) ?? null
        : null,
    [reportSiteId, reportSites],
  );

  const filteredReportEmployees = useMemo(() => {
    if (!reportSiteId) return reportEmployees;
    return reportEmployees.filter((item) => item.siteIds.includes(reportSiteId));
  }, [reportEmployees, reportSiteId]);

  const selectedReportEmployee = useMemo(
    () =>
      reportEmployeeId
        ? filteredReportEmployees.find((item) => item.id === reportEmployeeId) ??
          null
        : null,
    [reportEmployeeId, filteredReportEmployees],
  );

  const effectiveReportSiteId = isGlobalReportRole ? reportSiteId : null;
  const effectiveReportEmployeeId = isGlobalReportRole
    ? reportEmployeeId
    : canPersonalReports
      ? user?.id ?? null
      : null;

  const reportTitle = canPersonalReports
    ? "Mi asistencia"
    : "Asistencia del equipo";

  const reportScopeLabel = isGlobalReportRole
    ? selectedReportSite && selectedReportEmployee
      ? `Sede: ${selectedReportSite.label} | Trabajador: ${selectedReportEmployee.label}`
      : selectedReportSite
        ? `Sede: ${selectedReportSite.label}`
        : selectedReportEmployee
          ? `Trabajador: ${selectedReportEmployee.label}`
          : "Todas las sedes"
    : canManagerTeamReports
      ? selectedSite?.siteName || "Tu sede"
      : "Registro personal";

  useEffect(() => {
    if (!isGlobalReportRole) {
      setReportEmployees([]);
      setReportSites([]);
      setReportSiteId(null);
      setReportEmployeeId(null);
      setIsLoadingReportEmployees(false);
      setIsLoadingReportSites(false);
      return;
    }

    let cancelled = false;
    setIsLoadingReportEmployees(true);
    setIsLoadingReportSites(true);
    void (async () => {
      try {
        const [
          { data: sitesData, error: sitesError },
          { data: employeesData, error: employeesError },
          { data: assignmentsData, error: assignmentsError },
        ] = await Promise.all([
          supabase
            .from("sites")
            .select("id, name, is_active")
            .eq("is_active", true)
            .order("name", { ascending: true }),
          supabase
            .from("employees")
            .select("id, full_name, alias, role, is_active, site_id")
            .eq("is_active", true)
            .order("full_name", { ascending: true }),
          supabase
            .from("employee_sites")
            .select("employee_id, site_id, is_active")
            .eq("is_active", true),
        ]);

        if (sitesError) throw sitesError;
        if (employeesError) throw employeesError;
        if (assignmentsError) throw assignmentsError;
        if (cancelled) return;

        const siteOptions = ((sitesData as any[]) ?? []).map((row) => ({
          id: row.id as string,
          label: (row.name as string | null) ?? "Sede sin nombre",
        }));
        setReportSites(siteOptions);
        setReportSiteId((prev) =>
          prev && !siteOptions.some((item) => item.id === prev) ? null : prev,
        );

        const siteIdsByEmployee = new Map<string, Set<string>>();
        for (const row of (assignmentsData as any[]) ?? []) {
          const employeeId = row.employee_id as string | null;
          const siteId = row.site_id as string | null;
          if (!employeeId || !siteId) continue;
          const set = siteIdsByEmployee.get(employeeId) ?? new Set<string>();
          set.add(siteId);
          siteIdsByEmployee.set(employeeId, set);
        }

        const options = ((employeesData as any[]) ?? []).map((row) => {
          const employeeId = row.id as string;
          const fallbackSiteId = (row.site_id as string | null) ?? null;
          const siteSet = siteIdsByEmployee.get(employeeId) ?? new Set<string>();
          if (fallbackSiteId) siteSet.add(fallbackSiteId);
          return {
            id: employeeId,
            label:
              (row.alias as string | null) ??
              (row.full_name as string | null) ??
              employeeId,
            role: (row.role as string | null) ?? null,
            siteIds: [...siteSet.values()],
          } as ReportEmployeeOption;
        });
        setReportEmployees(options);
        setReportEmployeeId((prev) =>
          prev && !options.some((item) => item.id === prev) ? null : prev,
        );
      } catch (err) {
        console.warn("[HOME] Unable to load report filters:", err);
      } finally {
        if (!cancelled) {
          setIsLoadingReportEmployees(false);
          setIsLoadingReportSites(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isGlobalReportRole]);

  useEffect(() => {
    if (!isGlobalReportRole) return;
    if (!reportEmployeeId) return;
    if (filteredReportEmployees.some((item) => item.id === reportEmployeeId)) return;
    setReportEmployeeId(null);
  }, [isGlobalReportRole, reportEmployeeId, filteredReportEmployees]);

  const formatShortDate = (value: Date) =>
    value.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const reportRangeLabel = `${formatShortDate(reportStartDate)} - ${formatShortDate(reportEndDate)}`;

  const formatMonthLabel = (value: Date) => {
    const label = value.toLocaleDateString("es-CO", {
      month: "long",
      year: "numeric",
    });
    return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
  };

  const toDateKey = (value: Date) => {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getMarkedDates = () => {
    if (!draftStartDate) return {};
    const startKey = toDateKey(draftStartDate);
    const endDate = draftEndDate ?? draftStartDate;
    const endKey = toDateKey(endDate);

    const marked: Record<string, any> = {};
    let cursor = new Date(draftStartDate);
    cursor.setHours(0, 0, 0, 0);
    const endCursor = new Date(endDate);
    endCursor.setHours(0, 0, 0, 0);

    while (cursor <= endCursor) {
      const key = toDateKey(cursor);
      const isStart = key === startKey;
      const isEnd = key === endKey;
      const isEdge = isStart || isEnd;

      marked[key] = {
        customStyles: {
          container: {
            backgroundColor: isEdge
              ? PALETTE.accent
              : "rgba(226, 0, 106, 0.12)",
            borderRadius: isEdge ? 18 : 8,
          },
          text: {
            color: isEdge ? "white" : PALETTE.text,
            fontWeight: "600",
          },
        },
      };
      cursor.setDate(cursor.getDate() + 1);
    }
    return marked;
  };

  const applyRange = (start: Date, end: Date) => {
    const nextStart = new Date(start);
    const nextEnd = new Date(end);
    nextStart.setHours(0, 0, 0, 0);
    nextEnd.setHours(23, 59, 59, 999);
    if (nextStart > nextEnd) {
      const tmp = nextStart;
      nextStart.setTime(nextEnd.getTime());
      nextEnd.setTime(tmp.getTime());
    }
    setReportStartDate(nextStart);
    setReportEndDate(nextEnd);
  };

  const buildAttendanceReportUrl = useCallback(
    (format: "xlsx" | "json" = "xlsx") => {
      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!baseUrl) {
        throw new Error("Missing Supabase URL");
      }

      const url = new URL("/functions/v1/attendance-report", baseUrl);
      url.searchParams.set("start", reportStartDate.toISOString());
      url.searchParams.set("end", reportEndDate.toISOString());
      url.searchParams.set("format", format);
      const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (deviceTimeZone) {
        url.searchParams.set("tz", deviceTimeZone);
      }
      if (effectiveReportSiteId) {
        url.searchParams.set("site_id", effectiveReportSiteId);
      }
      if (effectiveReportEmployeeId) {
        url.searchParams.set("employee_id", effectiveReportEmployeeId);
      }

      return url;
    },
    [effectiveReportEmployeeId, effectiveReportSiteId, reportEndDate, reportStartDate],
  );

  const createReportFile = async () => {
    if (!session?.access_token) {
      throw new Error("No hay sesión activa");
    }

    const response = await fetch(buildAttendanceReportUrl("xlsx").toString(), {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to generate report: ${text}`);
    }

    const payload = await response.json();
    const filename = payload.filename ?? "reporte_asistencia.xlsx";
    const uri = `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(uri, payload.base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return uri;
  };

  const loadReportSummary = useCallback(async () => {
    if (!canViewReports || !session?.access_token) {
      setReportSummary(null);
      setReportSummaryError(null);
      return;
    }

    setIsLoadingReportSummary(true);
    setReportSummaryError(null);
    try {
      const response = await fetch(buildAttendanceReportUrl("json").toString(), {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to load report summary");
      }

      const payload = (await response.json()) as ReportSummaryResponse;
      setReportSummary(payload);
    } catch (error) {
      console.error("[HOME] report summary error:", error);
      setReportSummary(null);
      setReportSummaryError("No se pudo cargar el resumen operativo.");
    } finally {
      setIsLoadingReportSummary(false);
    }
  }, [buildAttendanceReportUrl, canViewReports, session?.access_token]);


  const loadWalletEligibility = useCallback(async () => {
    if (!user?.id) {
      setWalletEligibility(null);
      return;
    }
    setIsLoadingWalletEligibility(true);
    try {
      const { data, error } = await supabase.rpc("employee_wallet_eligibility", {
        p_employee_id: user.id,
      });
      if (error) {
        console.warn("[HOME] employee_wallet_eligibility error:", error);
        setWalletEligibility(null);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (row && typeof row === "object" && "wallet_eligible" in row) {
        setWalletEligibility({
          wallet_eligible: Boolean(row.wallet_eligible),
          contract_active: Boolean(row.contract_active),
          documents_complete: Boolean(row.documents_complete),
          wallet_status: String(row.wallet_status ?? ""),
        });
      } else {
        setWalletEligibility(null);
      }
    } catch (e) {
      console.warn("[HOME] loadWalletEligibility error:", e);
      setWalletEligibility(null);
    } finally {
      setIsLoadingWalletEligibility(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) void loadWalletEligibility();
    }, [user?.id, loadWalletEligibility]),
  );

  // Base para el carnet laboral: siempre el Supabase de ANIMA (no vento-pass).
  // Para Apple puedes sobrescribir con EXPO_PUBLIC_EMPLOYEE_APPLE_PASS_BASE si tienes otro servidor de .pkpass.
  const walletBaseUrl =
    (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_EMPLOYEE_APPLE_PASS_BASE) ||
    process.env.EXPO_PUBLIC_SUPABASE_URL;

  const handleAddCarnetToWallet = useCallback(async () => {
    if (!session?.access_token || !user?.id || isAddingCarnetToWallet) return;
    const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!baseUrl) {
      Alert.alert("Error", "Configuración de la app incompleta.");
      return;
    }
    setIsAddingCarnetToWallet(true);
    try {
      if (Platform.OS === "android") {
        const url = new URL("/functions/v1/employee-wallet-pass", baseUrl);
        const res = await fetch(url.toString(), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "No se pudo generar el pase");
        }
        const json = (await res.json()) as { saveUrl?: string };
        const saveUrl = json?.saveUrl;
        if (saveUrl) {
          await Linking.openURL(saveUrl);
        } else {
          throw new Error("No se recibió enlace para agregar a Wallet");
        }
      } else {
        const isCustomAppleBase = Boolean(
          typeof process !== "undefined" && process.env?.EXPO_PUBLIC_EMPLOYEE_APPLE_PASS_BASE,
        );
        const passPath = isCustomAppleBase ? "/api/employee-apple-pass" : "/functions/v1/employee-apple-pass";
        const passUrl = walletBaseUrl
          ? `${walletBaseUrl.replace(/\/$/, "")}${passPath}?token=${encodeURIComponent(session.access_token)}`
          : `${baseUrl}${passPath}?token=${encodeURIComponent(session.access_token)}`;
        await Linking.openURL(passUrl);
        await supabase.rpc("employee_wallet_mark_issued", { p_employee_id: user.id });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al agregar el carnet";
      Alert.alert("Error", msg);
    } finally {
      setIsAddingCarnetToWallet(false);
    }
  }, [session?.access_token, user?.id, isAddingCarnetToWallet]);

  const handleDownloadReport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const uri = await createReportFile();
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Exportación",
          "No hay opciones de compartir disponibles en este dispositivo.",
        );
        return;
      }
      await Sharing.shareAsync(uri, { dialogTitle: "Exportar asistencia" });
    } catch (err) {
      console.error("Export error:", err);
      Alert.alert("Error", "No se pudo exportar el reporte.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleEmailReport = async () => {
    if (isExporting) return;
    if (!user?.email) {
      Alert.alert("Error", "No hay email disponible para tu usuario.");
      return;
    }
    setIsExporting(true);
    try {
      const uri = await createReportFile();
      const canEmail = await MailComposer.isAvailableAsync();
      if (!canEmail) {
        await Sharing.shareAsync(uri, { dialogTitle: "Enviar reporte" });
        return;
      }
      await MailComposer.composeAsync({
        recipients: [user.email],
        subject: "Reporte de asistencia ANIMA",
        body: `Adjunto encuentras el reporte de asistencia (${reportScopeLabel}).`,
        attachments: [uri],
      });
    } catch (err) {
      console.error("Email error:", err);
      Alert.alert("Error", "No se pudo preparar el correo.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleSelectRangeDay = (dateString: string) => {
    const selected = new Date(`${dateString}T00:00:00`);
    if (!draftStartDate || (draftStartDate && draftEndDate)) {
      setDraftStartDate(selected);
      setDraftEndDate(null);
      return;
    }
    if (selected < draftStartDate) {
      setDraftEndDate(new Date(draftStartDate));
      setDraftStartDate(selected);
      return;
    }
    setDraftEndDate(selected);
  };

  const applyDraftRange = () => {
    if (!draftStartDate) return;
    const end = draftEndDate ?? draftStartDate;
    applyRange(draftStartDate, end);
    setIsDateModalOpen(false);
  };

  const shiftCalendarMonth = (delta: number) => {
    setCalendarMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + delta);
      next.setDate(1);
      next.setHours(0, 0, 0, 0);
      return next;
    });
  };

  const handleSelectSite = async (siteId: string) => {
    setIsSitePickerOpen(false);
    setActionError(null);
    await selectSiteForCheckIn(siteId);
  };

  const candidateSites = useMemo(() => {
    const baseLocation = geofenceState.location;

    const fallbackSites = employeeSites.map((site) => {
      const hasCoordinates = site.latitude != null && site.longitude != null;
      const distanceMeters =
        baseLocation && hasCoordinates
          ? Math.round(
              calculateDistance(
                baseLocation.latitude,
                baseLocation.longitude,
                site.latitude as number,
                site.longitude as number
              )
            )
          : null;

      return {
        id: site.siteId,
        name: site.siteName,
        distanceMeters,
        effectiveRadiusMeters: site.radiusMeters ?? 0,
        requiresGeolocation: hasCoordinates,
      };
    });

    if (!geofenceState.candidateSites || geofenceState.candidateSites.length === 0) {
      return fallbackSites;
    }

    if (!baseLocation) return geofenceState.candidateSites;

    return geofenceState.candidateSites.map((candidate) => {
      if (candidate.distanceMeters != null || !candidate.requiresGeolocation) {
        return candidate;
      }

      const site = employeeSites.find((item) => item.siteId === candidate.id);
      if (!site || site.latitude == null || site.longitude == null) {
        return candidate;
      }

      return {
        ...candidate,
        distanceMeters: Math.round(
          calculateDistance(
            baseLocation.latitude,
            baseLocation.longitude,
            site.latitude,
            site.longitude
          )
        ),
      };
    });
  }, [geofenceState.candidateSites, geofenceState.location, employeeSites]);
  const canChooseSite = employeeSites.length > 1;
  const topPadding = Math.max(20, insets.top + 12);
  const modalWidth = Math.min(windowWidth - 40, 420);
  const UI = {
    card: {
      backgroundColor: "white",
      borderRadius: 22,
      borderWidth: 1,
      borderColor: PALETTE.border,
      shadowColor: PALETTE.text,
      shadowOpacity: 0.06,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
    cardTint: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      height: 12,
      backgroundColor: RGBA.cardTint,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
    },
    surface2: {
      backgroundColor: PALETTE.porcelain2,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: PALETTE.border,
    },
    pill: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor: PALETTE.porcelain2,
      borderColor: PALETTE.border,
    },
    btnGhostPink: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: RGBA.borderPink,
      backgroundColor: "rgba(242, 238, 242, 0.70)",
    },
    ctaBase: {
      borderRadius: 22,
      paddingVertical: 16,
      paddingHorizontal: 16,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      overflow: "hidden" as const,
      borderWidth: 1,
    },
    ctaShadow: {
      shadowColor: PALETTE.text,
      shadowOpacity: 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    },
    ctaHighlight: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      height: 18,
      backgroundColor: RGBA.ctaHighlight,
    },
  } as const;

  const calendarTheme = {
    calendarBackground: "white",
    textDayFontSize: 13,
    textDayHeaderFontSize: 11,
    monthTextColor: PALETTE.text,
    textSectionTitleColor: PALETTE.neutral,
    dayTextColor: PALETTE.text,
    todayTextColor: PALETTE.roseGlow,
    "stylesheet.calendar.main": {
      week: {
        marginTop: 6,
        marginBottom: 6,
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 6,
      },
    },
    "stylesheet.calendar.header": {
      week: {
        marginTop: 6,
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 10,
      },
      dayHeader: {
        fontSize: 11,
        fontWeight: "600",
        color: PALETTE.neutral,
        textTransform: "uppercase",
      },
    },
    "stylesheet.day.basic": {
      base: {
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
      },
      text: {
        fontSize: 13,
        color: PALETTE.text,
      },
      today: {
        backgroundColor: "rgba(242, 198, 192, 0.18)",
      },
      todayText: {
        color: PALETTE.roseGlow,
        fontWeight: "700",
      },
    },
  } as const;
  const markedDates = getMarkedDates();
  const handleCalendarMonthChange = (month: DateData) => {
    const next = new Date(month.year, month.month - 1, 1);
    next.setHours(0, 0, 0, 0);
    setCalendarMonth(next);
  };
  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.porcelain }}>
      
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -280,
          right: -180,
          width: 560,
          height: 560,
          borderRadius: 280,
          backgroundColor: RGBA.washPink,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -260,
          left: -190,
          width: 560,
          height: 560,
          borderRadius: 280,
          backgroundColor: RGBA.washRoseGlow,
        }}
      />
      <UserMenuModal
        visible={isUserMenuOpen}
        topPadding={topPadding}
        onClose={() => setIsUserMenuOpen(false)}
        onSettings={() => {
          setIsUserMenuOpen(false);
          router.push("/account-settings");
        }}
        onSignOut={handleSignOut}
      />

      <SitePickerModal
        visible={isSitePickerOpen}
        modalWidth={modalWidth}
        candidateSites={candidateSites}
        onClose={() => setIsSitePickerOpen(false)}
        onSelectSite={handleSelectSite}
      />

      <View
        style={{
          alignSelf: "center",
          width: "100%",
          maxWidth: CONTENT_MAX_WIDTH,
          paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
          paddingTop: topPadding,
        }}
      >
        <View
          style={{
            ...UI.card,
            padding: 16,
            overflow: "hidden",
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -36,
              right: -28,
              width: 132,
              height: 132,
              borderRadius: 66,
              backgroundColor: RGBA.washPink,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: -44,
              left: -34,
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: RGBA.cardTint,
            }}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: PALETTE.neutral,
                  letterSpacing: 0.2,
                }}
              >
                {todayLabel}
              </Text>
              <Text
                style={{
                  fontSize: 34,
                  fontWeight: "900",
                  color: PALETTE.text,
                  marginTop: 4,
                  lineHeight: 38,
                }}
                numberOfLines={1}
              >
                Hola, {displayName}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setIsUserMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Abrir menú de usuario"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: PALETTE.porcelain2,
                borderWidth: 1,
                borderColor: PALETTE.border,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {employee?.avatarUrl ? (
                <Image
                  source={{ uri: employee.avatarUrl }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <Text
                  style={{ fontSize: 18, fontWeight: "900", color: PALETTE.text }}
                >
                  {avatarInitial}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              marginTop: 14,
            }}
          >
            <View
              style={{
                ...UI.pill,
                borderColor:
                  statusUI.tone === "active" ? RGBA.borderPink : PALETTE.border,
                backgroundColor:
                  statusUI.tone === "active" ? RGBA.washRoseGlow : PALETTE.porcelain2,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "900",
                  color: statusUI.tone === "active" ? PALETTE.accent : PALETTE.neutral,
                  letterSpacing: 0.45,
                  textTransform: "uppercase",
                }}
              >
                {statusUI.label}
              </Text>
            </View>

            <View
              style={{
                ...UI.pill,
                borderColor: geofencePill.border,
                backgroundColor: geofencePill.bg,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "900",
                  color: geofencePill.text,
                  letterSpacing: 0.45,
                  textTransform: "uppercase",
                }}
              >
                {geofenceUI.label}
              </Text>
            </View>

            <View
              style={{
                ...UI.pill,
                borderColor: isOffline ? RGBA.borderPink : PALETTE.border,
                backgroundColor: isOffline ? "rgba(226, 0, 106, 0.08)" : PALETTE.porcelain2,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  backgroundColor: isOffline ? PALETTE.accent : "#16a34a",
                }}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "900",
                  color: isOffline ? PALETTE.accent : PALETTE.neutral,
                  letterSpacing: 0.45,
                  textTransform: "uppercase",
                }}
              >
                {isOffline ? "Sin conexión" : "En línea"}
              </Text>
            </View>

            <View
              style={{
                ...UI.pill,
                borderColor: hasPendingAny ? RGBA.borderPink : PALETTE.border,
                backgroundColor: hasPendingAny ? "rgba(226, 0, 106, 0.08)" : PALETTE.porcelain2,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "900",
                  color: hasPendingAny ? PALETTE.accent : PALETTE.neutral,
                  letterSpacing: 0.45,
                  textTransform: "uppercase",
                }}
              >
                {hasPendingAny
                  ? `${pendingAttendanceCount + pendingBreakCount} pendientes`
                  : isSyncingAny
                    ? "Sincronizando"
                    : "Al día"}
              </Text>
            </View>

            {showHeaderOpsPill ? (
              <TouchableOpacity
                onPress={handleOpsPillPress}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  ...UI.pill,
                  backgroundColor: headerOpsPill.bg,
                  borderColor: headerOpsPill.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "900",
                    color: headerOpsPill.text,
                    letterSpacing: 0.45,
                    textTransform: "uppercase",
                  }}
                >
                  {headerOpsPill.label}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          flexGrow: 1,
          alignSelf: "center",
          width: "100%",
          maxWidth: CONTENT_MAX_WIDTH,
          paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
          paddingVertical: 18,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <View
          onLayout={(event) => {
            setOpsSectionY(event.nativeEvent.layout.y);
          }}
        />

        {user && notificationPermissionStatus !== "granted" ? (
          <TouchableOpacity
            onPress={requestNotificationPermissionOrOpenSettings}
            disabled={notificationPromptLoading}
            activeOpacity={0.85}
            style={{
              backgroundColor: "white",
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: PALETTE.border,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: RGBA.washRoseGlow,
                borderWidth: 1,
                borderColor: RGBA.borderPink,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="notifications-outline" size={22} color={PALETTE.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: PALETTE.text }}>
                Activa las notificaciones
              </Text>
              <Text style={{ fontSize: 13, color: PALETTE.neutral, marginTop: 2 }}>
                Para recibir avisos de turnos y del equipo
              </Text>
            </View>
            <View
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: notificationPromptLoading ? PALETTE.porcelain2 : RGBA.washRoseGlow,
                borderWidth: 1,
                borderColor: notificationPromptLoading ? PALETTE.border : RGBA.borderPink,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: notificationPromptLoading ? PALETTE.neutral : PALETTE.accent,
                }}
              >
                {notificationPromptLoading ? "..." : "Activar"}
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {(todayShift ?? nextScheduledShift) ? (
          <TouchableOpacity
            onPress={goToShifts}
            activeOpacity={0.9}
            style={{
              backgroundColor: "white",
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: PALETTE.border,
              marginBottom: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: RGBA.washRoseGlow,
                  borderWidth: 1,
                  borderColor: RGBA.borderPink,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="calendar-outline" size={20} color={PALETTE.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: PALETTE.neutral }}>
                  {todayShift ? "Tu turno hoy" : "Tu próximo turno"}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: "800", color: PALETTE.text, marginTop: 2 }}>
                  {formatShiftDateLabel((todayShift ?? nextScheduledShift)!.shift_date)} · {getShiftRangeLabel((todayShift ?? nextScheduledShift)!)}
                </Text>
                <Text style={{ fontSize: 13, color: PALETTE.neutral, marginTop: 2 }}>
                  {getShiftSiteName((todayShift ?? nextScheduledShift)!.sites)}
                </Text>
                {todayShift ? (
                  <Text style={{ fontSize: 12, color: PALETTE.neutral, marginTop: 4, fontStyle: "italic" }}>
                    Según tu turno programado
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={PALETTE.neutral} />
            </View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: PALETTE.accent, marginTop: 10 }}>
              Ver mis turnos
            </Text>
          </TouchableOpacity>
        ) : null}

        {isOffline ? (
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              marginBottom: 12,
            }}
          >
            <Text
              style={{ fontSize: 14, fontWeight: "800", color: COLORS.text }}
            >
              Sin conexión
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
              No pudimos actualizar tu jornada. Revisa tu conexión e intenta de
              nuevo.
            </Text>

            <TouchableOpacity
              onPress={handleRefresh}
              style={{
                marginTop: 12,
                alignSelf: "flex-start",
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: COLORS.accent,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "800", color: "white" }}>
                Reintentar
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {pendingAttendanceCount > 0 || pendingBreakCount > 0 ? (
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.text }}>
              Registros pendientes: {pendingAttendanceCount}
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
              {pendingAttendanceFailedCount > 0
                ? `${pendingAttendanceFailedCount} requieren reintento.`
                : "Se sincronizarán automáticamente cuando haya conexión estable."}
            </Text>
            {pendingAttendanceConflictCount > 0 ? (
              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
                Conflictos detectados: {pendingAttendanceConflictCount} (requieren revisión).
              </Text>
            ) : null}
            {pendingAttendanceOldestCreatedAt ? (
              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
                Pendiente más antiguo: {formatClock(pendingAttendanceOldestCreatedAt)}
              </Text>
            ) : null}
            {pendingAttendanceNextRetryAt ? (
              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
                Próximo reintento: {formatRetryClock(pendingAttendanceNextRetryAt)}
              </Text>
            ) : null}
            {pendingAttendanceLastError ? (
              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
                Último error: {pendingAttendanceLastError}
              </Text>
            ) : null}
            {pendingBreakCount > 0 ? (
              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
                Descansos pendientes: {pendingBreakCount}
                {pendingBreakFailedCount > 0
                  ? ` (${pendingBreakFailedCount} con error)`
                  : ""}
              </Text>
            ) : null}
            <TouchableOpacity
              onPress={() => {
                void syncPendingAttendanceQueue({ force: true });
                void syncPendingBreakQueue({ force: true });
              }}
              style={{
                marginTop: 12,
                alignSelf: "flex-start",
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: COLORS.accent,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "800", color: "white" }}>
                Sincronizar ahora
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {actionError ? (
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              marginBottom: 12,
            }}
          >
            <Text
              style={{ fontSize: 14, fontWeight: "800", color: COLORS.text }}
            >
              No se pudo registrar
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
              {actionError}
            </Text>
          </View>
        ) : null}

        {showAttendanceDiagnostics &&
        (attendanceDiagnostics.lastErrorStage ||
          attendanceDiagnostics.lastGeofenceDurationMs != null ||
          attendanceDiagnostics.lastCheckInDurationMs != null ||
          attendanceDiagnostics.lastCheckOutDurationMs != null ||
          attendanceDiagnostics.lastSyncDurationMs != null) ? (
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.text }}>
              Diagnóstico de asistencia
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 6 }}>
              Geofence: {formatLatency(attendanceDiagnostics.lastGeofenceDurationMs)} | Check-in:{" "}
              {formatLatency(attendanceDiagnostics.lastCheckInDurationMs)} | Check-out:{" "}
              {formatLatency(attendanceDiagnostics.lastCheckOutDurationMs)} | Sync:{" "}
              {formatLatency(attendanceDiagnostics.lastSyncDurationMs)}
            </Text>
            {attendanceDiagnostics.lastErrorStage ? (
              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
                Último fallo [{attendanceDiagnostics.lastErrorStage}]:{" "}
                {attendanceDiagnostics.lastErrorMessage ?? "sin detalle"}
              </Text>
            ) : null}
            <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
              Conteos - GPS: {attendanceDiagnostics.gpsErrorCount} | Red:{" "}
              {attendanceDiagnostics.networkErrorCount} | DB:{" "}
              {attendanceDiagnostics.dbErrorCount} | Permisos:{" "}
              {attendanceDiagnostics.permissionErrorCount} | Conflictos sync:{" "}
              {attendanceDiagnostics.syncConflictCount}
            </Text>
          </View>
        ) : null}

        
        <View style={{ ...UI.card, padding: 18 }}>
          <View pointerEvents="none" style={UI.cardTint} />
          <Text style={{ fontSize: 13, color: COLORS.neutral }}>
            Mi jornada hoy
          </Text>

          <View
            style={{
              marginTop: 12,
              flexDirection: "row",
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <Text
              style={{
                fontSize: 52,
                lineHeight: 56,
                fontWeight: "800",
                color: COLORS.text,
                fontVariant: ["tabular-nums"],
                flexShrink: 0,
              }}
            >
              {hoursLabel}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: COLORS.neutral,
                marginLeft: 10,
                marginBottom: 10,
              }}
            >
              netos hoy
            </Text>
          </View>

          <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 6 }}>
            {statusUI.hint}
          </Text>
          <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
            Descanso acumulado: {breakMinutesLabel}
            {attendanceState.isOnBreak ? " (en curso)" : ""}
          </Text>
          {attendanceState.lastCheckOutSource === "system" &&
          attendanceState.lastCheckOut ? (
            <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
              Turno cerrado automáticamente a las{" "}
              {formatClock(attendanceState.lastCheckOut)}.
            </Text>
          ) : null}

          <View
            style={{
              height: 1,
              backgroundColor: COLORS.border,
              marginVertical: 16,
            }}
          />

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View
              style={{
                flex: 1,
                ...UI.surface2,
                padding: 12,
              }}
            >
              <Text style={{ fontSize: 12, color: COLORS.neutral }}>
                Entrada
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  fontVariant: ["tabular-nums"],
                  color: COLORS.text,
                  marginTop: 8,
                }}
              >
                {lastCheckIn}
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                ...UI.surface2,
                padding: 12,
              }}
            >
              <Text style={{ fontSize: 12, color: COLORS.neutral }}>
                Salida
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: COLORS.text,
                  fontVariant: ["tabular-nums"],
                  marginTop: 8,
                }}
              >
                {lastCheckOut}
              </Text>
            </View>
          </View>
        </View>

        
        <View style={{ marginTop: 18 }}>
          <View style={{ ...UI.card, padding: 16, marginBottom: 12 }}>
            <View pointerEvents="none" style={UI.cardTint} />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: 12, color: COLORS.neutral }}>
                Verificación de ubicación
              </Text>

              <View
                style={{
                  ...UI.pill,
                  backgroundColor: geofencePill.bg,
                  borderColor: geofencePill.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    letterSpacing: 0.4,
                    color: geofencePill.text,
                  }}
                >
                  {geofenceUI.label}
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 10,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "800",
                    color: COLORS.text,
                  }}
                >
                  {activeSiteName}
                </Text>
                <Text
                  style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}
                >
                  {isCheckedIn
                    ? "Para registrar salida"
                    : "Para registrar entrada"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => refreshGeofence({ force: true, source: "user" })}
                disabled={isLoading || isGeoChecking || isCheckActionLocked}
                style={{
                  ...UI.btnGhostPink,
                  opacity: isLoading || isGeoChecking || isCheckActionLocked ? 0.6 : 1,
                }}
              >
                {isGeoChecking ? (
                  <ActivityIndicator color={PALETTE.accent} />
                ) : (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "800",
                      color: PALETTE.accent,
                    }}
                  >
                    Actualizar
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {canChooseSite ? (
              <TouchableOpacity
                onPress={() => setIsSitePickerOpen(true)}
                style={{
                  marginTop: 10,
                  alignSelf: "flex-start",
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: PALETTE.border,
                  backgroundColor: PALETTE.porcelain2,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: PALETTE.text,
                  }}
                >
                  Seleccionar sede
                </Text>
              </TouchableOpacity>
            ) : null}

            <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
              <View style={{ flex: 1, ...UI.surface2, padding: 12 }}>
                <Text style={{ fontSize: 12, color: PALETTE.neutral }}>
                  Distancia
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: PALETTE.text,
                    marginTop: 8,
                  }}
                >
                  {geofenceState.distanceMeters != null
                    ? `${geofenceState.distanceMeters}m`
                    : "--"}
                </Text>
              </View>

              <View style={{ flex: 1, ...UI.surface2, padding: 12 }}>
                <Text style={{ fontSize: 12, color: PALETTE.neutral }}>
                  Precisión
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: PALETTE.text,
                    marginTop: 8,
                  }}
                >
                  {geofenceState.accuracyMeters != null
                    ? `${Math.round(geofenceState.accuracyMeters)}m`
                    : "--"}
                </Text>
              </View>

              <View style={{ flex: 1, ...UI.surface2, padding: 12 }}>
                <Text style={{ fontSize: 12, color: PALETTE.neutral }}>
                  Radio
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: PALETTE.text,
                    marginTop: 8,
                  }}
                >
                  {geofenceState.effectiveRadiusMeters != null
                    ? `${geofenceState.effectiveRadiusMeters}m`
                    : "--"}
                </Text>
              </View>
            </View>

            <Text
              style={{
                fontSize: 12,
                color: COLORS.neutral,
                marginTop: 12,
                lineHeight: 16,
              }}
            >
              {geofenceState.isLatchedReady
                ? geofenceState.message ||
                  "Validación temporal activa. Puedes registrar mientras se restablece la señal."
                : isOffline
                ? "Sin conexión o red inestable: el registro puede fallar."
                : geofenceState.status === "ready"
                  ? "Ubicación verificada. Ya tienes permiso para registrar."
                  : geofenceState.message ||
                    "Verifica tu ubicación para poder registrar."}
            </Text>
            {geofenceState.isLatchedReady && latchedRemainingMs != null ? (
              <Text
                style={{
                  fontSize: 12,
                  color: COLORS.neutral,
                  marginTop: 6,
                }}
              >
                Ventana temporal activa: {formatRemainingShort(latchedRemainingMs)} restantes.
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={handleCheck}
            disabled={!canRegister}
            style={[
              {
                borderRadius: 20,
                paddingVertical: 18,
                paddingHorizontal: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: canRegister
                  ? PALETTE.accent
                  : RGBA.ctaDisabled,
                borderWidth: canRegister ? 0 : 1,
                borderColor: canRegister ? "transparent" : PALETTE.border,
                shadowColor: canRegister ? PALETTE.accent : "transparent",
                shadowOpacity: canRegister ? 0.3 : 0,
                shadowRadius: canRegister ? 12 : 0,
                shadowOffset: { width: 0, height: 6 },
                elevation: canRegister ? 6 : 0,
                minHeight: 64,
              },
            ]}
            activeOpacity={0.85}
          >
            {isLoading || isGeoChecking || isCheckActionLocked ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <ActivityIndicator color={ctaTextColor} size="small" />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: ctaTextColor,
                    letterSpacing: 0.3,
                  }}
                >
                  {ctaPrimaryLabel}
                </Text>
              </View>
            ) : (
              <View style={{ alignItems: "center", gap: 4 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: ctaTextColor,
                    opacity: canRegister ? 0.95 : 0.6,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  {ctaPrimaryLabel}
                </Text>

                {ctaSecondaryLabel ? (
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "800",
                      color: ctaTextColor,
                      letterSpacing: 0.2,
                    }}
                  >
                    {ctaSecondaryLabel}
                  </Text>
                ) : null}
              </View>
            )}
          </TouchableOpacity>

          {isCheckedIn ? (
            <TouchableOpacity
              onPress={handleToggleBreak}
              disabled={isLoading}
              style={{
                marginTop: 10,
                borderRadius: 14,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: attendanceState.isOnBreak
                  ? COLORS.rosegold
                  : PALETTE.border,
                backgroundColor: attendanceState.isOnBreak
                  ? "rgba(242, 198, 192, 0.28)"
                  : PALETTE.porcelain2,
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: attendanceState.isOnBreak ? COLORS.rosegold : COLORS.text,
                  textAlign: "center",
                }}
              >
                {attendanceState.isOnBreak
                  ? "Finalizar descanso"
                  : "Tomar descanso"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {user && (
          <View style={{ marginTop: 18 }}>
            <View
              style={{
                ...UI.card,
                padding: 14,
                borderWidth: 1,
                borderColor: PALETTE.border,
                backgroundColor: COLORS.white,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <View style={{ flex: 1, minWidth: 120 }}>
                  <Text style={{ fontSize: 12, color: COLORS.neutral }}>
                    Carnet laboral
                  </Text>
                  {isLoadingWalletEligibility ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <ActivityIndicator size="small" color={PALETTE.accent} />
                      <Text style={{ fontSize: 13, color: COLORS.neutral }}>Verificando…</Text>
                    </View>
                  ) : walletEligibility?.wallet_eligible ? (
                    <Text style={{ fontSize: 13, color: PALETTE.text, marginTop: 4 }}>
                      Añade tu credencial a Wallet
                    </Text>
                  ) : walletEligibility != null ? (
                    <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }} numberOfLines={2}>
                      {!walletEligibility.contract_active
                        ? "Contrato no vigente."
                        : !walletEligibility.documents_complete
                          ? "Faltan documentos requeridos."
                          : "No disponible."}
                    </Text>
                  ) : null}
                </View>
                {walletEligibility?.wallet_eligible && (
                  <TouchableOpacity
                    onPress={handleAddCarnetToWallet}
                    disabled={isAddingCarnetToWallet}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: PALETTE.accent,
                      backgroundColor: "transparent",
                    }}
                    activeOpacity={0.7}
                  >
                    {isAddingCarnetToWallet ? (
                      <ActivityIndicator size="small" color={PALETTE.accent} />
                    ) : (
                      <Text style={{ fontSize: 13, fontWeight: "600", color: PALETTE.accent }}>
                        Agregar a Wallet
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        <View style={{ marginTop: 20 }}>
          <View
            style={{
              backgroundColor: COLORS.white,
              borderRadius: 20,
              padding: 18,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    letterSpacing: 0.4,
                    color: PALETTE.accent,
                  }}
                >
                  MIS TURNOS
                </Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "900",
                    color: COLORS.text,
                    marginTop: 8,
                  }}
                >
                  {nextScheduledShift ? "Tu próximo horario" : "Horario pendiente"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={goToShifts}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 14,
                  backgroundColor: PALETTE.accent,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.white }}>
                  Ver todo
                </Text>
              </TouchableOpacity>
            </View>

            {isCheckedIn && todayShift ? (
              <View
                style={{
                  marginTop: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor:
                    attendanceState.currentSiteId === todayShift.site_id
                      ? "rgba(16, 185, 129, 0.12)"
                      : COLORS.porcelainAlt,
                  borderWidth: 1,
                  borderColor:
                    attendanceState.currentSiteId === todayShift.site_id
                      ? "#10B981"
                      : COLORS.border,
                }}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={
                    attendanceState.currentSiteId === todayShift.site_id
                      ? "#10B981"
                      : COLORS.neutral
                  }
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: COLORS.text,
                    flex: 1,
                  }}
                >
                  {attendanceState.currentSiteId === todayShift.site_id
                    ? "Dentro de tu turno de hoy"
                    : `Turno de hoy: ${getShiftSiteName(todayShift.sites)} (${getShiftRangeLabel(todayShift)}). Check-in registrado.`}
                </Text>
              </View>
            ) : null}
            {isLoadingNextShift ? (
              <View style={{ paddingVertical: 18, alignItems: "center" }}>
                <ActivityIndicator color={PALETTE.accent} />
                <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 10 }}>
                  Consultando turnos...
                </Text>
              </View>
            ) : nextScheduledShift ? (
              <>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "800",
                    color: COLORS.text,
                    marginTop: 14,
                  }}
                >
                  {formatShiftDateLabel(nextScheduledShift.shift_date)}
                </Text>
                <Text style={{ fontSize: 13, color: COLORS.neutral, marginTop: 6 }}>
                  {getShiftSiteName(nextScheduledShift.sites)}
                </Text>

                <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 16,
                      padding: 12,
                      backgroundColor: COLORS.porcelainAlt,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: COLORS.neutral }}>Horario</Text>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "800",
                        color: COLORS.text,
                        marginTop: 5,
                      }}
                    >
                      {getShiftRangeLabel(nextScheduledShift)}
                    </Text>
                  </View>

                  <View
                    style={{
                      flex: 1,
                      borderRadius: 16,
                      padding: 12,
                      backgroundColor: COLORS.porcelainAlt,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: COLORS.neutral }}>Duración neta</Text>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "800",
                        color: COLORS.text,
                        marginTop: 5,
                      }}
                    >
                      {nextShiftDurationLabel}
                    </Text>
                  </View>
                </View>

                {nextShiftStatusMeta ? (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      marginTop: 14,
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      backgroundColor: nextShiftStatusMeta.bg,
                      borderWidth: 1,
                      borderColor: nextShiftStatusMeta.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: nextShiftStatusMeta.text,
                      }}
                    >
                      {nextShiftStatusMeta.label}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={{ fontSize: 13, color: COLORS.neutral, marginTop: 14, lineHeight: 19 }}>
                Aún no tienes turnos próximos cargados. Cuando publiquen el horario aparecerá aquí.
              </Text>
            )}
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "800",
              color: COLORS.text,
              marginBottom: 10,
            }}
          >
            Accesos rápidos
          </Text>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={goToHistory}
              style={{
                flex: 1,
                backgroundColor: "white",
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: PALETTE.porcelain2,
                  borderWidth: 1,
                  borderColor: PALETTE.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: PALETTE.rose }}>
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={PALETTE.rose}
                  />
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  color: COLORS.text,
                  marginTop: 10,
                }}
              >
                Historial
              </Text>
              <Text
                style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}
              >
                Mis registros
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={goToAnnouncements}
              style={{
                flex: 1,
                backgroundColor: "white",
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: PALETTE.porcelain2,
                  borderWidth: 1,
                  borderColor: PALETTE.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: PALETTE.rose }}>
                  <Ionicons
                    name="notifications-outline"
                    size={18}
                    color={PALETTE.rose}
                  />
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  color: COLORS.text,
                  marginTop: 10,
                }}
              >
                Novedades
              </Text>
              <Text
                style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}
              >
                Avisos del equipo
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
            <TouchableOpacity
              onPress={goToSupport}
              style={{
                flex: 1,
                backgroundColor: "white",
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: PALETTE.porcelain2,
                  borderWidth: 1,
                  borderColor: PALETTE.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: PALETTE.rose }}>
                  <Ionicons
                    name="help-circle-outline"
                    size={18}
                    color={PALETTE.rose}
                  />
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  color: COLORS.text,
                  marginTop: 10,
                }}
              >
                Soporte
              </Text>
              <Text
                style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}
              >
                Reportar novedad
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={goToDocuments}
              style={{
                flex: 1,
                backgroundColor: "white",
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: PALETTE.porcelain2,
                  borderWidth: 1,
                  borderColor: PALETTE.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: PALETTE.rose }}>
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color={PALETTE.rose}
                  />
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  color: COLORS.text,
                  marginTop: 10,
                }}
              >
                Documentos
              </Text>
              <Text
                style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}
              >
                Formatos y solicitudes
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}
