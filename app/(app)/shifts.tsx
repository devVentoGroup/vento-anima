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
import {
  formatShiftDateLabel,
  formatShiftShortDate,
  getShiftRangeLabel,
  getShiftSiteName,
  getShiftStatusMeta,
  isUpcomingShift,
} from "@/components/shifts/utils";
import { getEmployeeName, useShiftsData } from "@/components/shifts/use-shifts-data";

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
    openEditShift,
    closeEditModal,
    onEditSuccess,
    onRefresh,
    handleConfirmShift,
    handleCancelShift,
    toggleManagerDay,
    loadShifts,
  } = useShiftsData({
    userId: user?.id,
    employeeRole: employee?.role,
    employeeSiteId: employee?.siteId,
    canManageShifts,
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

        <View
          style={{
            marginTop: 8,
            borderRadius: 24,
            padding: 20,
            backgroundColor: COLORS.white,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.accent }}>
            MIS TURNOS
          </Text>
          <Text
            style={{
              fontSize: 28,
              fontWeight: "900",
              color: COLORS.text,
              marginTop: 8,
            }}
          >
            Tu horario programado
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.neutral, marginTop: 8, lineHeight: 19 }}>
            Vista personal de turnos de los últimos 7 días y los próximos 30. Aquí el empleado ve
            qué le asignaron, en qué sede y con qué estado.
          </Text>

          {canManageShifts ? (
            <TouchableOpacity
              onPress={() => setCreateModalVisible(true)}
              style={{
                marginTop: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.accent,
                backgroundColor: "rgba(226, 0, 106, 0.08)",
              }}
            >
              <Ionicons name="add-circle-outline" size={20} color={COLORS.accent} />
              <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.accent }}>Crear turno</Text>
            </TouchableOpacity>
          ) : null}

          <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
            <View
              style={{
                flex: 1,
                borderRadius: 16,
                padding: 14,
                backgroundColor: COLORS.porcelainAlt,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text style={{ fontSize: 12, color: COLORS.neutral }}>Próximo turno</Text>
              <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text, marginTop: 8 }}>
                {nextShift ? formatShiftShortDate(nextShift.shift_date) : "Sin asignar"}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
                {nextShift ? getShiftRangeLabel(nextShift) : "Todavía no tienes turnos próximos"}
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                borderRadius: 16,
                padding: 14,
                backgroundColor: COLORS.porcelainAlt,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text style={{ fontSize: 12, color: COLORS.neutral }}>Turnos próximos</Text>
              <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text, marginTop: 8 }}>
                {upcomingRows.length}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
                Programados o confirmados
              </Text>
            </View>
          </View>
        </View>

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

        {!isLoading && nextShift ? (
          <View
            style={{
              marginTop: 18,
              borderRadius: 20,
              padding: 18,
              backgroundColor: "#FFF1F7",
              borderWidth: 1,
              borderColor: "#FBCFE8",
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "800", color: COLORS.accent }}>
              PRÓXIMO TURNO
            </Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: COLORS.text, marginTop: 8 }}>
              {formatShiftDateLabel(nextShift.shift_date)}
            </Text>
            <Text style={{ fontSize: 15, color: COLORS.text, marginTop: 8 }}>
              {getShiftRangeLabel(nextShift)} · {getShiftSiteName(nextShift.sites)}
            </Text>
          </View>
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

        {!isLoading && upcomingRows.length > 0 ? (
          <View style={{ marginTop: 22 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.text, marginBottom: 12 }}>
              Próximos turnos
            </Text>
            {upcomingRows.map((row) => {
              const statusMeta = getShiftStatusMeta(row.status);
              return (
                <View
                  key={row.id}
                  style={{
                    borderRadius: 18,
                    padding: 16,
                    marginBottom: 12,
                    backgroundColor: COLORS.white,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.text }}>
                        {formatShiftDateLabel(row.shift_date)}
                      </Text>
                      <Text style={{ fontSize: 13, color: COLORS.neutral, marginTop: 6 }}>
                        {getShiftSiteName(row.sites)}
                      </Text>
                    </View>

                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: statusMeta.bg,
                        borderWidth: 1,
                        borderColor: statusMeta.border,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "800", color: statusMeta.text }}>
                        {statusMeta.label}
                      </Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 14 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: COLORS.neutral }}>Horario</Text>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: COLORS.text, marginTop: 4 }}>
                        {getShiftRangeLabel(row)}
                      </Text>
                    </View>
                  </View>

                  <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 12 }}>
                    Descanso: {row.break_minutes ?? 0} min
                  </Text>

                  {row.notes ? (
                    <Text style={{ fontSize: 12, color: COLORS.text, marginTop: 8, lineHeight: 18 }}>
                      {row.notes}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {canManageShifts && managerRowsByDay.length > 0 ? (
          <View style={{ marginTop: 22 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.text, marginBottom: 12 }}>
              Turnos del equipo
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.neutral, marginBottom: 12 }}>
              Turnos que puedes editar (tu sede o todos si eres propietario/gerente general).
            </Text>
            {managerRowsByDay.map(({ shiftDate, rows: dayRows }) => {
              const isExpanded = expandedManagerDays[shiftDate] ?? true;
              const actionableCount = dayRows.filter((row) => isUpcomingShift(row)).length;
              return (
                <View
                  key={shiftDate}
                  style={{
                    borderRadius: 18,
                    marginBottom: 12,
                    backgroundColor: COLORS.white,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    overflow: "hidden",
                  }}
                >
                  <TouchableOpacity
                    onPress={() => toggleManagerDay(shiftDate)}
                    activeOpacity={0.86}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: COLORS.porcelainAlt,
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ fontSize: 15, fontWeight: "900", color: COLORS.text }}>
                        {formatShiftDateLabel(shiftDate)}
                      </Text>
                      <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
                        {dayRows.length} turnos · {actionableCount} con acciones disponibles
                      </Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={COLORS.neutral}
                    />
                  </TouchableOpacity>

                  {isExpanded ? (
                    <View style={{ padding: 12 }}>
                      {dayRows.map((row) => {
                        const statusMeta = getShiftStatusMeta(row.status);
                        const isFutureOrOpen = isUpcomingShift(row);
                        const canMutate = isFutureOrOpen && (row.status === "scheduled" || row.status === "confirmed");
                        return (
                          <View
                            key={row.id}
                            style={{
                              borderRadius: 14,
                              padding: 14,
                              marginBottom: 10,
                              backgroundColor: COLORS.white,
                              borderWidth: 1,
                              borderColor: COLORS.border,
                            }}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "flex-start",
                                justifyContent: "space-between",
                                gap: 10,
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, fontWeight: "800", color: COLORS.text }}>
                                  {getEmployeeName(row)}
                                </Text>
                                <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 5 }}>
                                  {getShiftSiteName(row.sites)}
                                </Text>
                                <Text style={{ fontSize: 13, color: COLORS.text, marginTop: 6, fontWeight: "700" }}>
                                  {getShiftRangeLabel(row)}
                                </Text>
                              </View>
                              <View
                                style={{
                                  borderRadius: 999,
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  backgroundColor: statusMeta.bg,
                                  borderWidth: 1,
                                  borderColor: statusMeta.border,
                                }}
                              >
                                <Text style={{ fontSize: 11, fontWeight: "800", color: statusMeta.text }}>
                                  {statusMeta.label}
                                </Text>
                              </View>
                            </View>

                            {canMutate ? (
                              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                                <TouchableOpacity
                                  onPress={() => openEditShift(row)}
                                  disabled={updatingShiftId === row.id}
                                  style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: COLORS.accent,
                                    backgroundColor: "rgba(226, 0, 106, 0.08)",
                                  }}
                                >
                                  <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.accent }}>Editar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => openEditShift(row)}
                                  disabled={updatingShiftId === row.id}
                                  style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: "#1D4ED8",
                                    backgroundColor: "#EFF6FF",
                                  }}
                                >
                                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#1D4ED8" }}>Reasignar</Text>
                                </TouchableOpacity>
                                {row.status === "scheduled" ? (
                                  <TouchableOpacity
                                    onPress={() => handleConfirmShift(row)}
                                    disabled={updatingShiftId === row.id}
                                    style={{
                                      paddingHorizontal: 14,
                                      paddingVertical: 8,
                                      borderRadius: 12,
                                      borderWidth: 1,
                                      borderColor: "#047857",
                                      backgroundColor: "#ECFDF3",
                                    }}
                                  >
                                    {updatingShiftId === row.id ? (
                                      <ActivityIndicator size="small" color="#047857" />
                                    ) : (
                                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#047857" }}>Confirmar</Text>
                                    )}
                                  </TouchableOpacity>
                                ) : null}
                                <TouchableOpacity
                                  onPress={() => handleCancelShift(row)}
                                  disabled={updatingShiftId === row.id}
                                  style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: "#B91C1C",
                                    backgroundColor: "rgba(254, 242, 242, 1)",
                                  }}
                                >
                                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#B91C1C" }}>Cancelar turno</Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 12 }}>
                                Turno finalizado o no editable.
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {!isLoading && recentRows.length > 0 ? (
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.text, marginBottom: 12 }}>
              Recientes
            </Text>
            {recentRows.slice(0, 8).map((row) => {
              const statusMeta = getShiftStatusMeta(row.status);
              return (
                <View
                  key={row.id}
                  style={{
                    borderRadius: 18,
                    padding: 16,
                    marginBottom: 12,
                    backgroundColor: COLORS.white,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: COLORS.text }}>
                        {formatShiftDateLabel(row.shift_date)}
                      </Text>
                      <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 6 }}>
                        {getShiftRangeLabel(row)} · {getShiftSiteName(row.sites)}
                      </Text>
                    </View>

                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        backgroundColor: statusMeta.bg,
                        borderWidth: 1,
                        borderColor: statusMeta.border,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "800", color: statusMeta.text }}>
                        {statusMeta.label}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      <CreateShiftModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={loadShifts}
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
