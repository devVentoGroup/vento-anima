import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";

type EmployeeRow = {
  id: string;
  full_name: string;
  alias: string | null;
  role: string;
  site_id: string | null;
  is_active: boolean | null;
  sites?: { id: string; name: string } | null;
};
type EmployeeRowDb = Omit<EmployeeRow, "sites"> & {
  sites?: { id: string; name: string } | { id: string; name: string }[] | null;
};

type SiteRow = {
  id: string;
  name: string;
  site_type: string | null;
  type: string | null;
  is_active: boolean | null;
};

type RoleRow = {
  code: string;
  name: string;
  is_active: boolean | null;
};

type EmployeeSiteRow = {
  site_id: string;
  is_primary: boolean | null;
  is_active: boolean | null;
  sites?: { id: string; name: string } | null;
};
type EmployeeSiteRowDb = Omit<EmployeeSiteRow, "sites"> & {
  sites?: { id: string; name: string } | { id: string; name: string }[] | null;
};

type EditFormState = {
  fullName: string;
  alias: string;
  role: string;
  isActive: boolean;
  primarySiteId: string | null;
  siteIds: string[];
};

type InviteFormState = {
  email: string;
  fullName: string;
  role: string;
  siteId: string | null;
};

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

const OWNER_ROLE = "propietario";
const GLOBAL_MANAGER_ROLE = "gerente_general";
const MANAGER_ROLE = "gerente";
const MANAGEMENT_ROLES = new Set([OWNER_ROLE, GLOBAL_MANAGER_ROLE, MANAGER_ROLE]);

export default function TeamScreen() {
  const insets = useSafeAreaInsets();
  const { user, employee, selectedSiteId } = useAuth();
  const role = employee?.role ?? null;
  const isOwner = role === OWNER_ROLE;
  const isGlobalManager = role === GLOBAL_MANAGER_ROLE;
  const isManager = role === MANAGER_ROLE;
  const canViewTeam = role ? MANAGEMENT_ROLES.has(role) : false;
  const canManageTeam = canViewTeam;
  const canViewAllSites = isOwner || isGlobalManager;
  const canChangeSites = canViewAllSites;

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [search, setSearch] = useState("");
  const [siteFilterId, setSiteFilterId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [activePicker, setActivePicker] = useState<
    "editRole" | "editPrimary" | "editSites" | "inviteRole" | "inviteSite" | null
  >(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(
    null,
  );
  const [form, setForm] = useState<EditFormState>({
    fullName: "",
    alias: "",
    role: "",
    isActive: true,
    primarySiteId: null,
    siteIds: [],
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteFormState>({
    email: "",
    fullName: "",
    role: "",
    siteId: null,
  });

  const defaultFilter = useMemo(() => {
    if (canViewAllSites) return null;
    return employee?.siteId ?? selectedSiteId ?? null;
  }, [canViewAllSites, selectedSiteId, employee?.siteId]);

  useEffect(() => {
    setSiteFilterId(defaultFilter);
  }, [defaultFilter]);

  const managerSiteId = useMemo(() => {
    if (!isManager) return null;
    return employee?.siteId ?? selectedSiteId ?? null;
  }, [isManager, selectedSiteId, employee?.siteId]);

  const loadEmployees = useCallback(async () => {
    if (!user) return;
    if (isManager && !managerSiteId) {
      setEmployees([]);
      return;
    }
    setIsLoading(true);
    try {
      let query = supabase
        .from("employees")
        .select(
          `id, full_name, alias, role, site_id, is_active, sites:sites!employees_site_id_fkey (id, name)`,
        )
        .order("full_name", { ascending: true });

      if (isManager && managerSiteId) {
        query = query.eq("site_id", managerSiteId);
      }

      const { data, error } = await query;

      if (error) throw error;
      const normalized = ((data as EmployeeRowDb[]) ?? []).map((row) => ({
        ...row,
        sites: Array.isArray(row.sites) ? row.sites[0] ?? null : row.sites ?? null,
      }));
      setEmployees(normalized);
    } catch (err) {
      console.error("Employees load error:", err);
      Alert.alert("Equipo", "No se pudieron cargar los trabajadores.");
    } finally {
      setIsLoading(false);
    }
  }, [user, isManager, managerSiteId]);

  const loadSites = useCallback(async () => {
    if (!user) return;
    if (isManager && !managerSiteId) {
      setSites([]);
      return;
    }
    try {
      let query = supabase
        .from("sites")
        .select("id, name, site_type, type, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (isManager && managerSiteId) {
        query = query.eq("id", managerSiteId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSites((data as SiteRow[]) ?? []);
    } catch (err) {
      console.error("Sites load error:", err);
    }
  }, [user, isManager, managerSiteId]);

  const loadRoles = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("roles")
        .select("code, name, is_active")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      setRoles((data as RoleRow[]) ?? []);
    } catch (err) {
      console.error("Roles load error:", err);
    }
  }, [user]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadEmployees(), loadSites(), loadRoles()]);
  }, [loadEmployees, loadSites, loadRoles]);

  useFocusEffect(
    useCallback(() => {
      if (!canViewTeam) return;
      void loadAll();
    }, [loadAll, canViewTeam]),
  );
  const handleRefresh = async () => {
    if (!canViewTeam) return;
    setIsRefreshing(true);
    await loadAll();
    setIsRefreshing(false);
  };

  const roleLabel = useCallback(
    (code: string) => {
      const match = roles.find((item) => item.code === code);
      return match?.name ?? code;
    },
    [roles],
  );

  const formatName = (employeeRow: EmployeeRow) => {
    const base = employeeRow.full_name ?? "";
    if (!employeeRow.alias) return base;
    return `${base} (${employeeRow.alias})`;
  };

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((item) => {
      if (siteFilterId && item.site_id !== siteFilterId) return false;
      if (!query) return true;
      const name = `${item.full_name ?? ""} ${item.alias ?? ""}`.toLowerCase();
      const roleName = roleLabel(item.role).toLowerCase();
      return name.includes(query) || roleName.includes(query);
    });
  }, [employees, search, siteFilterId, roleLabel]);

  const canAssignRole = useCallback(
    (targetRole: string) => {
      if (isOwner) return true;
      if (isGlobalManager) {
        return targetRole !== OWNER_ROLE && targetRole !== GLOBAL_MANAGER_ROLE;
      }
      if (isManager) {
        return !MANAGEMENT_ROLES.has(targetRole);
      }
      return false;
    },
    [isOwner, isGlobalManager, isManager],
  );

  const startEdit = async (item: EmployeeRow) => {
    if (!canManageTeam) return;
    const isSelf = item.id === user?.id;
    if (!isOwner && item.role === OWNER_ROLE && !isSelf) {
      Alert.alert("Equipo", "Solo el propietario puede editar este rol.");
      return;
    }
    if (isManager) {
      if (!managerSiteId || item.site_id !== managerSiteId) {
        Alert.alert("Equipo", "Solo puedes editar trabajadores de tu sede.");
        return;
      }
      if (MANAGEMENT_ROLES.has(item.role) && !isSelf) {
        Alert.alert("Equipo", "No tienes permisos para editar este rol.");
        return;
      }
    }
    if (!canAssignRole(item.role) && !isSelf) {
      Alert.alert("Equipo", "No tienes permisos para editar este rol.");
      return;
    }
    setEditingEmployee(item);

    let selectedSiteIds: string[] = [];
    let primarySiteId = item.site_id ?? null;

    try {
      const { data, error } = await supabase
        .from("employee_sites")
        .select(
          "site_id, is_primary, is_active, sites:sites!employee_sites_site_id_fkey (id, name)",
        )
        .eq("employee_id", item.id);

      if (!error && data) {
        const normalized = ((data as EmployeeSiteRowDb[]) ?? []).map((row) => ({
          ...row,
          sites: Array.isArray(row.sites) ? row.sites[0] ?? null : row.sites ?? null,
        }))
        const activeSites = normalized.filter(
          (row) => row.is_active !== false,
        );
        selectedSiteIds = activeSites.map((row) => row.site_id);
        primarySiteId =
          activeSites.find((row) => row.is_primary)?.site_id ?? primarySiteId;
      }
    } catch (err) {
      console.error("Employee sites load error:", err);
    }

    if (primarySiteId && !selectedSiteIds.includes(primarySiteId)) {
      selectedSiteIds = [...selectedSiteIds, primarySiteId];
    }

    setForm({
      fullName: item.full_name ?? "",
      alias: item.alias ?? "",
      role: item.role ?? "",
      isActive: item.is_active ?? true,
      primarySiteId,
      siteIds: selectedSiteIds,
    });
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditingEmployee(null);
    setActivePicker(null);
    setPickerQuery("");
  };

  const toggleSiteSelection = (siteId: string) => {
    setForm((prev) => {
      const exists = prev.siteIds.includes(siteId);
      let nextIds = exists
        ? prev.siteIds.filter((id) => id !== siteId)
        : [...prev.siteIds, siteId];

      let nextPrimary = prev.primarySiteId;
      if (!nextIds.includes(nextPrimary ?? "")) {
        nextPrimary = nextIds[0] ?? null;
      }

      return { ...prev, siteIds: nextIds, primarySiteId: nextPrimary };
    });
  };

  const setPrimarySite = (siteId: string) => {
    setForm((prev) => {
      const nextIds = prev.siteIds.includes(siteId)
        ? prev.siteIds
        : [...prev.siteIds, siteId];
      return { ...prev, siteIds: nextIds, primarySiteId: siteId };
    });
  };

  const saveEmployeeSites = async (
    employeeId: string,
    siteIds: string[],
    primarySiteId: string,
  ) => {
    if (!canViewAllSites) return;

    const uniqueIds = Array.from(new Set(siteIds));
    const finalIds = uniqueIds.length ? uniqueIds : [primarySiteId];

    const { data: current, error: currentError } = await supabase
      .from("employee_sites")
      .select("site_id")
      .eq("employee_id", employeeId);

    if (currentError) throw currentError;

    const currentIds = (current ?? []).map((row) => row.site_id);
    const toRemove = currentIds.filter((id) => !finalIds.includes(id));

    if (toRemove.length) {
      const { error: deleteError } = await supabase
        .from("employee_sites")
        .delete()
        .eq("employee_id", employeeId)
        .in("site_id", toRemove);

      if (deleteError) throw deleteError;
    }

    const { error: clearPrimaryError } = await supabase
      .from("employee_sites")
      .update({ is_primary: false })
      .eq("employee_id", employeeId)
      .eq("is_primary", true)
      .neq("site_id", primarySiteId);

    if (clearPrimaryError) throw clearPrimaryError;

    const payload = finalIds.map((id) => ({
      employee_id: employeeId,
      site_id: id,
      is_primary: id === primarySiteId,
      is_active: true,
    }));

    if (payload.length) {
      const { error: upsertError } = await supabase
        .from("employee_sites")
        .upsert(payload, { onConflict: "employee_id,site_id" });

      if (upsertError) throw upsertError;
    }
  };

  const handleSave = async () => {
    if (!editingEmployee) return;
    const isSelf = editingEmployee.id === user?.id;
    if (!form.fullName.trim()) {
      Alert.alert("Equipo", "Escribe el nombre del trabajador.");
      return;
    }
    if (!form.role) {
      Alert.alert("Equipo", "Selecciona un rol.");
      return;
    }
    if (!canAssignRole(form.role)) {
      if (!(isSelf && form.role === editingEmployee.role)) {
        Alert.alert("Equipo", "No tienes permisos para asignar ese rol.");
        return;
      }
    }

    let primarySiteId =
      form.primarySiteId ?? form.siteIds[0] ?? editingEmployee.site_id ?? null;

    if (isManager) {
      if (!managerSiteId) {
        Alert.alert("Equipo", "No tienes una sede asignada.");
        return;
      }
      primarySiteId = managerSiteId;
    }

    if (!primarySiteId) {
      Alert.alert("Equipo", "Selecciona una sede principal.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("employees")
        .update({
          full_name: form.fullName.trim(),
          alias: form.alias.trim() || null,
          role: form.role,
          site_id: primarySiteId,
          is_active: form.isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingEmployee.id);

      if (error) throw error;

      if (!isManager) {
        await saveEmployeeSites(
          editingEmployee.id,
          form.siteIds,
          primarySiteId,
        );
      }

      await loadEmployees();
      closeEdit();
    } catch (err) {
      console.error("Employee update error:", err);
      Alert.alert("Equipo", "No se pudo guardar el trabajador.");
    } finally {
      setIsSaving(false);
    }
  };

  const openPicker = (
    picker:
      | "editRole"
      | "editPrimary"
      | "editSites"
      | "inviteRole"
      | "inviteSite",
  ) => {
    setPickerQuery("")
    setActivePicker(picker)
  }

  const openInvite = () => {
    if (!canManageTeam) return;
    const defaultSite = isManager
      ? managerSiteId
      : selectedSiteId ?? employee?.siteId ?? sites[0]?.id ?? null;
    if (isManager && !defaultSite) {
      Alert.alert("Equipo", "No tienes una sede asignada.");
      return;
    }
    setInviteForm({
      email: "",
      fullName: "",
      role: "",
      siteId: defaultSite,
    });
    setInviteToken(null);
    setIsInviteOpen(true);
    setActivePicker(null);
    setPickerQuery("");
  };

  const closeInvite = () => {
    setIsInviteOpen(false);
    setInviteToken(null);
    setActivePicker(null);
    setPickerQuery("");
  };

  const handleInvite = async () => {
    if (!canManageTeam) return;
    if (!inviteForm.email.trim()) {
      Alert.alert("Equipo", "Escribe el correo del trabajador.");
      return;
    }
    if (!inviteForm.role) {
      Alert.alert("Equipo", "Selecciona un rol.");
      return;
    }
    if (!canAssignRole(inviteForm.role)) {
      Alert.alert("Equipo", "No tienes permisos para asignar ese rol.");
      return;
    }
    if (!inviteForm.siteId) {
      Alert.alert("Equipo", "Selecciona una sede principal.");
      return;
    }
    if (isManager && managerSiteId && inviteForm.siteId !== managerSiteId) {
      Alert.alert("Equipo", "Solo puedes invitar a tu sede.");
      return;
    }

    setIsInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "staff-invitations-create",
        {
          body: {
            email: inviteForm.email.trim(),
            full_name: inviteForm.fullName.trim() || null,
            role: inviteForm.role,
            site_id: inviteForm.siteId,
          },
        },
      );

      if (error) throw error;
      if (!data?.token) {
        throw new Error("No se pudo generar la invitación.");
      }

      setInviteToken(data.token);
    } catch (err) {
      console.error("Invite error:", err);
      Alert.alert("Equipo", "No se pudo crear la invitación.");
    } finally {
      setIsInviting(false);
    }
  };

  if (!canViewTeam) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>Equipo</Text>
        <Text style={styles.subtitle}>
          No tienes permisos para acceder a esta sección.
        </Text>
      </View>
    );
  }

  const primarySiteLabel = form.primarySiteId
    ? sites.find((site) => site.id === form.primarySiteId)?.name
    : null;

  const roleName = form.role ? roleLabel(form.role) : null;
  const isEditingSelf = editingEmployee?.id === user?.id;
  const canPickRole = canManageTeam && (!isEditingSelf || canAssignRole(form.role));
  const canPickSites = canChangeSites;

  const showFilters = canViewAllSites && sites.length > 0;
  const availableRoleOptions = useMemo(() => {
    if (isOwner) return roles;
    if (isGlobalManager) {
      return roles.filter(
        (item) =>
          item.code !== OWNER_ROLE && item.code !== GLOBAL_MANAGER_ROLE,
      );
    }
    if (isManager) {
      return roles.filter((item) => !MANAGEMENT_ROLES.has(item.code));
    }
    return [];
  }, [roles, isOwner, isGlobalManager, isManager]);

  const filteredRoleOptions = useMemo(() => {
    if (!pickerQuery.trim()) return availableRoleOptions;
    const q = pickerQuery.trim().toLowerCase();
    return availableRoleOptions.filter((item) =>
      item.name.toLowerCase().includes(q),
    );
  }, [availableRoleOptions, pickerQuery]);

  const filteredSiteOptions = useMemo(() => {
    if (!pickerQuery.trim()) return sites;
    const q = pickerQuery.trim().toLowerCase();
    return sites.filter((site) => site.name.toLowerCase().includes(q));
  }, [sites, pickerQuery]);

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
            <Text style={styles.title}>Equipo</Text>
            <Text style={styles.subtitle}>
              Gestiona trabajadores y sedes asignadas.
            </Text>
          </View>
          {canManageTeam ? (
            <TouchableOpacity
              onPress={openInvite}
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
              <Ionicons name="person-add-outline" size={16} color={COLORS.accent} />
              <Text style={{ fontWeight: "800", color: COLORS.accent }}>
                Invitar
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ marginTop: 16 }}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nombre o rol"
            placeholderTextColor={COLORS.neutral}
            style={styles.searchInput}
          />
        </View>

        {showFilters ? (
          <View style={{ marginTop: 12 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 8 }}
            >
              <TouchableOpacity
                onPress={() => setSiteFilterId(null)}
                style={[
                  UI.chip,
                  {
                    borderColor: siteFilterId ? COLORS.border : COLORS.accent,
                    backgroundColor: siteFilterId
                      ? COLORS.white
                      : "rgba(226, 0, 106, 0.10)",
                    marginRight: 10,
                  },
                ]}
              >
                <Text
                  style={{
                    fontWeight: "800",
                    color: siteFilterId ? COLORS.text : COLORS.accent,
                  }}
                >
                  Todas
                </Text>
              </TouchableOpacity>

              {sites.map((site) => {
                const active = siteFilterId === site.id;
                return (
                  <TouchableOpacity
                    key={site.id}
                    onPress={() => setSiteFilterId(site.id)}
                    style={[
                      UI.chip,
                      {
                        borderColor: active ? COLORS.accent : COLORS.border,
                        backgroundColor: active
                          ? "rgba(226, 0, 106, 0.10)"
                          : COLORS.white,
                        marginRight: 10,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontWeight: "800",
                        color: active ? COLORS.accent : COLORS.text,
                      }}
                    >
                      {site.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {isLoading ? (
          <View style={{ paddingTop: 30, alignItems: "center" }}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        ) : null}

        {!isLoading && filteredEmployees.length === 0 ? (
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
                <Ionicons name="people-outline" size={22} color={COLORS.accent} />
              </View>
              <Text style={styles.emptyTitle}>Sin trabajadores</Text>
              <Text style={styles.emptySubtitle}>
                Aún no hay perfiles de equipo para este filtro.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={{ marginTop: 18, gap: 12 }}>
          {filteredEmployees.map((item) => {
            const statusActive = item.is_active !== false;
            const statusColor = statusActive ? COLORS.rosegold : COLORS.neutral;
            const siteName = item.sites?.name ?? "Sin sede";
            const isSelf = item.id === user?.id;
            let canEditItem = canManageTeam;

            if (!isOwner && item.role === OWNER_ROLE && !isSelf) {
              canEditItem = false;
            }
            if (isManager) {
              if (!managerSiteId || item.site_id !== managerSiteId) {
                canEditItem = false;
              }
              if (MANAGEMENT_ROLES.has(item.role) && !isSelf) {
                canEditItem = false;
              }
            }
            if (!canAssignRole(item.role) && !isSelf) {
              canEditItem = false;
            }
            return (
              <View key={item.id} style={[UI.card, { padding: 14 }]}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
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
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ fontWeight: "800", color: COLORS.accent }}>
                      {item.full_name?.charAt(0).toUpperCase() ?? "?"}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.employeeName} numberOfLines={1}>
                      {formatName(item)}
                    </Text>
                    <Text style={styles.employeeMeta} numberOfLines={1}>
                      {roleLabel(item.role)} · {siteName}
                    </Text>
                  </View>

                  <View
                    style={[
                      UI.pill,
                      {
                        borderColor: statusColor,
                        backgroundColor:
                          statusActive && statusColor === COLORS.rosegold
                            ? "rgba(242, 198, 192, 0.28)"
                            : COLORS.porcelainAlt,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: statusColor,
                      }}
                    >
                      {statusActive ? "Activo" : "Inactivo"}
                    </Text>
                  </View>
                </View>

                {canEditItem ? (
                  <TouchableOpacity
                    onPress={() => startEdit(item)}
                    style={[
                      UI.chip,
                      {
                        marginTop: 12,
                        borderColor: COLORS.accent,
                        backgroundColor: "rgba(226, 0, 106, 0.10)",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        justifyContent: "center",
                      },
                    ]}
                  >
                    <Ionicons name="create-outline" size={16} color={COLORS.accent} />
                    <Text style={{ fontWeight: "800", color: COLORS.accent }}>
                      Editar
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
      <Modal
        transparent
        visible={isEditOpen}
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={closeEdit}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeEdit} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar trabajador</Text>
            <Text style={styles.modalSubtitle}>
              Actualiza datos basicos, rol y sedes.
            </Text>

            <Text style={styles.modalLabel}>Nombre completo</Text>
            <TextInput
              value={form.fullName}
              onChangeText={(value) =>
                setForm((prev) => ({ ...prev, fullName: value }))
              }
              placeholder="Nombre completo"
              placeholderTextColor={COLORS.neutral}
              style={styles.input}
            />

            <Text style={styles.modalLabel}>Alias</Text>
            <TextInput
              value={form.alias}
              onChangeText={(value) =>
                setForm((prev) => ({ ...prev, alias: value }))
              }
              placeholder="Alias (opcional)"
              placeholderTextColor={COLORS.neutral}
              style={styles.input}
            />

            <Text style={styles.modalLabel}>Rol</Text>
            <TouchableOpacity
              onPress={canPickRole ? () => openPicker("editRole") : undefined}
              disabled={!canPickRole}
              style={[
                UI.chip,
                {
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.porcelainAlt,
                  marginTop: 6,
                  opacity: canPickRole ? 1 : 0.6,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontWeight: "700", color: COLORS.text, flex: 1 }}>
                  {roleName ?? "Selecciona un rol"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.neutral} />
              </View>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Sede principal</Text>
            <TouchableOpacity
              onPress={canPickSites ? () => openPicker("editPrimary") : undefined}
              disabled={!canPickSites}
              style={[
                UI.chip,
                {
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.porcelainAlt,
                  marginTop: 6,
                  opacity: canPickSites ? 1 : 0.6,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontWeight: "700", color: COLORS.text, flex: 1 }}>
                  {primarySiteLabel ?? "Selecciona la sede principal"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.neutral} />
              </View>
            </TouchableOpacity>

            {canPickSites ? (
              <>
                <Text style={styles.modalLabel}>Sedes asignadas</Text>
                <TouchableOpacity
                  onPress={() => openPicker("editSites")}
                  style={[
                    UI.chip,
                    {
                      borderColor: COLORS.border,
                      backgroundColor: COLORS.porcelainAlt,
                      marginTop: 6,
                    },
                  ]}
                >
                  <View
                    style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                  >
                    <Text style={{ fontWeight: "700", color: COLORS.text, flex: 1 }}>
                      {form.siteIds.length
                        ? `${form.siteIds.length} sedes seleccionadas`
                        : "Selecciona sedes"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={COLORS.neutral} />
                  </View>
                </TouchableOpacity>
              </>
            ) : null}

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Activo</Text>
              <Switch
                value={form.isActive}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, isActive: value }))
                }
                trackColor={{ false: COLORS.border, true: COLORS.rosegoldBright }}
                thumbColor={form.isActive ? COLORS.rosegold : COLORS.neutral}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={closeEdit}
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
                onPress={handleSave}
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
                  {isSaving ? "Guardando..." : "Guardar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {activePicker && activePicker.startsWith("edit") ? (
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
                  {activePicker === "editRole"
                    ? "Rol"
                    : activePicker === "editPrimary"
                      ? "Sede principal"
                      : "Sedes asignadas"}
                </Text>
              </View>

              <View style={styles.pickerSearchWrap}>
                <TextInput
                  value={pickerQuery}
                  onChangeText={setPickerQuery}
                  placeholder={
                    activePicker === "editRole"
                      ? "Buscar rol..."
                      : "Buscar sede..."
                  }
                  placeholderTextColor={COLORS.neutral}
                  style={styles.pickerSearchInput}
                />
              </View>

              <ScrollView contentContainerStyle={styles.pickerList}>
                {activePicker === "editRole" ? (
                  filteredRoleOptions.length === 0 ? (
                    <Text style={styles.modalHint}>No hay roles disponibles.</Text>
                  ) : (
                    filteredRoleOptions.map((item) => {
                      const active = form.role === item.code
                      return (
                        <TouchableOpacity
                          key={item.code}
                          onPress={() => {
                            setForm((prev) => ({ ...prev, role: item.code }))
                            setActivePicker(null)
                          }}
                          style={[
                            styles.pickerItem,
                            active ? styles.pickerItemActive : null,
                          ]}
                        >
                          <Text style={styles.pickerItemTitle}>{item.name}</Text>
                        </TouchableOpacity>
                      )
                    })
                  )
                ) : activePicker === "editPrimary" ? (
                  filteredSiteOptions.map((site) => {
                    const active = form.primarySiteId === site.id
                    return (
                      <TouchableOpacity
                        key={site.id}
                        onPress={() => {
                          setPrimarySite(site.id)
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
                ) : (
                  filteredSiteOptions.map((site) => {
                    const selected = form.siteIds.includes(site.id)
                    const isPrimary = form.primarySiteId === site.id
                    return (
                      <View key={site.id} style={styles.siteRow}>
                        <TouchableOpacity
                          onPress={() => toggleSiteSelection(site.id)}
                          style={styles.siteRowLeft}
                        >
                          <Ionicons
                            name={selected ? "checkbox" : "square-outline"}
                            size={18}
                            color={selected ? COLORS.accent : COLORS.neutral}
                          />
                          <Text style={styles.siteRowText}>{site.name}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => setPrimarySite(site.id)}
                          disabled={!selected}
                          style={styles.siteRowPrimary}
                        >
                          <Ionicons
                            name={isPrimary ? "star" : "star-outline"}
                            size={18}
                            color={isPrimary ? COLORS.rosegold : COLORS.neutral}
                          />
                        </TouchableOpacity>
                      </View>
                    )
                  })
                )}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>


      <Modal
        transparent
        visible={isInviteOpen}
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={closeInvite}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeInvite} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invitar trabajador</Text>
            <Text style={styles.modalSubtitle}>
              Genera un código de invitación para crear la cuenta.
            </Text>

            <Text style={styles.modalLabel}>Correo</Text>
            <TextInput
              value={inviteForm.email}
              onChangeText={(value) =>
                setInviteForm((prev) => ({ ...prev, email: value }))
              }
              placeholder="correo@empresa.com"
              placeholderTextColor={COLORS.neutral}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />

            <Text style={styles.modalLabel}>Nombre completo</Text>
            <TextInput
              value={inviteForm.fullName}
              onChangeText={(value) =>
                setInviteForm((prev) => ({ ...prev, fullName: value }))
              }
              placeholder="Nombre completo"
              placeholderTextColor={COLORS.neutral}
              style={styles.input}
            />

            <Text style={styles.modalLabel}>Rol</Text>
            <TouchableOpacity
              onPress={() => openPicker("inviteRole")}
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
                  {inviteForm.role
                    ? roleLabel(inviteForm.role)
                    : "Selecciona un rol"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.neutral} />
              </View>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Sede principal</Text>
            <TouchableOpacity
              onPress={canPickSites ? () => openPicker("inviteSite") : undefined}
              disabled={!canPickSites}
              style={[
                UI.chip,
                {
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.porcelainAlt,
                  marginTop: 6,
                  opacity: canPickSites ? 1 : 0.6,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontWeight: "700", color: COLORS.text, flex: 1 }}>
                  {inviteForm.siteId
                    ? sites.find((site) => site.id === inviteForm.siteId)?.name ??
                      "Selecciona la sede"
                    : "Selecciona la sede"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.neutral} />
              </View>
            </TouchableOpacity>

            {inviteToken ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.modalLabel}>código de invitación</Text>
                <View
                  style={{
                    marginTop: 6,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    padding: 12,
                    backgroundColor: COLORS.porcelainAlt,
                  }}
                >
                  <Text style={{ fontWeight: "800", color: COLORS.text }}>
                    {inviteToken}
                  </Text>
                </View>
                <Text style={styles.modalHint}>
                  Comparte este código para que la persona active su cuenta.
                </Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={closeInvite}
                style={[
                  UI.chip,
                  {
                    borderColor: COLORS.border,
                    backgroundColor: COLORS.porcelainAlt,
                  },
                ]}
              >
                <Text style={{ fontWeight: "700", color: COLORS.text }}>
                  {inviteToken ? "Cerrar" : "Cancelar"}
                </Text>
              </TouchableOpacity>
              {!inviteToken ? (
                <TouchableOpacity
                  onPress={handleInvite}
                  disabled={isInviting}
                  style={[
                    UI.chip,
                    {
                      borderColor: COLORS.rosegold,
                      backgroundColor: "rgba(242, 198, 192, 0.25)",
                      opacity: isInviting ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={{ fontWeight: "700", color: COLORS.rosegold }}>
                    {isInviting ? "Creando..." : "Crear invitación"}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {activePicker && activePicker.startsWith("invite") ? (
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
                  {activePicker === "inviteRole" ? "Rol" : "Sede principal"}
                </Text>
              </View>

              <View style={styles.pickerSearchWrap}>
                <TextInput
                  value={pickerQuery}
                  onChangeText={setPickerQuery}
                  placeholder={
                    activePicker === "inviteRole"
                      ? "Buscar rol..."
                      : "Buscar sede..."
                  }
                  placeholderTextColor={COLORS.neutral}
                  style={styles.pickerSearchInput}
                />
              </View>

              <ScrollView contentContainerStyle={styles.pickerList}>
                {activePicker === "inviteRole" ? (
                  filteredRoleOptions.length === 0 ? (
                    <Text style={styles.modalHint}>No hay roles disponibles.</Text>
                  ) : (
                    filteredRoleOptions.map((item) => {
                      const active = inviteForm.role === item.code
                      return (
                        <TouchableOpacity
                          key={item.code}
                          onPress={() => {
                            setInviteForm((prev) => ({ ...prev, role: item.code }))
                            setActivePicker(null)
                          }}
                          style={[
                            styles.pickerItem,
                            active ? styles.pickerItemActive : null,
                          ]}
                        >
                          <Text style={styles.pickerItemTitle}>{item.name}</Text>
                        </TouchableOpacity>
                      )
                    })
                  )
                ) : (
                  filteredSiteOptions.map((site) => {
                    const active = inviteForm.siteId === site.id
                    return (
                      <TouchableOpacity
                        key={site.id}
                        onPress={() => {
                          setInviteForm((prev) => ({ ...prev, siteId: site.id }))
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
  searchInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 12,
    color: COLORS.text,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  employeeMeta: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 4,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },
  emptySubtitle: {
    marginTop: 6,
    color: COLORS.neutral,
    textAlign: "center",
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
  modalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 16,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    padding: 12,
    marginTop: 6,
    color: COLORS.text,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  siteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  siteRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  siteRowText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "600",
  },
  siteRowPrimary: {
    padding: 6,
  },
});



