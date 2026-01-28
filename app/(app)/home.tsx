import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as MailComposer from "expo-mail-composer";
import { Calendar } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "expo-router";
import { useAttendance } from "@/hooks/use-attendance";
// ANIMA palette tokens (derivados de /constants/colors)
const PALETTE = {
  porcelain: COLORS.porcelain,
  porcelain2: COLORS.porcelainAlt,
  text: COLORS.text,
  accent: COLORS.accent,
  rose: COLORS.rosegold,
  roseGlow: COLORS.rosegoldBright, // glow oro rosa (no morado)
  neutral: COLORS.neutral,
  border: COLORS.border,
  white: COLORS.white,
} as const;

const RGBA = {
  // Marca súper sutil en fondos
  washPink: "rgba(226, 0, 106, 0.06)", // accent @ 6%
  washRoseGlow: "rgba(242, 198, 192, 0.10)", // roseGlow @ 10%

  // Bordes â€œde marcaâ€
  borderPink: "rgba(226, 0, 106, 0.35)",
  borderRose: "rgba(183, 110, 121, 0.38)",

  // Estados/CTA
  ctaDisabled: "rgba(27, 26, 31, 0.08)", // text @ 8%
  ctaHighlight: "rgba(242, 198, 192, 0.18)", // roseGlow @ 18%

  // Tint superior de cards (muy sutil)
  cardTint: "rgba(242, 198, 192, 0.12)", // roseGlow @ 12%
} as const;
function formatClock(value: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const router = useRouter();
  const { user, session, employee, signOut, employeeSites, selectedSiteId } =
    useAuth();
  const {
    attendanceState,
    geofenceState,
    refreshGeofence,
    isLoading,
    isOffline,
    loadTodayAttendance,
    checkIn,
    checkOut,
    selectSiteForCheckIn,
    startRealtimeGeofence,
    stopRealtimeGeofence,
  } = useAttendance();

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

  const isCheckedIn = attendanceState.status === "checked_in";
  const isGeoChecking = geofenceState.status === "checking";
  const canRegister =
    !isLoading &&
    !isOffline &&
    geofenceState.canProceed &&
    !isGeoChecking &&
    !geofenceState.requiresSelection;
  const ctaTextColor = canRegister ? PALETTE.porcelain : PALETTE.text;
  const ctaSubTextOpacity = canRegister ? 0.9 : 0.7;

  useEffect(() => {
    if (!user) return;
    void loadTodayAttendance();
    void refreshGeofence({ force: true });
  }, [user, loadTodayAttendance, refreshGeofence]);

  useEffect(() => {
    if (!user) return;
    void refreshGeofence({ force: true });
  }, [attendanceState.status, user, refreshGeofence]);

  // Recargar tiempo trabajado cada minuto cuando hay check-in activo
  useEffect(() => {
    if (!isCheckedIn || !user) return;
    
    // Recargar inmediatamente y luego cada minuto
    const interval = setInterval(() => {
      void loadTodayAttendance();
    }, 60000); // Cada 60 segundos
    
    return () => clearInterval(interval);
  }, [isCheckedIn, user, loadTodayAttendance]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void startRealtimeGeofence();
      return () => stopRealtimeGeofence();
    }, [user, startRealtimeGeofence, stopRealtimeGeofence]),
  );

  useEffect(() => {
    if (geofenceState.requiresSelection) {
      setIsSitePickerOpen(true);
    }
  }, [geofenceState.requiresSelection]);

  useEffect(() => {
    if (!isDateModalOpen) return;
    setDraftStartDate(null);
    setDraftEndDate(null);
    const base = new Date(reportEndDate);
    base.setDate(1);
    base.setHours(0, 0, 0, 0);
    setCalendarMonth(base);
  }, [isDateModalOpen, reportEndDate]);

  const displayName =
    employee?.alias ||
    employee?.fullName?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "Usuario";
  const siteName =
    attendanceState.currentSiteName ||
    employee?.siteName ||
    "Sin sede asignada";
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
  }, [attendanceState.status]);
  const geofenceUI = useMemo(() => {
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
  // Calcular tiempo en tiempo real cuando hay check-in activo
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    if (isCheckedIn && attendanceState.lastCheckIn) {
      // Actualizar cada segundo cuando hay check-in activo
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isCheckedIn, attendanceState.lastCheckIn]);

  // Calcular tiempo total trabajado hoy en tiempo real
  const calculateTodayMinutes = useMemo(() => {
    if (!isCheckedIn || !attendanceState.lastCheckIn) {
      // Si no hay check-in activo, usar el valor calculado
      return Math.round(attendanceState.todayHours * 60);
    }

    // Si hay check-in activo, calcular tiempo desde el último check-in hasta ahora
    const checkInTime = new Date(attendanceState.lastCheckIn).getTime();
    const now = currentTime;
    const minutesFromActiveCheckIn = (now - checkInTime) / 60000;
    
    // todayHours se actualiza cada minuto con la recarga automática
    // Incluye períodos cerrados + tiempo del check-in activo cuando se calculó
    const baseMinutes = Math.round(attendanceState.todayHours * 60);
    
    // Si el tiempo actual es mayor o igual al base, usar el tiempo actual
    // (el base es solo del check-in activo o se desactualizó)
    if (minutesFromActiveCheckIn >= baseMinutes) {
      return Math.max(0, minutesFromActiveCheckIn);
    }
    
    // Si el base es mayor, probablemente hay períodos cerrados
    // Pero no sabemos cuánto tiempo llevaba el check-in activo cuando se calculó
    // Para simplificar, usamos el tiempo actual del check-in activo
    // La recarga automática cada minuto mantendrá el tiempo base actualizado
    // y eventualmente se sincronizará con períodos cerrados
    return Math.max(0, minutesFromActiveCheckIn);
  }, [attendanceState.todayHours, attendanceState.lastCheckIn, currentTime, isCheckedIn]);

  const hours = Math.floor(calculateTodayMinutes / 60);
  const minutes = Math.floor(calculateTodayMinutes % 60);
  const seconds = Math.floor((calculateTodayMinutes % 1) * 60);
  
  // Formato mejorado: HH:MM:SS cuando hay check-in activo, HH:MM cuando no
  const hoursLabel = isCheckedIn
    ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;

  const lastCheckIn = formatClock(attendanceState.lastCheckIn);
  const lastCheckOut = formatClock(attendanceState.lastCheckOut);

  const handleRefresh = async () => {
    if (!user) return;
    setIsRefreshing(true);
    setActionError(null);
    try {
      await loadTodayAttendance();
      await refreshGeofence({ force: true });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCheck = async () => {
    if (isLoading) return;
    if (isGeoChecking) return;

    setActionError(null);

    if (isOffline) {
      setActionError("Sin conexión. Revisa tu internet e intenta de nuevo.");
      return;
    }

    if (geofenceState.requiresSelection) {
      setActionError("Selecciona una sede para continuar.");
      setIsSitePickerOpen(true);
      return;
    }

    const geo = geofenceState.canProceed
      ? geofenceState
      : await refreshGeofence({ force: true });

    if (!geo.canProceed) {
      const msg = geo.message || "ubicación no verificada";
      setActionError(msg);
      Alert.alert("No se puede registrar", msg);
      return;
    }

    const result = isCheckedIn ? await checkOut() : await checkIn();
    if (!result.success) {
      const msg = result.error || "No se pudo completar la acción";
      setActionError(msg);
      Alert.alert("No se puede registrar", msg);
    }
  };

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    await signOut();
  };

  const handleSoon = (title: string) => {
    Alert.alert(title, "Esta sección estará disponible pronto.");
  };

  const goToHistory = () => {
    router.push("/history");
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

  const GLOBAL_REPORT_ROLES = new Set(["propietario", "gerente_general"]);
  const MANAGER_REPORT_SITE_TYPES = new Set(["satellite", "production_center"]);
  const selectedSiteType = selectedSite?.siteType ?? null;

  const canViewReports =
    (role != null && GLOBAL_REPORT_ROLES.has(role)) ||
    (role === "gerente" &&
      selectedSiteType != null &&
      MANAGER_REPORT_SITE_TYPES.has(selectedSiteType));

  const reportScopeLabel =
    role != null && GLOBAL_REPORT_ROLES.has(role)
      ? "Todas las sedes"
      : selectedSite?.siteName || "Tu sede";

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

  const createReportFile = async () => {
    if (!session?.access_token) {
      throw new Error("No hay sesion activa");
    }

    const start = reportStartDate;
    const end = reportEndDate;

    const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!baseUrl) {
      throw new Error("Missing Supabase URL");
    }

    const url = new URL("/functions/v1/attendance-report", baseUrl);
    url.searchParams.set("start", start.toISOString());
    url.searchParams.set("end", end.toISOString());

    const response = await fetch(url.toString(), {
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

  const handleDownloadReport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const uri = await createReportFile();
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Exportacion",
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

  const candidateSites = geofenceState.candidateSites ?? [];
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
      backgroundColor: RGBA.cardTint, // rose glow tint
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
      backgroundColor: "rgba(242, 238, 242, 0.70)", // porcelain2 @ 70%
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
  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.porcelain }}>
      {/* Hero wash (premium, súper sutil) */}
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
      {/* User menu */}
      <Modal
        transparent
        visible={isUserMenuOpen}
        animationType="fade"
        onRequestClose={() => setIsUserMenuOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.10)" }}
          onPress={() => setIsUserMenuOpen(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              position: "absolute",
              top: topPadding + 44,
              right: 20,
              backgroundColor: "white",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOpacity: 0.1,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 10 },
              elevation: 8,
              minWidth: 220,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                setIsUserMenuOpen(false);
                void handleRefresh();
              }}
              style={{ paddingVertical: 12, paddingHorizontal: 16 }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }}
              >
                Actualizar
              </Text>
              <Text
                style={{ fontSize: 12, color: COLORS.neutral, marginTop: 2 }}
              >
                Recargar estado de hoy
              </Text>
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: COLORS.border }} />

            <TouchableOpacity
              onPress={() => {
                setIsUserMenuOpen(false);
                handleSoon("Mi perfil");
              }}
              style={{ paddingVertical: 12, paddingHorizontal: 16 }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: COLORS.text }}
              >
                Mi perfil
              </Text>
              <Text
                style={{ fontSize: 12, color: COLORS.neutral, marginTop: 2 }}
              >
                Datos y preferencias
              </Text>
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: COLORS.border }} />

            <TouchableOpacity
              onPress={handleSignOut}
              style={{ paddingVertical: 12, paddingHorizontal: 16 }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "700", color: COLORS.text }}
              >
                Cerrar sesión
              </Text>
              <Text
                style={{ fontSize: 12, color: COLORS.neutral, marginTop: 2 }}
              >
                Salir de ANIMA
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Site picker */}
      <Modal
        transparent
        visible={isSitePickerOpen}
        animationType="fade"
        onRequestClose={() => setIsSitePickerOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            padding: 20,
            justifyContent: "center",
          }}
          onPress={() => setIsSitePickerOpen(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              backgroundColor: "white",
              borderRadius: 20,
              padding: 18,
              width: modalWidth,
              borderWidth: 1,
              borderColor: COLORS.border,
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 12 },
              elevation: 10,
            }}
          >
            <Text
              style={{ fontSize: 16, fontWeight: "800", color: COLORS.text }}
            >
              Selecciona tu sede
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 6 }}>
              Estas cerca de varias sedes. Elige la correcta para continuar.
            </Text>

            <View style={{ marginTop: 12, gap: 10 }}>
              {candidateSites.length === 0 ? (
                <Text style={{ fontSize: 12, color: COLORS.neutral }}>
                  No hay sedes disponibles para seleccionar.
                </Text>
              ) : (
                candidateSites.map((site) => (
                  <TouchableOpacity
                    key={site.id}
                    onPress={() => handleSelectSite(site.id)}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      backgroundColor: COLORS.porcelain,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "800",
                        color: COLORS.text,
                      }}
                    >
                      {site.name}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: COLORS.neutral,
                        marginTop: 4,
                      }}
                    >
                      {site.distanceMeters}m - radio{" "}
                      {site.effectiveRadiusMeters}m
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>

            <TouchableOpacity
              onPress={() => setIsSitePickerOpen(false)}
              style={{
                alignSelf: "flex-end",
                marginTop: 14,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 12,
                backgroundColor: COLORS.accent,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "800", color: "white" }}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Date range picker */}
      <Modal
        transparent
        visible={isDateModalOpen}
        animationType="fade"
        onRequestClose={() => setIsDateModalOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            padding: 20,
            justifyContent: "center",
          }}
          onPress={() => setIsDateModalOpen(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              backgroundColor: "white",
              borderRadius: 20,
              padding: 18,
              borderWidth: 1,
              borderColor: COLORS.border,
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 12 },
              elevation: 10,
              width: modalWidth,
              alignSelf: "center",
            }}
          >
            <Text
              style={{ fontSize: 16, fontWeight: "800", color: COLORS.text }}
            >
              Rango del reporte
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 6 }}>
              Selecciona un rango exacto desde el calendario.
            </Text>

            <View style={{ marginTop: 16 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1, ...UI.surface2, padding: 12 }}>
                  <Text style={{ fontSize: 12, color: COLORS.neutral }}>
                    Inicio
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: COLORS.text,
                      marginTop: 4,
                    }}
                  >
                    {draftStartDate
                      ? formatShortDate(draftStartDate)
                      : "Selecciona"}
                  </Text>
                </View>
                <View style={{ flex: 1, ...UI.surface2, padding: 12 }}>
                  <Text style={{ fontSize: 12, color: COLORS.neutral }}>
                    Fin
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: COLORS.text,
                      marginTop: 4,
                    }}
                  >
                    {draftEndDate
                      ? formatShortDate(draftEndDate)
                      : "Selecciona"}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  marginTop: 12,
                  borderRadius: 16,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Calendar
                  key={toDateKey(calendarMonth)}
                  current={toDateKey(calendarMonth)}
                  enableSwipeMonths
                  hideArrows
                  hideExtraDays
                  onDayPress={(day) => handleSelectRangeDay(day.dateString)}
                  onMonthChange={(month) => {
                    const next = new Date(month.year, month.month - 1, 1);
                    next.setHours(0, 0, 0, 0);
                    setCalendarMonth(next);
                  }}
                  markedDates={getMarkedDates()}
                  markingType="custom"
                  renderHeader={() => (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => shiftCalendarMonth(-1)}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: PALETTE.border,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: PALETTE.porcelain2,
                        }}
                      >
                        <Ionicons
                          name="chevron-back"
                          size={16}
                          color={PALETTE.text}
                        />
                      </TouchableOpacity>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: PALETTE.text,
                          letterSpacing: 0.2,
                        }}
                      >
                        {formatMonthLabel(calendarMonth)}
                      </Text>
                      <TouchableOpacity
                        onPress={() => shiftCalendarMonth(1)}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: PALETTE.border,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: PALETTE.porcelain2,
                        }}
                      >
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={PALETTE.text}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                  style={{ width: "100%" }}
                  theme={calendarTheme as unknown as Record<string, unknown>}
                />
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: 12,
                justifyContent: "flex-end",
                marginTop: 16,
              }}
            >
              <TouchableOpacity
                onPress={() => setIsDateModalOpen(false)}
                style={{ ...UI.btnGhostPink }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: PALETTE.accent,
                  }}
                >
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={applyDraftRange}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: PALETTE.accent,
                }}
              >
                <Text
                  style={{ fontSize: 12, fontWeight: "800", color: "white" }}
                >
                  Aplicar
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: topPadding }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 13, color: COLORS.neutral }}>
              {todayLabel}
            </Text>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 6,
                gap: 10,
              }}
            >
              <Text
                style={{ fontSize: 26, fontWeight: "800", color: COLORS.text }}
              >
                Hola, {displayName}
              </Text>

              <View
                style={{
                  ...UI.pill,
                  borderColor:
                    statusUI.tone === "active"
                      ? RGBA.borderPink
                      : PALETTE.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color:
                      statusUI.tone === "active"
                        ? PALETTE.accent
                        : PALETTE.neutral,
                    letterSpacing: 0.4,
                  }}
                >
                  {statusUI.label}
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 14, color: COLORS.neutral, marginTop: 6 }}>
              {siteName}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setIsUserMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Abrir menu de usuario"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
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
                style={{ fontSize: 16, fontWeight: "800", color: PALETTE.text }}
              >
                {avatarInitial}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingVertical: 18,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Connectivity / error banners */}
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

        {/* Main day card */}
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
              {isCheckedIn ? "activo" : "horas"}
            </Text>
          </View>

          <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 6 }}>
            {statusUI.hint}
          </Text>

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

        {/* Primary action */}
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
                  {geofenceState.siteName || siteName}
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
                onPress={() => refreshGeofence({ force: true })}
                disabled={isLoading || isGeoChecking}
                style={{
                  ...UI.btnGhostPink,
                  opacity: isLoading || isGeoChecking ? 0.6 : 1,
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
              {isOffline
                ? "Sin conexión: no podras registrar asistencia."
                : geofenceState.status === "ready"
                  ? "ubicación verificada. Ya puedes registrar."
                  : geofenceState.message ||
                    "Verifica tu ubicación para poder registrar."}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleCheck}
            disabled={!canRegister}
            style={[
              UI.ctaBase,
              canRegister ? UI.ctaShadow : null,
              {
                backgroundColor: canRegister
                  ? PALETTE.accent
                  : RGBA.ctaDisabled,
                borderColor: canRegister ? "transparent" : PALETTE.border,
              },
            ]}
          >
            {canRegister ? (
              <View pointerEvents="none" style={UI.ctaHighlight} />
            ) : null}
            {isLoading || isGeoChecking ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <ActivityIndicator color={ctaTextColor} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "800",
                    color: ctaTextColor,
                  }}
                >
                  {isGeoChecking
                    ? "Verificando ubicación..."
                    : "Registrando..."}
                </Text>
              </View>
            ) : (
              <View style={{ alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: ctaTextColor,
                    opacity: ctaSubTextOpacity,
                  }}
                >
                  {isCheckedIn ? "Registrar salida" : "Registrar entrada"}
                </Text>

                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: ctaTextColor,
                    marginTop: 6,
                  }}
                >
                  {isCheckedIn ? "Terminar turno" : "Iniciar turno"}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {canViewReports ? (
          <View style={{ marginTop: 22 }}>
            <View style={{ ...UI.card, padding: 16 }}>
              <View pointerEvents="none" style={UI.cardTint} />
              <Text style={{ fontSize: 13, color: COLORS.neutral }}>
                Reportes
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "800",
                  color: COLORS.text,
                  marginTop: 6,
                }}
              >
                Asistencia del equipo
              </Text>
              <Text
                style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}
              >
                Alcance: {reportScopeLabel}
              </Text>
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 12, color: COLORS.neutral }}>
                  Periodo: {reportRangeLabel}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsDateModalOpen(true)}
                  style={{
                    ...UI.btnGhostPink,
                    alignSelf: "flex-start",
                    marginTop: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: PALETTE.accent,
                    }}
                  >
                    Cambiar rango
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
                <TouchableOpacity
                  onPress={handleDownloadReport}
                  disabled={isExporting}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    backgroundColor: COLORS.accent,
                    opacity: isExporting ? 0.6 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "800",
                      color: "white",
                      textAlign: "center",
                    }}
                  >
                    Descargar Excel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleEmailReport}
                  disabled={isExporting}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    backgroundColor: PALETTE.porcelain2,
                    borderWidth: 1,
                    borderColor: PALETTE.border,
                    opacity: isExporting ? 0.6 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "800",
                      color: PALETTE.text,
                      textAlign: "center",
                    }}
                  >
                    Enviar por correo
                  </Text>
                </TouchableOpacity>
              </View>

              {isExporting ? (
                <Text
                  style={{ fontSize: 12, color: COLORS.neutral, marginTop: 10 }}
                >
                  Preparando archivo...
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Quick actions */}
        <View style={{ marginTop: 20 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "800",
              color: COLORS.text,
              marginBottom: 10,
            }}
          >
            Accesos rapidos
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
