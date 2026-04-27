import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as MailComposer from "expo-mail-composer";
import type { DateData } from "react-native-calendars";
import { useWindowDimensions } from "react-native";
import { ANIMA_COPY } from "@/brand/anima/copy/app-copy";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";
import { COLORS } from "@/constants/colors";
import { PALETTE } from "@/components/home/theme";
import { DateRangeModal } from "@/components/home/DateRangeModal";
import { ReportFilterModal } from "@/components/home/ReportFilterModal";

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

type ReportSummaryResponse = {
  summary: ReportSummarySnapshot;
  topEmployees: { employeeName: string; incidentCount: number; lateCount: number; noShowCount: number; openCount: number }[];
  topSites: { siteName: string; incidentCount: number; lateCount: number; noShowCount: number; openCount: number }[];
  incidents: { category: string; employeeName: string; detail: string }[];
  incidentCountTotal: number;
};

const GLOBAL_REPORT_ROLES = new Set(["propietario", "gerente_general"]);
const MANAGER_REPORT_SITE_TYPES = new Set(["satellite", "production_center"]);

function formatMinutesLabel(totalMinutes: number) {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }
  return `${minutes} min`;
}

function formatPercent(value: number) {
  return `${Math.round(Math.max(0, value) * 100)}%`;
}

const UI = {
  card: {
    backgroundColor: "white" as const,
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
    backgroundColor: "rgba(226, 0, 106, 0.04)",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
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
    borderColor: "rgba(226, 0, 106, 0.35)",
    backgroundColor: "rgba(242, 238, 242, 0.70)",
  },
};

export function OperativoReportScreen() {
  const { user, session, employee, selectedSiteId, employeeSites } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const modalWidth = Math.min(windowWidth - 40, 420);

  const role = employee?.role ?? null;
  const selectedSite = useMemo(
    () => employeeSites.find((s) => s.siteId === selectedSiteId) ?? null,
    [employeeSites, selectedSiteId],
  );
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
  const [reportEmployees, setReportEmployees] = useState<ReportEmployeeOption[]>([]);
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
  const [isExporting, setIsExporting] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);

  const selectedReportSite = useMemo(
    () => (reportSiteId ? reportSites.find((s) => s.id === reportSiteId) ?? null : null),
    [reportSiteId, reportSites],
  );
  const filteredReportEmployees = useMemo(() => {
    if (!reportSiteId) return reportEmployees;
    return reportEmployees.filter((e) => e.siteIds.includes(reportSiteId));
  }, [reportEmployees, reportSiteId]);
  const selectedReportEmployee = useMemo(
    () =>
      reportEmployeeId
        ? filteredReportEmployees.find((e) => e.id === reportEmployeeId) ?? null
        : null,
    [reportEmployeeId, filteredReportEmployees],
  );

  const effectiveReportSiteId = isGlobalReportRole ? reportSiteId : null;
  const effectiveReportEmployeeId = isGlobalReportRole
    ? reportEmployeeId
    : canPersonalReports
      ? user?.id ?? null
      : null;

  const reportTitle = canPersonalReports ? "Mi asistencia" : "Asistencia del equipo";
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

  const formatShortDate = (value: Date) =>
    value.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  const reportRangeLabel = `${formatShortDate(reportStartDate)} - ${formatShortDate(reportEndDate)}`;

  const formatMonthLabel = (value: Date) => {
    const label = value.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
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
    const marked: Record<string, { customStyles: { container: object; text: object } }> = {};
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
            backgroundColor: isEdge ? PALETTE.accent : "rgba(226, 0, 106, 0.12)",
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

  const applyRange = useCallback((start: Date, end: Date) => {
    const nextStart = new Date(start);
    const nextEnd = new Date(end);
    nextStart.setHours(0, 0, 0, 0);
    nextEnd.setHours(23, 59, 59, 999);
    if (nextStart > nextEnd) {
      const t = nextStart.getTime();
      nextStart.setTime(nextEnd.getTime());
      nextEnd.setTime(t);
    }
    setReportStartDate(nextStart);
    setReportEndDate(nextEnd);
  }, []);

  const buildAttendanceReportUrl = useCallback(
    (format: "xlsx" | "json" = "xlsx") => {
      const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!baseUrl) throw new Error("Missing Supabase URL");
      const url = new URL("/functions/v1/attendance-report", baseUrl);
      url.searchParams.set("start", reportStartDate.toISOString());
      url.searchParams.set("end", reportEndDate.toISOString());
      url.searchParams.set("format", format);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) url.searchParams.set("tz", tz);
      if (effectiveReportSiteId) url.searchParams.set("site_id", effectiveReportSiteId);
      if (effectiveReportEmployeeId) url.searchParams.set("employee_id", effectiveReportEmployeeId);
      return url;
    },
    [effectiveReportEmployeeId, effectiveReportSiteId, reportEndDate, reportStartDate],
  );

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
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error(await response.text());
      const payload = (await response.json()) as ReportSummaryResponse;
      setReportSummary(payload);
    } catch (e) {
      console.error("[Operativo] report summary error:", e);
      setReportSummary(null);
      setReportSummaryError("No se pudo cargar el resumen operativo.");
    } finally {
      setIsLoadingReportSummary(false);
    }
  }, [buildAttendanceReportUrl, canViewReports, session?.access_token]);

  useEffect(() => {
    loadReportSummary();
  }, [loadReportSummary]);

  useEffect(() => {
    if (!isDateModalOpen) return;
    setDraftStartDate(null);
    setDraftEndDate(null);
    const base = new Date(reportEndDate);
    base.setDate(1);
    base.setHours(0, 0, 0, 0);
    setCalendarMonth(base);
  }, [isDateModalOpen, reportEndDate]);

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
          supabase.from("sites").select("id, name, is_active").eq("is_active", true).order("name", { ascending: true }),
          supabase.from("employees").select("id, full_name, alias, role, is_active, site_id").eq("is_active", true).order("full_name", { ascending: true }),
          supabase.from("employee_sites").select("employee_id, site_id, is_active").eq("is_active", true),
        ]);
        if (sitesError || employeesError || assignmentsError || cancelled) return;
        const siteOptions = ((sitesData as { id: string; name: string | null }[]) ?? []).map((row) => ({
          id: row.id,
          label: row.name ?? "Sede sin nombre",
        }));
        setReportSites(siteOptions);
        setReportSiteId((prev) => (prev && !siteOptions.some((s) => s.id === prev) ? null : prev));
        const siteIdsByEmployee = new Map<string, Set<string>>();
        for (const row of (assignmentsData as { employee_id: string; site_id: string }[]) ?? []) {
          const set = siteIdsByEmployee.get(row.employee_id) ?? new Set<string>();
          set.add(row.site_id);
          siteIdsByEmployee.set(row.employee_id, set);
        }
        const options = ((employeesData as { id: string; full_name: string | null; alias: string | null; role: string | null; site_id: string | null }[]) ?? []).map((row) => {
          const set = siteIdsByEmployee.get(row.id) ?? new Set<string>();
          if (row.site_id) set.add(row.site_id);
          return {
            id: row.id,
            label: (row.alias ?? row.full_name ?? row.id) as string,
            role: row.role,
            siteIds: [...set],
          };
        });
        setReportEmployees(options);
        setReportEmployeeId((prev) => (prev && !options.some((o) => o.id === prev) ? null : prev));
      } catch (err) {
        console.warn("[Operativo] report filters error:", err);
      } finally {
        if (!cancelled) {
          setIsLoadingReportEmployees(false);
          setIsLoadingReportSites(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isGlobalReportRole]);

  useEffect(() => {
    if (!isGlobalReportRole || !reportEmployeeId) return;
    if (filteredReportEmployees.some((e) => e.id === reportEmployeeId)) return;
    setReportEmployeeId(null);
  }, [isGlobalReportRole, reportEmployeeId, filteredReportEmployees]);

  const createReportFile = useCallback(async () => {
    if (!session?.access_token) throw new Error("No hay sesión activa");
    const response = await fetch(buildAttendanceReportUrl("xlsx").toString(), {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) throw new Error(await response.text());
    const payload = await response.json();
    const filename = payload.filename ?? "reporte_asistencia.xlsx";
    const uri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(uri, payload.base64, { encoding: FileSystem.EncodingType.Base64 });
    return uri;
  }, [buildAttendanceReportUrl, session?.access_token]);

  const handleDownloadReport = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const uri = await createReportFile();
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Exportación", "No hay opciones de compartir disponibles.");
        return;
      }
      await Sharing.shareAsync(uri, { dialogTitle: "Exportar asistencia" });
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "No se pudo exportar el reporte.");
    } finally {
      setIsExporting(false);
    }
  }, [createReportFile, isExporting]);

  const handleEmailReport = useCallback(async () => {
    if (isExporting || !user?.email) {
      if (!user?.email) Alert.alert("Error", "No hay email disponible.");
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
        subject: ANIMA_COPY.attendanceReportSubject,
        body: `Adjunto encuentras el reporte de asistencia (${reportScopeLabel}).`,
        attachments: [uri],
      });
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "No se pudo preparar el correo.");
    } finally {
      setIsExporting(false);
    }
  }, [createReportFile, isExporting, user?.email, reportScopeLabel]);

  const applyDraftRange = useCallback(() => {
    if (!draftStartDate) return;
    const end = draftEndDate ?? draftStartDate;
    applyRange(draftStartDate, end);
    setIsDateModalOpen(false);
  }, [draftStartDate, draftEndDate, applyRange]);

  const handleSelectRangeDay = useCallback((dateString: string) => {
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
  }, [draftStartDate, draftEndDate]);

  const shiftCalendarMonth = useCallback((delta: number) => {
    setCalendarMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + delta);
      next.setDate(1);
      next.setHours(0, 0, 0, 0);
      return next;
    });
  }, []);

  const handleCalendarMonthChange = useCallback((month: DateData) => {
    setCalendarMonth(new Date(month.year, month.month - 1, 1));
  }, []);

  const calendarTheme = {
    calendarBackground: "white",
    textDayFontSize: 13,
    textDayHeaderFontSize: 11,
    monthTextColor: PALETTE.text,
    textSectionTitleColor: PALETTE.neutral,
    dayTextColor: PALETTE.text,
    todayTextColor: PALETTE.roseGlow,
    "stylesheet.calendar.main": { week: { marginTop: 6, marginBottom: 6, flexDirection: "row" as const, justifyContent: "space-between" as const, paddingHorizontal: 6 } },
    "stylesheet.calendar.header": { week: { marginTop: 6, flexDirection: "row" as const, justifyContent: "space-between" as const, paddingHorizontal: 10 }, dayHeader: { fontSize: 11, fontWeight: "600" as const, color: PALETTE.neutral, textTransform: "uppercase" as const } },
    "stylesheet.day.basic": { base: { width: 36, height: 36, alignItems: "center" as const, justifyContent: "center" as const, borderRadius: 12 }, text: { fontSize: 13, color: PALETTE.text }, today: { backgroundColor: "rgba(242, 198, 192, 0.18)" }, todayText: { color: PALETTE.roseGlow, fontWeight: "700" as const } },
  } as const;

  const markedDates = getMarkedDates();
  const surfaceStyle = { backgroundColor: PALETTE.porcelain2, borderRadius: 14, borderWidth: 1, borderColor: PALETTE.border };

  return (
    <>
      <DateRangeModal
        visible={isDateModalOpen}
        modalWidth={modalWidth}
        calendarTheme={calendarTheme}
        calendarMonth={calendarMonth}
        markedDates={markedDates}
        draftStartDate={draftStartDate}
        draftEndDate={draftEndDate}
        surfaceStyle={surfaceStyle}
        onClose={() => setIsDateModalOpen(false)}
        onApply={applyDraftRange}
        onSelectDay={handleSelectRangeDay}
        onMonthChange={handleCalendarMonthChange}
        shiftCalendarMonth={shiftCalendarMonth}
        toDateKey={toDateKey}
        formatShortDate={formatShortDate}
        formatMonthLabel={formatMonthLabel}
      />
      <ReportFilterModal
        visible={isReportSiteModalOpen}
        title="Seleccionar sede"
        subtitle="Filtra el reporte por una sede específica o usa todas."
        options={reportSites}
        selectedId={reportSiteId}
        includeAll
        allLabel="Todas las sedes"
        modalWidth={modalWidth}
        onSelect={(id) => setReportSiteId(id)}
        onClose={() => setIsReportSiteModalOpen(false)}
      />
      <ReportFilterModal
        visible={isReportEmployeeModalOpen}
        title="Seleccionar trabajador"
        subtitle={reportSiteId ? "Mostrando solo trabajadores de la sede seleccionada." : "Puedes seleccionar un trabajador o todos."}
        options={filteredReportEmployees}
        selectedId={reportEmployeeId}
        includeAll
        allLabel="Todos los trabajadores"
        modalWidth={modalWidth}
        onSelect={(id) => setReportEmployeeId(id)}
        onClose={() => setIsReportEmployeeModalOpen(false)}
      />

      <View style={{ ...UI.card, padding: 16 }}>
        <View pointerEvents="none" style={UI.cardTint} />
        <Text style={{ fontSize: 13, color: COLORS.neutral }}>Reportes</Text>
        <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.text, marginTop: 6 }}>{reportTitle}</Text>
        <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>Alcance: {reportScopeLabel}</Text>

        {isGlobalReportRole ? (
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 12, color: COLORS.neutral }}>Filtros</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => setIsReportSiteModalOpen(true)}
                style={{ flex: 1, ...UI.pill, borderColor: reportSiteId ? COLORS.accent : PALETTE.border, backgroundColor: reportSiteId ? "rgba(226, 0, 106, 0.12)" : PALETTE.porcelain2 }}
              >
                <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "800", color: reportSiteId ? COLORS.accent : COLORS.text, textAlign: "center" }}>
                  {isLoadingReportSites ? "Cargando sedes..." : selectedReportSite?.label ?? "Todas las sedes"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setIsReportEmployeeModalOpen(true)}
                disabled={isLoadingReportEmployees}
                style={{ flex: 1, ...UI.pill, borderColor: reportEmployeeId ? COLORS.accent : PALETTE.border, backgroundColor: reportEmployeeId ? "rgba(226, 0, 106, 0.12)" : PALETTE.porcelain2, opacity: isLoadingReportEmployees ? 0.7 : 1 }}
              >
                <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "800", color: reportEmployeeId ? COLORS.accent : COLORS.text, textAlign: "center" }}>
                  {isLoadingReportEmployees ? "Cargando..." : selectedReportEmployee?.label ?? "Todos los trabajadores"}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 11, color: COLORS.neutral, marginTop: 8 }}>
              {reportSiteId ? `${filteredReportEmployees.length} trabajadores en la sede` : `${reportEmployees.length} trabajadores`}
            </Text>
          </View>
        ) : null}

        <View style={{ marginTop: 10 }}>
          <Text style={{ fontSize: 12, color: COLORS.neutral }}>Periodo: {reportRangeLabel}</Text>
          <TouchableOpacity onPress={() => setIsDateModalOpen(true)} style={{ ...UI.btnGhostPink, alignSelf: "flex-start", marginTop: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: PALETTE.accent }}>Cambiar rango</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 12, color: COLORS.neutral }}>Resumen operativo</Text>
          {isLoadingReportSummary ? (
            <View style={{ marginTop: 10, paddingVertical: 16, alignItems: "center" }}>
              <ActivityIndicator color={COLORS.accent} />
              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 8 }}>Cargando métricas...</Text>
            </View>
          ) : reportSummary ? (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {[
                  { label: "Programados", value: reportSummary.summary.scheduledShifts },
                  { label: "Asistidos", value: reportSummary.summary.attendedShifts },
                  { label: "Tardanzas", value: reportSummary.summary.lateCount },
                  { label: "No show", value: reportSummary.summary.noShowCount },
                  { label: "Sin cierre", value: reportSummary.summary.missingCloseCount },
                  { label: "Autocierres", value: reportSummary.summary.autoCloseCount },
                ].map((item) => (
                  <View key={item.label} style={{ minWidth: "31%", flexGrow: 1, borderRadius: 14, borderWidth: 1, borderColor: PALETTE.border, backgroundColor: PALETTE.porcelain2, paddingVertical: 10, paddingHorizontal: 12 }}>
                    <Text style={{ fontSize: 11, color: COLORS.neutral }}>{item.label}</Text>
                    <Text style={{ fontSize: 16, fontWeight: "900", color: COLORS.text, marginTop: 4 }}>{item.value}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                <View style={{ flex: 1, minWidth: "48%", borderRadius: 14, borderWidth: 1, borderColor: PALETTE.border, backgroundColor: "rgba(226, 0, 106, 0.08)", paddingVertical: 10, paddingHorizontal: 12 }}>
                  <Text style={{ fontSize: 11, color: COLORS.neutral }}>Horas programadas</Text>
                  <Text style={{ fontSize: 15, fontWeight: "900", color: COLORS.text, marginTop: 4 }}>{formatMinutesLabel(reportSummary.summary.scheduledMinutes)}</Text>
                </View>
                <View style={{ flex: 1, minWidth: "48%", borderRadius: 14, borderWidth: 1, borderColor: PALETTE.border, backgroundColor: "rgba(226, 0, 106, 0.08)", paddingVertical: 10, paddingHorizontal: 12 }}>
                  <Text style={{ fontSize: 11, color: COLORS.neutral }}>Horas netas reales</Text>
                  <Text style={{ fontSize: 15, fontWeight: "900", color: COLORS.text, marginTop: 4 }}>{formatMinutesLabel(reportSummary.summary.netMinutes)}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <View style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: PALETTE.border, backgroundColor: COLORS.white, paddingVertical: 10, paddingHorizontal: 12 }}>
                  <Text style={{ fontSize: 11, color: COLORS.neutral }}>Asistencia</Text>
                  <Text style={{ fontSize: 15, fontWeight: "900", color: COLORS.text, marginTop: 4 }}>{formatPercent(reportSummary.summary.attendanceRate)}</Text>
                </View>
                <View style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: PALETTE.border, backgroundColor: COLORS.white, paddingVertical: 10, paddingHorizontal: 12 }}>
                  <Text style={{ fontSize: 11, color: COLORS.neutral }}>Puntualidad</Text>
                  <Text style={{ fontSize: 15, fontWeight: "900", color: COLORS.text, marginTop: 4 }}>{formatPercent(reportSummary.summary.punctualityRate)}</Text>
                </View>
              </View>
              {reportSummary.topEmployees.length > 0 ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.text }}>Trabajadores con más incidencias</Text>
                  <View style={{ marginTop: 8, gap: 6 }}>
                    {reportSummary.topEmployees.slice(0, 3).map((item) => (
                      <View key={item.employeeName} style={{ borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: PALETTE.border, paddingVertical: 10, paddingHorizontal: 12 }}>
                        <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.text }}>{item.employeeName}</Text>
                        <Text style={{ fontSize: 11, color: COLORS.neutral, marginTop: 4 }}>{item.incidentCount} incidencias · {item.lateCount} tardanzas · {item.noShowCount} no show · {item.openCount} abiertos</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {reportSummary.incidents.length > 0 ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.text }}>Alertas recientes</Text>
                  <View style={{ marginTop: 8, gap: 6 }}>
                    {reportSummary.incidents.slice(0, 3).map((item, index) => (
                      <View key={`${item.category}-${item.employeeName}-${index}`} style={{ borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: PALETTE.border, paddingVertical: 10, paddingHorizontal: 12 }}>
                        <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.text }}>{item.category} · {item.employeeName}</Text>
                        <Text style={{ fontSize: 11, color: COLORS.neutral, marginTop: 4 }}>{item.detail}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : reportSummaryError ? (
            <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 10 }}>{reportSummaryError}</Text>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
          <TouchableOpacity onPress={handleDownloadReport} disabled={isExporting} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, backgroundColor: COLORS.accent, opacity: isExporting ? 0.6 : 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "white", textAlign: "center" }}>Descargar Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleEmailReport} disabled={isExporting} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, backgroundColor: PALETTE.porcelain2, borderWidth: 1, borderColor: PALETTE.border, opacity: isExporting ? 0.6 : 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: PALETTE.text, textAlign: "center" }}>Enviar por correo</Text>
          </TouchableOpacity>
        </View>
        {isExporting ? <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 10 }}>Preparando archivo...</Text> : null}
      </View>
    </>
  );
}
