import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Keyboard, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { supabase } from "@/lib/supabase";
import { ANNOUNCEMENTS } from "@/components/announcements/data";
import type { Announcement } from "@/components/announcements/types";
import { getUserFacingAuthError } from "@/utils/error-messages";

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  tag: string | null;
  published_at: string | null;
  created_at: string;
};

type AnnouncementFormState = {
  title: string;
  body: string;
  tag: Announcement["tag"];
};

type SiteOption = { id: string; name: string };
type RoleOption = { code: string; name: string };

const TAG_OPTIONS: Announcement["tag"][] = ["IMPORTANTE", "INFO", "ALERTA"];

const formatDate = (iso: string | null): string => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const normalizeTag = (tag: string | null): Announcement["tag"] => {
  if (tag === "IMPORTANTE" || tag === "INFO" || tag === "ALERTA") return tag;
  return "INFO";
};

const mapRowToAnnouncement = (row: AnnouncementRow): Announcement => ({
  id: row.id,
  title: row.title,
  body: row.body,
  tag: normalizeTag(row.tag),
  date: formatDate(row.published_at ?? row.created_at),
});

type UseAnnouncementsScreenArgs = {
  canManageAnnouncements: boolean;
};

export function useAnnouncementsScreen({
  canManageAnnouncements,
}: UseAnnouncementsScreenArgs) {
  const [items, setItems] = useState<Announcement[]>(ANNOUNCEMENTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AnnouncementFormState>({
    title: "",
    body: "",
    tag: "INFO",
  });
  const [source, setSource] = useState<"remote" | "fallback">("fallback");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [isAudienceOptionsLoaded, setIsAudienceOptionsLoaded] = useState(false);
  const [formAudienceExpanded, setFormAudienceExpanded] = useState(false);
  const [formSiteIds, setFormSiteIds] = useState<string[]>([]);
  const [formRoleCodes, setFormRoleCodes] = useState<string[]>([]);

  const loadAnnouncements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, body, tag, published_at, created_at")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("published_at", { ascending: false });

      if (error) {
        if ((error as { code?: string }).code === "42P01") {
          setItems(ANNOUNCEMENTS);
          setSource("fallback");
          return;
        }
        throw error;
      }

      setItems(((data ?? []) as AnnouncementRow[]).map(mapRowToAnnouncement));
      setSource("remote");
    } catch (err) {
      console.error("[ANNOUNCEMENTS] Load error:", err);
      Alert.alert("Novedades", "No se pudieron cargar las novedades.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const loadAudienceOptions = useCallback(async () => {
    setIsAudienceOptionsLoaded(false);
    try {
      const [sitesRes, rolesRes] = await Promise.all([
        supabase
          .from("sites")
          .select("id, name")
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("roles")
          .select("code, name")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);
      if (sitesRes.data) setSites((sitesRes.data as SiteOption[]) ?? []);
      if (rolesRes.data) setRoles((rolesRes.data as RoleOption[]) ?? []);
    } catch (err) {
      console.error("[ANNOUNCEMENTS] Audience options error:", err);
    } finally {
      setIsAudienceOptionsLoaded(true);
    }
  }, []);

  const toggleFormSite = useCallback((id: string) => {
    setFormSiteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const toggleFormRole = useCallback((code: string) => {
    setFormRoleCodes((prev) =>
      prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code],
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAnnouncements();
    }, [loadAnnouncements]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void loadAnnouncements();
  }, [loadAnnouncements]);

  const subtitle = useMemo(() => {
    if (source === "fallback") {
      return "Comunicados y anuncios internos (modo local).";
    }
    return "Comunicados y anuncios internos.";
  }, [source]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setForm({
      title: "",
      body: "",
      tag: "INFO",
    });
    setFormAudienceExpanded(false);
    setFormSiteIds([]);
    setFormRoleCodes([]);
  }, []);

  const openCreate = useCallback(() => {
    resetForm();
    setIsFormOpen(true);
    void loadAudienceOptions();
  }, [loadAudienceOptions, resetForm]);

  const openEdit = useCallback((announcement: Announcement) => {
    setEditingId(announcement.id);
    setForm({
      title: announcement.title,
      body: announcement.body,
      tag: announcement.tag,
    });
    setIsFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setIsFormOpen(false);
    resetForm();
  }, [resetForm]);

  const notifyWorkers = useCallback(
    async (announcement: Announcement, opts?: { site_ids?: string[]; roles?: string[] }) => {
      const body: Record<string, unknown> = {
        announcement_id: announcement.id,
        title: announcement.title,
        body: announcement.body,
        tag: announcement.tag,
      };
      if (opts?.site_ids?.length) body.site_ids = opts.site_ids;
      if (opts?.roles?.length) body.roles = opts.roles;
      const { error } = await supabase.functions.invoke("announcement-notify", { body });
      if (error) {
        console.error("[ANNOUNCEMENTS] Notification error:", error);
        throw error;
      }
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!canManageAnnouncements) return;
    if (source === "fallback") {
      Alert.alert(
        "Novedades",
        "Activa la tabla announcements en Supabase antes de crear novedades.",
      );
      return;
    }
    if (!form.title.trim()) {
      Alert.alert("Novedades", "Escribe el titulo del anuncio.");
      return;
    }
    if (!form.body.trim()) {
      Alert.alert("Novedades", "Escribe el contenido del anuncio.");
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("announcements")
          .update({
            title: form.title.trim(),
            body: form.body.trim(),
            tag: form.tag,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("announcements")
          .insert({
            title: form.title.trim(),
            body: form.body.trim(),
            tag: form.tag,
            is_active: true,
            published_at: new Date().toISOString(),
          })
          .select("id, title, body, tag, published_at, created_at")
          .single();
        if (error) throw error;
        if (data) {
          await notifyWorkers(mapRowToAnnouncement(data as AnnouncementRow), {
            site_ids: formSiteIds.length > 0 ? formSiteIds : undefined,
            roles: formRoleCodes.length > 0 ? formRoleCodes : undefined,
          });
        }
      }

      closeForm();
      await loadAnnouncements();
    } catch (err) {
      console.error("[ANNOUNCEMENTS] Save error:", err);
      Alert.alert(
        "Novedades",
        getUserFacingAuthError(err, "No se pudo guardar la novedad."),
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    canManageAnnouncements,
    closeForm,
    editingId,
    form,
    formRoleCodes,
    formSiteIds,
    loadAnnouncements,
    notifyWorkers,
    source,
  ]);

  const handleDelete = useCallback(
    (announcement: Announcement) => {
      if (!canManageAnnouncements) return;
      Alert.alert(
        "Eliminar novedad",
        "Esta acción no se puede deshacer.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from("announcements")
                  .delete()
                  .eq("id", announcement.id);
                if (error) throw error;
                await loadAnnouncements();
              } catch (err) {
                console.error("[ANNOUNCEMENTS] Delete error:", err);
                Alert.alert(
                  "Novedades",
                  getUserFacingAuthError(err, "No se pudo eliminar la novedad."),
                );
              }
            },
          },
        ],
        { cancelable: true },
      );
    },
    [canManageAnnouncements, loadAnnouncements],
  );

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return {
    items,
    isLoading,
    isRefreshing,
    isSaving,
    isFormOpen,
    editingId,
    form,
    setForm,
    subtitle,
    keyboardHeight,
    sites,
    roles,
    isAudienceOptionsLoaded,
    formAudienceExpanded,
    setFormAudienceExpanded,
    formSiteIds,
    formRoleCodes,
    handleRefresh,
    openCreate,
    openEdit,
    closeForm,
    handleSave,
    handleDelete,
    toggleFormSite,
    toggleFormRole,
    loadAudienceOptions,
    TAG_OPTIONS,
  };
}
