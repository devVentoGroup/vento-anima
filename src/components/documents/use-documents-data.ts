import { useCallback, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { supabase } from "@/lib/supabase";
import type {
  AvailableEmployee,
  DocumentRow,
  DocumentRowDb,
  DocumentType,
  SiteOption,
  EmployeeSiteOption,
} from "@/components/documents/types";

type UseDocumentsDataArgs = {
  userId: string | undefined;
  canManageScopes: boolean;
  canViewAllSites: boolean;
  isManager: boolean;
  employeeSiteId: string | null | undefined;
  employeeSiteName: string | null | undefined;
  managerSiteId: string | null;
  employeeSites: EmployeeSiteOption[];
  filterEmployeeId: string | null;
};

export function useDocumentsData({
  userId,
  canManageScopes,
  canViewAllSites,
  isManager,
  employeeSiteId,
  employeeSiteName,
  managerSiteId,
  employeeSites,
  filterEmployeeId,
}: UseDocumentsDataArgs) {
  const DOCUMENTS_CACHE_MS = 5000;
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [managedSites, setManagedSites] = useState<SiteOption[]>([]);
  const [availableEmployees, setAvailableEmployees] = useState<AvailableEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const loadDocumentsInFlightRef = useRef<Promise<void> | null>(null);
  const loadDocumentTypesInFlightRef = useRef<Promise<void> | null>(null);
  const loadManagedSitesInFlightRef = useRef<Promise<void> | null>(null);
  const loadAvailableEmployeesInFlightRef = useRef<Promise<void> | null>(null);
  const lastDocumentsLoadedAtRef = useRef(0);
  const lastDocumentTypesLoadedAtRef = useRef(0);
  const lastManagedSitesLoadedAtRef = useRef(0);
  const lastAvailableEmployeesLoadedAtRef = useRef(0);

  const sites = useMemo(() => {
    if (canViewAllSites && managedSites.length > 0) return managedSites;
    if (isManager && employeeSiteId) {
      return [{ id: employeeSiteId, name: employeeSiteName ?? "Sede" }];
    }
    if (employeeSites.length === 0) return [];
    return employeeSites.map((site) => ({
      id: site.siteId,
      name: site.siteName,
    }));
  }, [
    canViewAllSites,
    employeeSiteId,
    employeeSiteName,
    employeeSites,
    isManager,
    managedSites,
  ]);

  const loadDocuments = useCallback(async (opts?: { force?: boolean }) => {
    if (!userId) return;
    if (loadDocumentsInFlightRef.current) {
      await loadDocumentsInFlightRef.current;
      return;
    }
    if (!opts?.force && Date.now() - lastDocumentsLoadedAtRef.current < DOCUMENTS_CACHE_MS) return;

    const task = (async () => {
      try {
        setIsLoading(true);
        let query = supabase
          .from("documents")
          .select(
            "id, title, description, status, scope, site_id, document_type_id, issue_date, expiry_date, storage_path, file_name, updated_at, target_employee_id, document_type:document_types (id, name, scope, requires_expiry, validity_months, reminder_days, is_active)",
          )
          .order("updated_at", { ascending: false });

        if (filterEmployeeId && canManageScopes) {
          query = query.eq("target_employee_id", filterEmployeeId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const normalized = ((data as DocumentRowDb[]) ?? []).map((row) => ({
          ...row,
          document_type: Array.isArray(row.document_type)
            ? row.document_type[0] ?? null
            : row.document_type,
        }));
        setDocuments(normalized);
      } catch (err) {
        console.error("Documents error:", err);
        Alert.alert("Error", "No se pudieron cargar los documentos.");
      } finally {
        setIsLoading(false);
      }
    })();

    loadDocumentsInFlightRef.current = task;
    try {
      await task;
      lastDocumentsLoadedAtRef.current = Date.now();
    } finally {
      loadDocumentsInFlightRef.current = null;
    }
  }, [canManageScopes, filterEmployeeId, userId]);

  const loadDocumentTypes = useCallback(async (opts?: { force?: boolean }) => {
    if (!userId) return;
    if (loadDocumentTypesInFlightRef.current) {
      await loadDocumentTypesInFlightRef.current;
      return;
    }
    if (!opts?.force && Date.now() - lastDocumentTypesLoadedAtRef.current < DOCUMENTS_CACHE_MS) return;

    const task = (async () => {
      try {
        const { data, error } = await supabase
          .from("document_types")
          .select("id, name, scope, requires_expiry, validity_months, reminder_days, is_active, display_order")
          .eq("is_active", true)
          .order("display_order", { ascending: true })
          .order("name", { ascending: true });

        if (error) throw error;
        setDocumentTypes((data as DocumentType[]) ?? []);
      } catch (err) {
        console.error("Document types error:", err);
        Alert.alert("Error", "No se pudieron cargar los tipos de documento.");
      }
    })();

    loadDocumentTypesInFlightRef.current = task;
    try {
      await task;
      lastDocumentTypesLoadedAtRef.current = Date.now();
    } finally {
      loadDocumentTypesInFlightRef.current = null;
    }
  }, [userId]);

  const loadManagedSites = useCallback(async (opts?: { force?: boolean }) => {
    if (!userId || !canViewAllSites) return;
    if (loadManagedSitesInFlightRef.current) {
      await loadManagedSitesInFlightRef.current;
      return;
    }
    if (!opts?.force && Date.now() - lastManagedSitesLoadedAtRef.current < DOCUMENTS_CACHE_MS) return;

    const task = (async () => {
      try {
        const { data, error } = await supabase
          .from("sites")
          .select("id, name, is_active")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (error) throw error;
        setManagedSites((data as SiteOption[]) ?? []);
      } catch (err) {
        console.error("Sites error:", err);
      }
    })();

    loadManagedSitesInFlightRef.current = task;
    try {
      await task;
      lastManagedSitesLoadedAtRef.current = Date.now();
    } finally {
      loadManagedSitesInFlightRef.current = null;
    }
  }, [canViewAllSites, userId]);

  const loadAvailableEmployees = useCallback(async (opts?: { force?: boolean }) => {
    if (!userId || !canManageScopes) return;
    if (loadAvailableEmployeesInFlightRef.current) {
      await loadAvailableEmployeesInFlightRef.current;
      return;
    }
    if (!opts?.force && Date.now() - lastAvailableEmployeesLoadedAtRef.current < DOCUMENTS_CACHE_MS) return;

    const task = (async () => {
      try {
        let query = supabase
          .from("employees")
          .select("id, full_name")
          .eq("is_active", true)
          .order("full_name", { ascending: true });

        if (isManager && managerSiteId) {
          query = query.eq("site_id", managerSiteId);
        }

        const { data, error } = await query;
        if (error) throw error;
        setAvailableEmployees((data ?? []) as AvailableEmployee[]);
      } catch (err) {
        console.error("Employees load error:", err);
        Alert.alert("Error", "No se pudieron cargar los trabajadores.");
      }
    })();

    loadAvailableEmployeesInFlightRef.current = task;
    try {
      await task;
      lastAvailableEmployeesLoadedAtRef.current = Date.now();
    } finally {
      loadAvailableEmployeesInFlightRef.current = null;
    }
  }, [canManageScopes, isManager, managerSiteId, userId]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    lastDocumentsLoadedAtRef.current = 0;
    lastDocumentTypesLoadedAtRef.current = 0;
    await loadDocuments({ force: true });
    await loadDocumentTypes({ force: true });
    setIsRefreshing(false);
  }, [loadDocumentTypes, loadDocuments]);

  useFocusEffect(
    useCallback(() => {
      void loadDocuments();
      void loadDocumentTypes();
      void loadManagedSites();
      void loadAvailableEmployees();
    }, [loadAvailableEmployees, loadDocumentTypes, loadDocuments, loadManagedSites]),
  );

  return {
    documents,
    setDocuments,
    documentTypes,
    sites,
    availableEmployees,
    isLoading,
    isRefreshing,
    loadDocuments,
    loadDocumentTypes,
    loadAvailableEmployees,
    handleRefresh,
  };
}
