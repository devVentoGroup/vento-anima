import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/auth-context";
import TeamEmptyState from "@/components/team/TeamEmptyState";
import TeamMemberCard from "@/components/team/TeamMemberCard";
import TeamEditModal from "@/components/team/TeamEditModal";
import TeamInviteModal from "@/components/team/TeamInviteModal";
import { TEAM_UI } from "@/components/team/ui";
import type {
  EditFormState,
  EmployeeRow,
  InviteFormState,
  RoleRow,
  SiteRow,
} from "@/components/team/types";

type EmployeeRowDb = Omit<EmployeeRow, "sites"> & {
  sites?: { id: string; name: string } | { id: string; name: string }[] | null;
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

const UI = TEAM_UI;

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
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmailSent, setInviteEmailSent] = useState<string | null>(null);
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState<
    string | null
  >(null);
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
    setPickerQuery("");
    setActivePicker(picker);
  };

  const updateForm = (patch: Partial<EditFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const updateInviteForm = (patch: Partial<InviteFormState>) => {
    setInviteForm((prev) => ({ ...prev, ...patch }));
  };

  const closePicker = () => {
    setActivePicker(null);
  };

  const openEditPicker = (picker: "editRole" | "editPrimary" | "editSites") =>
    openPicker(picker);
  const openInvitePicker = (picker: "inviteRole" | "inviteSite") =>
    openPicker(picker);

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
    setInviteEmailSent(null);
    setInviteSuccessMessage(null);
    setIsInviteOpen(true);
    setActivePicker(null);
    setPickerQuery("");
  };

  const closeInvite = () => {
    setIsInviteOpen(false);
    setInviteEmailSent(null);
    setInviteSuccessMessage(null);
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

      if (error) {
        let msg = "No se pudo crear la invitación.";
        if (error instanceof FunctionsHttpError && error.context) {
          try {
            const body = (await error.context.json()) as { error?: string };
            if (body?.error) msg = body.error;
          } catch {
            msg = error.message ?? msg;
          }
        } else {
          msg = (error as Error)?.message ?? (data as { error?: string } | null)?.error ?? msg;
        }
        Alert.alert("Equipo", msg);
        return;
      }
      if (!data?.invited && !(data as { added_to_team?: boolean })?.added_to_team) {
        const msg =
          (data as { error?: string } | null)?.error ??
          "No se pudo enviar la invitación.";
        Alert.alert("Equipo", msg);
        return;
      }

      setInviteEmailSent(inviteForm.email.trim());
      setInviteSuccessMessage(
        (data as { added_to_team?: boolean; message?: string })?.added_to_team
          ? (data as { message?: string }).message ?? null
          : null,
      );
    } catch (err) {
      console.error("Invite error:", err);
      const msg =
        err instanceof Error ? err.message : "No se pudo crear la invitación.";
      Alert.alert("Equipo", msg);
    } finally {
      setIsInviting(false);
    }
  };

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

  const editPicker =
    activePicker === "editRole" ||
    activePicker === "editPrimary" ||
    activePicker === "editSites"
      ? activePicker
      : null;
  const invitePicker =
    activePicker === "inviteRole" || activePicker === "inviteSite"
      ? activePicker
      : null;

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
          <TeamEmptyState />
        ) : null}

        <View style={{ marginTop: 18, gap: 12 }}>
          {filteredEmployees.map((item) => {
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
              <TeamMemberCard
                key={item.id}
                employee={item}
                formatName={formatName}
                roleLabel={roleLabel}
                canEdit={canEditItem}
                onEdit={() => startEdit(item)}
              />
            );
          })}
        </View>
      </ScrollView>
      <TeamEditModal
        visible={isEditOpen}
        insets={insets}
        form={form}
        roleName={roleName}
        primarySiteLabel={primarySiteLabel}
        canPickRole={canPickRole}
        canPickSites={canPickSites}
        isSaving={isSaving}
        activePicker={editPicker}
        pickerQuery={pickerQuery}
        filteredRoleOptions={filteredRoleOptions}
        filteredSiteOptions={filteredSiteOptions}
        onClose={closeEdit}
        onSave={handleSave}
        onOpenPicker={openEditPicker}
        onClosePicker={closePicker}
        onSetPickerQuery={setPickerQuery}
        onUpdateForm={updateForm}
        onToggleSite={toggleSiteSelection}
        onSetPrimarySite={setPrimarySite}
      />

      <TeamInviteModal
        visible={isInviteOpen}
        insets={insets}
        form={inviteForm}
        inviteEmailSent={inviteEmailSent}
        inviteSuccessMessage={inviteSuccessMessage}
        isInviting={isInviting}
        canPickSites={canPickSites}
        inviteRoleLabel={inviteForm.role ? roleLabel(inviteForm.role) : null}
        inviteSiteLabel={
          inviteForm.siteId
            ? sites.find((site) => site.id === inviteForm.siteId)?.name ??
              "Selecciona la sede"
            : null
        }
        activePicker={invitePicker}
        pickerQuery={pickerQuery}
        filteredRoleOptions={filteredRoleOptions}
        filteredSiteOptions={filteredSiteOptions}
        onClose={closeInvite}
        onSubmit={handleInvite}
        onOpenPicker={openInvitePicker}
        onClosePicker={closePicker}
        onSetPickerQuery={setPickerQuery}
        onUpdateForm={updateInviteForm}
      />
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
});



