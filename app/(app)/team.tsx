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
import { CONTENT_HORIZONTAL_PADDING, CONTENT_MAX_WIDTH } from "@/constants/layout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useRoleCapabilities } from "@/hooks/use-role-capabilities";
import TeamEmptyState from "@/components/team/TeamEmptyState";
import TeamMemberCard from "@/components/team/TeamMemberCard";
import TeamEditModal from "@/components/team/TeamEditModal";
import TeamInviteModal from "@/components/team/TeamInviteModal";
import TeamDeleteModal from "@/components/team/TeamDeleteModal";
import { TEAM_UI } from "@/components/team/ui";
import { getUserFacingAuthError } from "@/utils/error-messages";
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

type StaffInvitationRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: string;
  resend_count: number | null;
  expires_at: string | null;
  cancelled_at: string | null;
  last_sent_at: string | null;
  updated_at: string | null;
  role_code: string | null;
  staff_role: string | null;
  site_id: string | null;
  staff_site_id: string | null;
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
  const { has: hasCapability, loaded: capabilitiesLoaded } = useRoleCapabilities(role);
  const isOwner = role === OWNER_ROLE;
  const isGlobalManager = role === GLOBAL_MANAGER_ROLE;
  const isManager = role === MANAGER_ROLE;
  const canViewTeam = capabilitiesLoaded
    ? hasCapability("team.view")
    : Boolean(role && MANAGEMENT_ROLES.has(role));
  const canManageTeam = capabilitiesLoaded
    ? hasCapability("team.invite")
    : Boolean(role && MANAGEMENT_ROLES.has(role));
  const canViewAllSites = isOwner || isGlobalManager;
  const canChangeSites = canViewAllSites;
  const ownerDeleteUid = process.env.EXPO_PUBLIC_ANIMA_OWNER_DELETE_UID ?? null;
  const canUseDeleteFlow =
    !!ownerDeleteUid && !!user?.id && user.id === ownerDeleteUid;

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<StaffInvitationRow[]>([]);
  const [search, setSearch] = useState("");
  const [siteFilterId, setSiteFilterId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);
  const [cancellingInvitationId, setCancellingInvitationId] = useState<string | null>(null);

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
    expiresAt: "",
  });
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeRow | null>(
    null,
  );
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingEmployee, setIsDeletingEmployee] = useState(false);

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

  const loadInvitations = useCallback(async () => {
    if (!user) return;
    setIsLoadingInvitations(true);
    try {
      let query = supabase
        .from("staff_invitations")
        .select(
          "id, email, full_name, status, resend_count, expires_at, cancelled_at, last_sent_at, updated_at, role_code, staff_role, site_id, staff_site_id",
        )
        .in("status", ["sent", "expired", "linked_existing_user"])
        .order("updated_at", { ascending: false });

      if (isManager && managerSiteId) {
        query = query.or(`site_id.eq.${managerSiteId},staff_site_id.eq.${managerSiteId}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPendingInvitations((data as StaffInvitationRow[]) ?? []);
    } catch (err) {
      console.error("Invitations load error:", err);
      setPendingInvitations([]);
    } finally {
      setIsLoadingInvitations(false);
    }
  }, [user, isManager, managerSiteId]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadEmployees(), loadSites(), loadRoles(), loadInvitations()]);
  }, [loadEmployees, loadSites, loadRoles, loadInvitations]);

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
      expiresAt: "",
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
      const body: {
        email: string;
        full_name: string | null;
        role: string;
        site_id: string;
        expires_at?: string;
      } = {
        email: inviteForm.email.trim(),
        full_name: inviteForm.fullName.trim() || null,
        role: inviteForm.role,
        site_id: inviteForm.siteId,
      };
      const expiresAtTrim = inviteForm.expiresAt?.trim();
      if (expiresAtTrim) {
        const date = new Date(expiresAtTrim);
        if (!Number.isNaN(date.getTime())) {
          body.expires_at = date.toISOString();
        }
      }
      const { data, error } = await supabase.functions.invoke(
        "staff-invitations-create",
        { body },
      );

      if (error) {
        Alert.alert(
          "Equipo",
          getUserFacingAuthError(
            error,
            "No se pudo procesar la invitación. Intenta nuevamente.",
          ),
        );
        return;
      }
      if (!data?.invited && !(data as { added_to_team?: boolean })?.added_to_team) {
        Alert.alert("Equipo", "No se pudo enviar la invitación.");
        return;
      }

      setInviteEmailSent(inviteForm.email.trim());
      setInviteSuccessMessage(
        (data as { added_to_team?: boolean; message?: string })?.added_to_team
          ? (data as { message?: string }).message ?? null
          : null,
      );
      await loadInvitations();
    } catch (err) {
      console.error("Invite error:", err);
      Alert.alert(
        "Equipo",
        getUserFacingAuthError(
          err,
          "No se pudo procesar la invitación. Intenta nuevamente.",
        ),
      );
    } finally {
      setIsInviting(false);
    }
  };

  const getEffectiveInvitationStatus = useCallback((invitation: StaffInvitationRow) => {
    if (
      invitation.status === "sent" &&
      invitation.expires_at &&
      new Date(invitation.expires_at).getTime() < Date.now()
    ) {
      return "expired";
    }
    return invitation.status;
  }, []);

  const getInvitationStatusLabel = useCallback((status: string) => {
    if (status === "sent") return "Pendiente";
    if (status === "expired") return "Vencida"
    if (status === "linked_existing_user") return "Agregado al equipo";
    if (status === "cancelled") return "Cancelada";
    return status;
  }, []);

  const formatInvitationDate = useCallback((value: string | null) => {
    if (!value) return "Sin fecha";
    return new Date(value).toLocaleString("es-CO", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const handleResendInvitation = useCallback(
    async (invitation: StaffInvitationRow) => {
      if (!canManageTeam) return;
      const effectiveStatus = getEffectiveInvitationStatus(invitation);
      if (effectiveStatus === "linked_existing_user") {
        Alert.alert(
          "Equipo",
          "Este usuario ya existía en el sistema. Si necesita acceso, debe usar «¿Olvidaste tu contraseña?» en ANIMA.",
        );
        return;
      }

      setResendingInvitationId(invitation.id);
      try {
        const { data, error } = await supabase.functions.invoke(
          "staff-invitations-resend",
          {
            body: { staff_invitation_id: invitation.id },
          },
        );

        if (error) {
          Alert.alert(
            "Equipo",
            getUserFacingAuthError(
              error,
              "No se pudo reenviar la invitación. Intenta nuevamente.",
            ),
          );
          return;
        }

        Alert.alert(
          "Equipo",
          String(
            (data as { message?: string })?.message ??
              "Invitación reenviada correctamente.",
          ),
        );
        await loadInvitations();
      } catch (err) {
        console.error("Resend invitation error:", err);
        Alert.alert(
          "Equipo",
          getUserFacingAuthError(
            err,
            "No se pudo reenviar la invitación. Intenta nuevamente.",
          ),
        );
      } finally {
        setResendingInvitationId(null);
      }
    },
    [canManageTeam, getEffectiveInvitationStatus, loadInvitations],
  );

  const handleCancelInvitation = useCallback(
    async (invitation: StaffInvitationRow) => {
      if (!canManageTeam) return;

      Alert.alert(
        "Cancelar invitación",
        `Se cancelará la invitación de ${invitation.email ?? "este correo"}.`,
        [
          { text: "Cerrar", style: "cancel" },
          {
            text: "Cancelar invitación",
            style: "destructive",
            onPress: async () => {
              setCancellingInvitationId(invitation.id);
              try {
                const { data, error } = await supabase.functions.invoke(
                  "staff-invitations-cancel",
                  {
                    body: { staff_invitation_id: invitation.id },
                  },
                );

                if (error) {
                  Alert.alert(
                    "Equipo",
                    getUserFacingAuthError(
                      error,
                      "No se pudo cancelar la invitación.",
                    ),
                  );
                  return;
                }

                Alert.alert(
                  "Equipo",
                  String(
                    (data as { message?: string })?.message ??
                      "Invitación cancelada correctamente.",
                  ),
                );
                await loadInvitations();
              } catch (err) {
                console.error("Cancel invitation error:", err);
                Alert.alert(
                  "Equipo",
                  getUserFacingAuthError(
                    err,
                    "No se pudo cancelar la invitación.",
                  ),
                );
              } finally {
                setCancellingInvitationId(null);
              }
            },
          },
        ],
      );
    },
    [canManageTeam, loadInvitations],
  );

  const closeDelete = () => {
    setDeletingEmployee(null);
    setDeleteConfirmText("");
    setIsDeletingEmployee(false);
  };

  const startDelete = (item: EmployeeRow) => {
    if (!canUseDeleteFlow) {
      Alert.alert("Equipo", "No tienes permisos para eliminar trabajadores.");
      return;
    }
    if (item.id === user?.id) {
      Alert.alert("Equipo", "No puedes eliminar tu propio usuario.");
      return;
    }
    if (item.role === OWNER_ROLE) {
      Alert.alert("Equipo", "No se puede eliminar otro propietario.");
      return;
    }

    Alert.alert(
      "Eliminar trabajador",
      `Se eliminará permanentemente ${formatName(item)} junto con sus registros. ¿Deseas continuar?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Continuar",
          style: "destructive",
          onPress: () => {
            setDeletingEmployee(item);
            setDeleteConfirmText("");
          },
        },
      ],
    );
  };

  const confirmDelete = async () => {
    if (!deletingEmployee) return;
    if (deleteConfirmText.trim().toUpperCase() !== "ELIMINAR") return;

    setIsDeletingEmployee(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-delete", {
        body: {
          target_employee_id: deletingEmployee.id,
        },
      });

      if (error) {
        throw new Error(error.message || "No se pudo eliminar el trabajador");
      }
      if (data?.error) {
        throw new Error(String(data.error));
      }

      await loadEmployees();
      closeDelete();
      Alert.alert("Equipo", "Trabajador eliminado correctamente.");
    } catch (err) {
      console.error("Delete employee error:", err);
      Alert.alert(
        "Equipo",
        getUserFacingAuthError(err, "No se pudo eliminar el trabajador."),
      );
    } finally {
      setIsDeletingEmployee(false);
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
  const normalizedPrimarySiteLabel = primarySiteLabel ?? null;

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
          alignSelf: "center",
          width: "100%",
          maxWidth: CONTENT_MAX_WIDTH,
          paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
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

        <View style={{ marginTop: 20 }}>
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Invitaciones pendientes</Text>
              <Text style={styles.sectionSubtitle}>
                Accesos enviados o pendientes de seguimiento.
              </Text>
            </View>
            <View style={[UI.pill, styles.sectionCountPill]}>
              <Text style={styles.sectionCountText}>{pendingInvitations.length}</Text>
            </View>
          </View>

          {isLoadingInvitations ? (
            <View style={{ paddingTop: 12, alignItems: "center" }}>
              <ActivityIndicator color={COLORS.accent} />
            </View>
          ) : null}

          {!isLoadingInvitations && pendingInvitations.length === 0 ? (
            <View style={styles.pendingEmptyCard}>
              <Text style={styles.pendingEmptyTitle}>Sin pendientes</Text>
              <Text style={styles.pendingEmptyText}>
                Cuando envies invitaciones o haya accesos por cerrar, apareceran aqui.
              </Text>
            </View>
          ) : null}

          <View style={{ marginTop: 12, gap: 12 }}>
            {pendingInvitations.map((invitation) => {
              const effectiveStatus = getEffectiveInvitationStatus(invitation);
              const invitationSiteId = invitation.site_id ?? invitation.staff_site_id;
              const invitationRole = invitation.role_code ?? invitation.staff_role ?? "";
              const siteName =
                invitationSiteId
                  ? sites.find((site) => site.id === invitationSiteId)?.name ?? "Sede"
                  : "Sin sede";
              const isLinkedExisting = effectiveStatus === "linked_existing_user";
              const canResend = !isLinkedExisting && effectiveStatus !== "cancelled";
              const canCancel =
                effectiveStatus === "sent" || effectiveStatus === "expired";
              const isResending = resendingInvitationId === invitation.id;
              const isCancelling = cancellingInvitationId === invitation.id;

              return (
                <View key={invitation.id} style={[UI.card, styles.pendingCard]}>
                  <View style={styles.pendingHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pendingName}>
                        {invitation.full_name?.trim() || invitation.email || "Invitación"}
                      </Text>
                      {invitation.email ? (
                        <Text style={styles.pendingEmail}>{invitation.email}</Text>
                      ) : null}
                    </View>
                    <View
                      style={[
                        UI.pill,
                        styles.pendingStatusPill,
                        isLinkedExisting
                          ? styles.pendingStatusLinked
                          : effectiveStatus === "expired"
                            ? styles.pendingStatusExpired
                            : effectiveStatus === "cancelled"
                              ? styles.pendingStatusCancelled
                              : styles.pendingStatusSent,
                      ]}
                    >
                      <Text style={styles.pendingStatusText}>
                        {getInvitationStatusLabel(effectiveStatus)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.pendingMetaRow}>
                    <Text style={styles.pendingMetaLabel}>Rol</Text>
                    <Text style={styles.pendingMetaValue}>{roleLabel(invitationRole)}</Text>
                  </View>
                  <View style={styles.pendingMetaRow}>
                    <Text style={styles.pendingMetaLabel}>Sede</Text>
                    <Text style={styles.pendingMetaValue}>{siteName}</Text>
                  </View>
                  <View style={styles.pendingMetaRow}>
                    <Text style={styles.pendingMetaLabel}>Ultimo envio</Text>
                    <Text style={styles.pendingMetaValue}>
                      {formatInvitationDate(invitation.last_sent_at ?? invitation.updated_at)}
                    </Text>
                  </View>
                  <View style={styles.pendingMetaRow}>
                    <Text style={styles.pendingMetaLabel}>Expira</Text>
                    <Text style={styles.pendingMetaValue}>
                      {formatInvitationDate(invitation.expires_at)}
                    </Text>
                  </View>
                  <View style={styles.pendingMetaRow}>
                    <Text style={styles.pendingMetaLabel}>Reenvios</Text>
                    <Text style={styles.pendingMetaValue}>
                      {Number(invitation.resend_count ?? 0)}
                    </Text>
                  </View>

                  <View style={styles.pendingActions}>
                    <TouchableOpacity
                      disabled={!canResend || isResending}
                      onPress={() => void handleResendInvitation(invitation)}
                      style={[
                        styles.pendingActionButton,
                        canResend
                          ? styles.pendingActionPrimary
                          : styles.pendingActionDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pendingActionText,
                          canResend
                            ? styles.pendingActionTextPrimary
                            : styles.pendingActionTextDisabled,
                        ]}
                      >
                        {isResending
                          ? "Reenviando..."
                          : canResend
                            ? "Reenviar"
                            : "Usar recuperación"}
                      </Text>
                    </TouchableOpacity>
                    {canCancel ? (
                      <TouchableOpacity
                        disabled={isCancelling}
                        onPress={() => void handleCancelInvitation(invitation)}
                        style={[styles.pendingActionButton, styles.pendingActionSecondary]}
                      >
                        <Text style={[styles.pendingActionText, styles.pendingActionTextSecondary]}>
                          {isCancelling ? "Cancelando..." : "Cancelar"}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

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
            const canDeleteItem =
              canUseDeleteFlow && !isSelf && item.role !== OWNER_ROLE;

            return (
              <TeamMemberCard
                key={item.id}
                employee={item}
                formatName={formatName}
                roleLabel={roleLabel}
                canEdit={canEditItem}
                canDelete={canDeleteItem}
                onEdit={() => startEdit(item)}
                onDelete={() => startDelete(item)}
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
        primarySiteLabel={normalizedPrimarySiteLabel}
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

      <TeamDeleteModal
        visible={!!deletingEmployee}
        insets={insets}
        employeeName={deletingEmployee ? formatName(deletingEmployee) : ""}
        confirmText={deleteConfirmText}
        isDeleting={isDeletingEmployee}
        onChangeConfirmText={setDeleteConfirmText}
        onClose={closeDelete}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.porcelain,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  sectionCountPill: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(226, 0, 106, 0.10)",
  },
  sectionCountText: {
    fontWeight: "800",
    color: COLORS.accent,
  },
  pendingEmptyCard: {
    marginTop: 12,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  pendingEmptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  pendingEmptyText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textMuted,
  },
  pendingCard: {
    padding: 18,
  },
  pendingHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  pendingName: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  pendingEmail: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  pendingStatusPill: {
    marginTop: 2,
  },
  pendingStatusSent: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(226, 0, 106, 0.10)",
  },
  pendingStatusExpired: {
    borderColor: "#B45309",
    backgroundColor: "#FFFBEB",
  },
  pendingStatusLinked: {
    borderColor: "#0F766E",
    backgroundColor: "#ECFEFF",
  },
  pendingStatusCancelled: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
  },
  pendingStatusText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.text,
  },
  pendingMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
  },
  pendingMetaLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  pendingMetaValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
  },
  pendingActions: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  pendingActionButton: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  pendingActionPrimary: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(226, 0, 106, 0.10)",
  },
  pendingActionDisabled: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
  },
  pendingActionSecondary: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  pendingActionText: {
    fontSize: 12,
    fontWeight: "800",
  },
  pendingActionTextPrimary: {
    color: COLORS.accent,
  },
  pendingActionTextDisabled: {
    color: COLORS.textMuted,
  },
  pendingActionTextSecondary: {
    color: COLORS.text,
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
