import { useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { COLORS } from "@/constants/colors";
import { CONTENT_HORIZONTAL_PADDING, CONTENT_MAX_WIDTH } from "@/constants/layout";
import { useAuth } from "@/contexts/auth-context";
import { useRoleCapabilities } from "@/hooks/use-role-capabilities";
import {
  CreateShiftModal,
} from "@/components/shifts/CreateShiftModal";
import {
  EditShiftModal,
} from "@/components/shifts/EditShiftModal";
import { ManagerShiftDaySection } from "@/components/shifts/ManagerShiftDaySection";
import { PersonalShiftListSection } from "@/components/shifts/PersonalShiftListSection";
import { ShiftsHeroCard } from "@/components/shifts/ShiftsHeroCard";
import { WeeklyShiftsSection } from "@/components/shifts/WeeklyShiftsSection";
import { useShiftsData } from "@/components/shifts/use-shifts-data";

const MANAGEMENT_ROLES = new Set(["propietario", "gerente_general", "gerente"]);

export default function ShiftsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, employee } = useAuth();

  const { has: hasCapability, loaded: capabilitiesLoaded } = useRoleCapabilities(
    employee?.role ?? null,
  );
  const canManageShifts = useMemo(() => {
    if (capabilitiesLoaded) return hasCapability("shift.create");
    return Boolean(employee?.role && MANAGEMENT_ROLES.has(employee.role));
  }, [capabilitiesLoaded, hasCapability, employee?.role]);
  const canViewSiteWeek = Boolean(employee?.siteId);
  const {
    rows,
    isLoading,
    isRefreshing,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    editingShift,
    managerEmployees,
    managerSites,
    managerRowsByDay,
    expandedManagerDays,
    updatingShiftId,
    nextShift,
    upcomingRows,
    recentRows,
    personalWeek,
    managerWeek,
    openEditShift,
    closeEditModal,
    onEditSuccess,
    onRefresh,
    handleConfirmShift,
    handleCancelShift,
    toggleManagerDay,
  } = useShiftsData({
    userId: user?.id,
    employeeRole: employee?.role,
    employeeSiteId: employee?.siteId,
    canManageShifts,
    canViewSiteWeek,
  });

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home");
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.porcelain }}
      contentContainerStyle={{
        paddingTop: insets.top + 18,
        paddingBottom: insets.bottom + 28,
        paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
        alignItems: "center",
      }}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
      }
    >
      <View style={{ width: "100%", maxWidth: CONTENT_MAX_WIDTH }}>
        <TouchableOpacity
          onPress={handleBack}
          style={{
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingVertical: 8,
          }}
        >
          <Ionicons name="chevron-back" size={18} color={COLORS.text} />
          <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.text }}>
            Volver
          </Text>
        </TouchableOpacity>

        <ShiftsHeroCard
          canManageShifts={canManageShifts}
          nextShift={nextShift}
          upcomingCount={upcomingRows.length}
          onCreateShift={() => setCreateModalVisible(true)}
        />

        {isLoading ? (
          <View
            style={{
              marginTop: 18,
              borderRadius: 20,
              padding: 24,
              alignItems: "center",
              backgroundColor: COLORS.white,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <ActivityIndicator color={COLORS.accent} />
            <Text style={{ fontSize: 13, color: COLORS.neutral, marginTop: 12 }}>
              Cargando turnos...
            </Text>
          </View>
        ) : null}

        {!isLoading ? (
          <WeeklyShiftsSection
            title="Esta semana"
            subtitle="Una vista simple de lunes a domingo para entender rápido tus turnos publicados."
            days={personalWeek}
            mode="personal"
          />
        ) : null}

        {!isLoading && canViewSiteWeek ? (
          <WeeklyShiftsSection
            title={canManageShifts ? "Semana de la sede" : "Tu sede esta semana"}
            subtitle={
              canManageShifts
                ? "Resumen semanal del equipo para saber quién trabaja cada día y con quién coincide cada turno."
                : "Vista rápida del equipo publicado para saber con quién te toca cada día."
            }
            days={managerWeek}
            mode="site"
          />
        ) : null}

        {!isLoading && rows.length === 0 ? (
          <View
            style={{
              marginTop: 18,
              borderRadius: 20,
              padding: 20,
              backgroundColor: COLORS.white,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text }}>
              No hay turnos cargados
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.neutral, marginTop: 8, lineHeight: 19 }}>
              Cuando el gerente publique la programación, aparecerá aquí con fecha, sede y horario.
            </Text>
          </View>
        ) : null}

        {!isLoading ? <PersonalShiftListSection title="Próximos turnos" rows={upcomingRows} /> : null}

        {!isLoading && canManageShifts ? (
          <ManagerShiftDaySection
            dayGroups={managerRowsByDay}
            expandedManagerDays={expandedManagerDays}
            updatingShiftId={updatingShiftId}
            onToggleDay={toggleManagerDay}
            onEditShift={openEditShift}
            onConfirmShift={handleConfirmShift}
            onCancelShift={handleCancelShift}
          />
        ) : null}

        {!isLoading ? (
          <PersonalShiftListSection title="Recientes" rows={recentRows.slice(0, 8)} />
        ) : null}
      </View>

      <CreateShiftModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={onEditSuccess}
        employees={managerEmployees}
        sites={managerSites}
        currentUserId={user?.id ?? ""}
      />

      <EditShiftModal
        visible={editModalVisible}
        onClose={closeEditModal}
        onSuccess={onEditSuccess}
        shift={editingShift}
        employees={managerEmployees}
        sites={managerSites}
        currentUserId={user?.id ?? ""}
      />
    </ScrollView>
  );
}
