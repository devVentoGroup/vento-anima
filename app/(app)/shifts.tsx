import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { COLORS } from "@/constants/colors";
import { CONTENT_HORIZONTAL_PADDING, CONTENT_MAX_WIDTH } from "@/constants/layout";
import { useAuth } from "@/contexts/auth-context";
import { useRoleCapabilities } from "@/hooks/use-role-capabilities";
import { supabase } from "@/lib/supabase";
import {
  CreateShiftModal,
  type EmployeeOption,
  type SiteOption,
} from "@/components/shifts/CreateShiftModal";
import {
  EditShiftModal,
  type ShiftForEdit,
} from "@/components/shifts/EditShiftModal";
import {
  formatShiftDateLabel,
  formatShiftMinutes,
  formatShiftShortDate,
  getShiftDurationMinutes,
  getShiftRangeLabel,
  getShiftSiteName,
  getShiftStatusMeta,
  isUpcomingShift,
  type ShiftRow,
} from "@/components/shifts/utils";

function getDateOffset(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getShiftSortValue(shift: Pick<ShiftRow, "shift_date" | "start_time">) {
  return new Date(`${shift.shift_date}T${shift.start_time}`).getTime();
}

type ManagerShiftRow = ShiftRow & {
  employee_id: string;
  published_at?: string | null;
  employees?: { full_name: string | null } | { full_name: string | null }[];
};

function getEmployeeName(row: ManagerShiftRow): string {
  const e = row.employees;
  if (!e) return "Empleado";
  const name = Array.isArray(e) ? e[0]?.full_name : e?.full_name;
  return name ?? "Empleado";
}

const MANAGEMENT_ROLES = new Set(["propietario", "gerente_general", "gerente"]);

export default function ShiftsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, employee } = useAuth();
  const [rows, setRows] = useState<ShiftRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftForEdit | null>(null);
  const [managerEmployees, setManagerEmployees] = useState<EmployeeOption[]>([]);
  const [managerSites, setManagerSites] = useState<SiteOption[]>([]);
  const [managerRows, setManagerRows] = useState<ManagerShiftRow[]>([]);

  const { has: hasCapability, loaded: capabilitiesLoaded } = useRoleCapabilities(
    employee?.role ?? null,
  );
  const canManageShifts = useMemo(() => {
    if (capabilitiesLoaded) return hasCapability("shift.create");
    return Boolean(employee?.role && MANAGEMENT_ROLES.has(employee.role));
  }, [capabilitiesLoaded, hasCapability, employee?.role]);

  const managerSiteId = useMemo(() => {
    if (!canManageShifts) return null;
    return employee?.siteId ?? null;
  }, [canManageShifts, employee?.siteId]);

  const loadManagerOptions = useCallback(async () => {
    if (!user || !canManageShifts) return;
    try {
      let sitesQuery = supabase
        .from("sites")
        .select("id, name")
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (employee?.role === "gerente" && managerSiteId) {
        sitesQuery = sitesQuery.eq("id", managerSiteId);
      }
      const { data: sitesData } = await sitesQuery;
      setManagerSites((sitesData as SiteOption[]) ?? []);

      let empQuery = supabase
        .from("employees")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      if (employee?.role === "gerente" && managerSiteId) {
        empQuery = empQuery.eq("site_id", managerSiteId);
      }
      const { data: empData } = await empQuery;
      setManagerEmployees((empData as EmployeeOption[]) ?? []);
    } catch (e) {
      console.error("[SHIFTS] loadManagerOptions error:", e);
    }
  }, [user, canManageShifts, employee?.role, managerSiteId]);

  useEffect(() => {
    if ((createModalVisible || editModalVisible) && canManageShifts) {
      void loadManagerOptions();
    }
  }, [createModalVisible, editModalVisible, canManageShifts, loadManagerOptions]);

  const loadManagedShifts = useCallback(async () => {
    if (!user || !canManageShifts) return;
    try {
      let query = supabase
        .from("employee_shifts")
        .select(
          "id, employee_id, shift_date, start_time, end_time, break_minutes, notes, status, site_id, sites(name), published_at, employees(full_name)",
        )
        .gte("shift_date", getDateOffset(-7))
        .lte("shift_date", getDateOffset(30))
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (employee?.role === "gerente" && managerSiteId) {
        query = query.eq("site_id", managerSiteId);
      }
      const { data, error } = await query;
      if (error) throw error;
      setManagerRows((data ?? []) as ManagerShiftRow[]);
    } catch (e) {
      console.error("[SHIFTS] loadManagedShifts error:", e);
      setManagerRows([]);
    }
  }, [user, canManageShifts, employee?.role, managerSiteId]);

  const loadShifts = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("employee_shifts")
        .select(
          "id, shift_date, start_time, end_time, break_minutes, notes, status, site_id, sites(name)",
        )
        .eq("employee_id", user.id)
        .not("published_at", "is", null)
        .gte("shift_date", getDateOffset(-7))
        .lte("shift_date", getDateOffset(30))
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setRows(((data ?? []) as ShiftRow[]).slice());
    } catch (error) {
      console.error("[SHIFTS] Error loading shifts:", error);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadShifts();
      if (canManageShifts) void loadManagedShifts();
    }, [loadShifts, canManageShifts, loadManagedShifts]),
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadShifts();
      if (canManageShifts) await loadManagedShifts();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadShifts, canManageShifts, loadManagedShifts]);

  const openEditShift = useCallback((row: ManagerShiftRow) => {
    setEditingShift({
      id: row.id,
      employee_id: row.employee_id,
      site_id: row.site_id,
      shift_date: row.shift_date,
      start_time: row.start_time,
      end_time: row.end_time,
      break_minutes: row.break_minutes ?? 0,
      notes: row.notes,
      published_at: row.published_at ?? null,
    });
    setEditModalVisible(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditModalVisible(false);
    setEditingShift(null);
  }, []);

  const onEditSuccess = useCallback(() => {
    void loadShifts();
    void loadManagedShifts();
  }, [loadShifts, loadManagedShifts]);

  const [updatingShiftId, setUpdatingShiftId] = useState<string | null>(null);

  const updateShiftStatus = useCallback(
    async (shiftId: string, status: "confirmed" | "cancelled") => {
      setUpdatingShiftId(shiftId);
      try {
        const { error } = await supabase
          .from("employee_shifts")
          .update({ status })
          .eq("id", shiftId);
        if (error) throw error;
        await loadShifts();
        await loadManagedShifts();
      } catch (e) {
        console.error("[SHIFTS] updateShiftStatus error:", e);
        Alert.alert(
          "Error",
          status === "cancelled" ? "No se pudo cancelar el turno." : "No se pudo confirmar el turno.",
        );
      } finally {
        setUpdatingShiftId(null);
      }
    },
    [loadShifts, loadManagedShifts],
  );

  const handleConfirmShift = useCallback(
    (row: ManagerShiftRow) => {
      if (row.status !== "scheduled") return;
      void updateShiftStatus(row.id, "confirmed");
    },
    [updateShiftStatus],
  );

  const handleCancelShift = useCallback(
    (row: ManagerShiftRow) => {
      if (row.status !== "scheduled" && row.status !== "confirmed") return;
      Alert.alert(
        "Cancelar turno",
        "¿Seguro que quieres cancelar este turno? El empleado ya no lo verá como programado.",
        [
          { text: "No", style: "cancel" },
          { text: "Sí, cancelar", style: "destructive", onPress: () => void updateShiftStatus(row.id, "cancelled") },
        ],
      );
    },
    [updateShiftStatus],
  );

  const upcomingRows = useMemo(() => {
    const now = new Date();
    return rows.filter((row) => isUpcomingShift(row, now));
  }, [rows]);

  const recentRows = useMemo(() => {
    const now = new Date();
    return [...rows]
      .filter((row) => !isUpcomingShift(row, now))
      .sort((a, b) => getShiftSortValue(b) - getShiftSortValue(a));
  }, [rows]);

  const nextShift = upcomingRows[0] ?? null;

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
              const durationLabel = formatShiftMinutes(getShiftDurationMinutes(row));
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

                  <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: COLORS.neutral }}>Horario</Text>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: COLORS.text, marginTop: 4 }}>
                        {getShiftRangeLabel(row)}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: COLORS.neutral }}>Jornada neta</Text>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: COLORS.text, marginTop: 4 }}>
                        {durationLabel}
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

        {canManageShifts && managerRows.length > 0 ? (
          <View style={{ marginTop: 22 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: COLORS.text, marginBottom: 12 }}>
              Turnos del equipo
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.neutral, marginBottom: 12 }}>
              Turnos que puedes editar (tu sede o todos si eres propietario/gerente general).
            </Text>
            {managerRows.map((row) => {
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
                        {getEmployeeName(row)} · {formatShiftDateLabel(row.shift_date)}
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
                    <View>
                      <Text style={{ fontSize: 12, color: COLORS.neutral }}>Horario</Text>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: COLORS.text, marginTop: 4 }}>
                        {getShiftRangeLabel(row)}
                      </Text>
                    </View>
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
                      {(row.status === "scheduled" || row.status === "confirmed") ? (
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
                      ) : null}
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
                      {(row.status === "scheduled" || row.status === "confirmed") ? (
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
                      ) : null}
                    </View>
                  </View>
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
