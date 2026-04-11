import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as MailComposer from "expo-mail-composer";
import type { DateData } from "react-native-calendars";
import { COLORS } from "@/constants/colors";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "expo-router";
import { useAttendanceContext } from "@/contexts/attendance-context";
import { DateRangeModal } from "@/components/home/DateRangeModal";
import { AttendanceDiagnosticsCard } from "@/components/home/AttendanceDiagnosticsCard";
import { AttendanceActionErrorCard } from "@/components/home/AttendanceActionErrorCard";
import { AttendanceActionCard } from "@/components/home/AttendanceActionCard";
import { GeofenceStatusCard } from "@/components/home/GeofenceStatusCard";
import { HomeHeroCard } from "@/components/home/HomeHeroCard";
import { NextShiftCard } from "@/components/home/NextShiftCard";
import { NotificationsPromptCard } from "@/components/home/NotificationsPromptCard";
import { OfflineStatusCard } from "@/components/home/OfflineStatusCard";
import { PendingSyncCard } from "@/components/home/PendingSyncCard";
import { QuickActionsSection } from "@/components/home/QuickActionsSection";
import { ReportFilterModal } from "@/components/home/ReportFilterModal";
import type {
  ReportEmployeeOption,
  ReportSiteOption,
  ReportSummaryResponse,
} from "@/components/home/report-types";
import { ShiftPreviewBanner } from "@/components/home/ShiftPreviewBanner";
import { SitePickerModal } from "@/components/home/SitePickerModal";
import { TodaySummaryCard } from "@/components/home/TodaySummaryCard";
import { useHomeAttendanceActions } from "@/components/home/use-home-attendance-actions";
import { UserMenuModal } from "@/components/home/UserMenuModal";
import { useHomeAttendanceView } from "@/components/home/use-home-attendance-view";
import { WalletCard } from "@/components/home/WalletCard";
import { useHomeNotifications } from "@/components/home/use-home-notifications";
import { useHomeNavigation } from "@/components/home/use-home-navigation";
import { useHomeReports } from "@/components/home/use-home-reports";
import { useHomeScreenLifecycle } from "@/components/home/use-home-screen-lifecycle";
import { useHomeWallet } from "@/components/home/use-home-wallet";
import { useNextScheduledShift } from "@/components/home/use-next-scheduled-shift";
import {
  formatShiftMinutes,
  getShiftDurationMinutes,
  getShiftStatusMeta,
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
  const [isSitePickerOpen, setIsSitePickerOpen] = useState(false);
  const [opsSectionY, setOpsSectionY] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const {
    nextScheduledShift,
    todayShift,
    isLoadingNextShift,
    loadNextScheduledShift,
  } = useNextScheduledShift(user?.id);
  const {
    walletEligibility,
    isLoadingWalletEligibility,
    isAddingCarnetToWallet,
    handleAddCarnetToWallet,
  } = useHomeWallet({
    userId: user?.id,
    sessionAccessToken: session?.access_token,
  });

  const showAttendanceDiagnostics =
    process.env.EXPO_PUBLIC_SHOW_ATTENDANCE_DIAGNOSTICS === "1";
  const {
    isRefreshing,
    actionError,
    setActionError,
    isCheckActionLocked,
    recentQueuedFeedback,
    handleRefresh,
    handleCheck,
    handleToggleBreak,
  } = useHomeAttendanceActions({
    userId: user?.id,
    isLoading,
    isGeoChecking: geofenceState.status === "checking",
    isCheckedIn: attendanceState.status === "checked_in",
    requiresSelection: geofenceState.requiresSelection,
    isOnBreak: attendanceState.isOnBreak,
    loadTodayAttendance,
    refreshGeofence,
    checkIn,
    checkOut,
    startBreak,
    endBreak,
    onRequireSiteSelection: () => setIsSitePickerOpen(true),
  });
  const {
    handleSignOut,
    goToHistory,
    goToShifts,
    goToDocuments,
    goToAnnouncements,
    goToSupport,
    handleSelectSite,
  } = useHomeNavigation({
    router,
    signOut,
    setIsUserMenuOpen,
    setIsSitePickerOpen,
    setActionError,
    selectSiteForCheckIn,
  });

  const {
    isCheckedIn,
    isGeoChecking,
    canRegister,
    ctaTextColor,
    ctaSubTextOpacity,
    hasPendingAny,
    isSyncingAny,
    ctaPrimaryLabel,
    ctaSecondaryLabel,
    headerOpsPill,
    showHeaderOpsPill,
    statusUI,
    geofenceUI,
    geofencePill,
    latchedRemainingMs,
    hoursLabel,
    breakMinutesLabel,
    lastCheckIn,
    lastCheckOut,
  } = useHomeAttendanceView({
    attendanceState,
    geofenceState,
    isLoading,
    isCheckActionLocked,
    pendingAttendanceCount,
    pendingAttendanceSyncingCount,
    pendingBreakCount,
    pendingBreakSyncingCount,
    attendanceUxState: recentQueuedFeedback ? "queued" : attendanceUxState,
    attendanceUxMessage,
  });

  const handleOpsPillPress = useCallback(() => {
    const targetY = Math.max(0, opsSectionY - 12);
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
  }, [opsSectionY]);

  const { initialLoadDone } = useHomeScreenLifecycle({
    userId: user?.id,
    authIsLoading,
    employee,
    employeeSites,
    hasPendingSiteChanges,
    attendanceStatus: attendanceState.status,
    lastCheckIn: attendanceState.lastCheckIn,
    isCheckedIn,
    geofenceStatus: geofenceState.status,
    geofenceUpdatedAt: geofenceState.updatedAt,
    loadTodayAttendance,
    refreshGeofence,
    loadNextScheduledShift,
    refreshEmployee,
    consumePendingSiteChanges,
    startRealtimeGeofence,
    stopRealtimeGeofence,
    setActionError,
  });

  useEffect(() => {
    if (geofenceState.requiresSelection) {
      setIsSitePickerOpen(true);
    }
  }, [geofenceState.requiresSelection]);

  const {
    notificationPermissionStatus,
    notificationPromptLoading,
    requestNotificationPermissionOrOpenSettings,
  } = useHomeNotifications({
    userId: user?.id,
    authIsLoading,
    initialLoadDone,
    dependencyKey: `${employee?.id ?? ""}:${employeeSites.length}`,
    expoProjectId: EXPO_PROJECT_ID,
  });

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
  const geofenceInfoMessage = geofenceState.isLatchedReady
    ? geofenceState.message ||
      "Validación temporal activa. Puedes registrar mientras se restablece la señal."
    : isOffline
      ? "Sin conexión o red inestable: el registro puede fallar."
      : geofenceState.status === "ready"
        ? "Ubicación verificada. Ya tienes permiso para registrar."
        : geofenceState.message || "Verifica tu ubicación para poder registrar.";

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
  const {
    isExporting,
    isDateModalOpen,
    setIsDateModalOpen,
    reportStartDate,
    reportEndDate,
    draftStartDate,
    draftEndDate,
    calendarMonth,
    setCalendarMonth,
    reportEmployees,
    reportSites,
    reportSiteId,
    setReportSiteId,
    reportEmployeeId,
    setReportEmployeeId,
    isLoadingReportEmployees,
    isLoadingReportSites,
    isReportSiteModalOpen,
    setIsReportSiteModalOpen,
    isReportEmployeeModalOpen,
    setIsReportEmployeeModalOpen,
    reportSummary,
    isLoadingReportSummary,
    reportSummaryError,
    filteredReportEmployees,
    selectedReportEmployee,
    selectedReportSite,
    reportTitle,
    reportScopeLabel,
    reportRangeLabel,
    formatShortDate,
    formatMonthLabel,
    toDateKey,
    markedDates,
    handleDownloadReport,
    handleEmailReport,
    handleSelectRangeDay,
    applyDraftRange,
    shiftCalendarMonth,
    loadReportSummary,
  } = useHomeReports({
    isGlobalReportRole,
    canViewReports,
    canManagerTeamReports,
    canPersonalReports,
    selectedSiteName: selectedSite?.siteName,
    userId: user?.id,
    userEmail: user?.email,
    sessionAccessToken: session?.access_token,
  });

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
        <HomeHeroCard
          cardStyle={UI.card}
          pillStyle={UI.pill}
          todayLabel={todayLabel}
          displayName={displayName}
          avatarUrl={employee?.avatarUrl}
          avatarInitial={avatarInitial}
          statusUI={statusUI}
          geofenceUI={geofenceUI}
          geofencePill={geofencePill}
          isOffline={isOffline}
          hasPendingAny={hasPendingAny}
          isSyncingAny={isSyncingAny}
          pendingCount={pendingAttendanceCount + pendingBreakCount}
          showHeaderOpsPill={showHeaderOpsPill}
          headerOpsPill={headerOpsPill}
          onOpenUserMenu={() => setIsUserMenuOpen(true)}
          onPressOpsPill={handleOpsPillPress}
        />
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
          <NotificationsPromptCard
            isLoading={notificationPromptLoading}
            onPress={requestNotificationPermissionOrOpenSettings}
          />
        ) : null}

        <ShiftPreviewBanner
          todayShift={todayShift}
          nextScheduledShift={nextScheduledShift}
          onPress={goToShifts}
        />

        {isOffline ? <OfflineStatusCard onRetry={handleRefresh} /> : null}

        <PendingSyncCard
          pendingAttendanceCount={pendingAttendanceCount}
          pendingAttendanceFailedCount={pendingAttendanceFailedCount}
          pendingAttendanceConflictCount={pendingAttendanceConflictCount}
          pendingAttendanceOldestCreatedAt={pendingAttendanceOldestCreatedAt}
          pendingAttendanceNextRetryAt={pendingAttendanceNextRetryAt}
          pendingAttendanceLastError={pendingAttendanceLastError}
          pendingBreakCount={pendingBreakCount}
          pendingBreakFailedCount={pendingBreakFailedCount}
          formatClock={formatClock}
          formatRetryClock={formatRetryClock}
          onSyncNow={() => {
            void syncPendingAttendanceQueue({ force: true });
            void syncPendingBreakQueue({ force: true });
          }}
        />

        {actionError ? <AttendanceActionErrorCard message={actionError} /> : null}

        <AttendanceDiagnosticsCard
          show={showAttendanceDiagnostics}
          diagnostics={attendanceDiagnostics}
          formatLatency={formatLatency}
        />

        
        <TodaySummaryCard
          cardStyle={UI.card}
          cardTintStyle={UI.cardTint}
          surfaceStyle={UI.surface2}
          hoursLabel={hoursLabel}
          statusHint={statusUI.hint}
          breakMinutesLabel={breakMinutesLabel}
          isOnBreak={attendanceState.isOnBreak}
          lastCheckOutSource={attendanceState.lastCheckOutSource}
          lastCheckOutRaw={attendanceState.lastCheckOut}
          lastCheckIn={lastCheckIn}
          lastCheckOut={lastCheckOut}
          formatClock={formatClock}
        />

        <GeofenceStatusCard
          cardStyle={UI.card}
          cardTintStyle={UI.cardTint}
          pillStyle={UI.pill}
          surfaceStyle={UI.surface2}
          buttonGhostStyle={UI.btnGhostPink}
          geofencePill={geofencePill}
          geofenceLabel={geofenceUI.label}
          activeSiteName={activeSiteName}
          isCheckedIn={isCheckedIn}
          isLoading={isLoading}
          isGeoChecking={isGeoChecking}
          isCheckActionLocked={isCheckActionLocked}
          canChooseSite={canChooseSite}
          distanceMeters={geofenceState.distanceMeters}
          accuracyMeters={geofenceState.accuracyMeters}
          effectiveRadiusMeters={geofenceState.effectiveRadiusMeters}
          infoMessage={
            geofenceState.isLatchedReady && latchedRemainingMs != null
              ? `${geofenceInfoMessage} Ventana temporal activa: ${formatRemainingShort(latchedRemainingMs)} restantes.`
              : geofenceInfoMessage
          }
          onRefresh={() => {
            void refreshGeofence({ force: true, source: "user" });
          }}
          onSelectSite={() => setIsSitePickerOpen(true)}
        />

        <AttendanceActionCard
          cardStyle={UI.card}
          cardTintStyle={UI.cardTint}
          canRegister={canRegister}
          isLoading={isLoading}
          isGeoChecking={isGeoChecking}
          isCheckActionLocked={isCheckActionLocked}
          ctaTextColor={ctaTextColor}
          ctaPrimaryLabel={ctaPrimaryLabel}
          ctaSecondaryLabel={ctaSecondaryLabel}
          isCheckedIn={isCheckedIn}
          isOnBreak={attendanceState.isOnBreak}
          onCheck={handleCheck}
          onToggleBreak={handleToggleBreak}
        />

        {user ? (
          <WalletCard
            eligibility={walletEligibility}
            isLoading={isLoadingWalletEligibility}
            isAdding={isAddingCarnetToWallet}
            onAdd={handleAddCarnetToWallet}
          />
        ) : null}

        <NextShiftCard
          nextScheduledShift={nextScheduledShift}
          todayShift={todayShift}
          isLoading={isLoadingNextShift}
          isCheckedIn={isCheckedIn}
          currentSiteId={attendanceState.currentSiteId}
          nextShiftDurationLabel={nextShiftDurationLabel}
          nextShiftStatusMeta={nextShiftStatusMeta}
          onPress={goToShifts}
        />

        <QuickActionsSection
          onHistoryPress={goToHistory}
          onAnnouncementsPress={goToAnnouncements}
          onSupportPress={goToSupport}
          onDocumentsPress={goToDocuments}
        />

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}
