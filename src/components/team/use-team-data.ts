import { useCallback, useState } from "react";

import { useFocusEffect } from "@react-navigation/native";
import { Alert } from "react-native";

import { supabase } from "@/lib/supabase";
import type { EmployeeRow, RoleRow, SiteRow } from "@/components/team/types";

type EmployeeRowDb = Omit<EmployeeRow, "sites"> & {
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

export type { StaffInvitationRow };

type UseTeamDataArgs = {
  userId: string | null | undefined;
  canViewTeam: boolean;
  isManager: boolean;
  managerSiteId: string | null;
};

export function useTeamData({
  userId,
  canViewTeam,
  isManager,
  managerSiteId,
}: UseTeamDataArgs) {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<StaffInvitationRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);

  const loadEmployees = useCallback(async () => {
    if (!userId) return;
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
  }, [userId, isManager, managerSiteId]);

  const loadSites = useCallback(async () => {
    if (!userId) return;
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
  }, [userId, isManager, managerSiteId]);

  const loadRoles = useCallback(async () => {
    if (!userId) return;
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
  }, [userId]);

  const loadInvitations = useCallback(async () => {
    if (!userId) return;

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
  }, [userId, isManager, managerSiteId]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadEmployees(), loadSites(), loadRoles(), loadInvitations()]);
  }, [loadEmployees, loadSites, loadRoles, loadInvitations]);

  useFocusEffect(
    useCallback(() => {
      if (!canViewTeam) return;
      void loadAll();
    }, [canViewTeam, loadAll]),
  );

  const handleRefresh = useCallback(async () => {
    if (!canViewTeam) return;
    setIsRefreshing(true);
    await loadAll();
    setIsRefreshing(false);
  }, [canViewTeam, loadAll]);

  return {
    employees,
    setEmployees,
    sites,
    setSites,
    roles,
    setRoles,
    pendingInvitations,
    setPendingInvitations,
    isLoading,
    isRefreshing,
    isLoadingInvitations,
    loadEmployees,
    loadSites,
    loadRoles,
    loadInvitations,
    loadAll,
    handleRefresh,
  };
}
