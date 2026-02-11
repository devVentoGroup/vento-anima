import { useCallback, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"

import { COLORS } from "@/constants/colors"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"
import { ANNOUNCEMENTS } from "@/components/announcements/data"
import AnnouncementCard from "@/components/announcements/AnnouncementCard"
import type { Announcement } from "@/components/announcements/types"
import { ANNOUNCEMENTS_UI } from "@/components/announcements/ui"
import { getUserFacingAuthError } from "@/utils/error-messages"

type AnnouncementRow = {
  id: string
  title: string
  body: string
  tag: string | null
  published_at: string | null
  created_at: string
}

type AnnouncementFormState = {
  title: string
  body: string
  tag: Announcement["tag"]
}

const TAG_OPTIONS: Announcement["tag"][] = ["IMPORTANTE", "INFO", "ALERTA"]

const formatDate = (iso: string | null): string => {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const normalizeTag = (tag: string | null): Announcement["tag"] => {
  if (tag === "IMPORTANTE" || tag === "INFO" || tag === "ALERTA") return tag
  return "INFO"
}

const mapRowToAnnouncement = (row: AnnouncementRow): Announcement => ({
  id: row.id,
  title: row.title,
  body: row.body,
  tag: normalizeTag(row.tag),
  date: formatDate(row.published_at ?? row.created_at),
})

export default function AnnouncementsScreen() {
  const insets = useSafeAreaInsets()
  const { employee } = useAuth()
  const [items, setItems] = useState<Announcement[]>(ANNOUNCEMENTS)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AnnouncementFormState>({
    title: "",
    body: "",
    tag: "INFO",
  })
  const [source, setSource] = useState<"remote" | "fallback">("fallback")
  const canManageAnnouncements = useMemo(() => {
    const role = employee?.role ?? null
    return (
      role === "propietario" || role === "gerente_general" || role === "gerente"
    )
  }, [employee?.role])

  const loadAnnouncements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, body, tag, published_at, created_at")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("published_at", { ascending: false })

      if (error) {
        // Si la tabla no existe en un entorno, usamos fallback local para no romper la pantalla.
        if ((error as { code?: string }).code === "42P01") {
          setItems(ANNOUNCEMENTS)
          setSource("fallback")
          return
        }
        throw error
      }

      const mapped = ((data ?? []) as AnnouncementRow[]).map(mapRowToAnnouncement)

      setItems(mapped)
      setSource("remote")
    } catch (err) {
      console.error("[ANNOUNCEMENTS] Load error:", err)
      Alert.alert("Novedades", "No se pudieron cargar las novedades.")
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void loadAnnouncements()
    }, [loadAnnouncements]),
  )

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true)
    void loadAnnouncements()
  }, [loadAnnouncements])

  const subtitle = useMemo(() => {
    if (source === "fallback") {
      return "Comunicados y anuncios internos (modo local)."
    }
    return "Comunicados y anuncios internos."
  }, [source])

  const resetForm = () => {
    setEditingId(null)
    setForm({
      title: "",
      body: "",
      tag: "INFO",
    })
  }

  const openCreate = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const openEdit = (announcement: Announcement) => {
    setEditingId(announcement.id)
    setForm({
      title: announcement.title,
      body: announcement.body,
      tag: announcement.tag,
    })
    setIsFormOpen(true)
  }

  const closeForm = () => {
    setIsFormOpen(false)
    resetForm()
  }

  const notifyWorkers = async (announcement: Announcement) => {
    const { error } = await supabase.functions.invoke("announcement-notify", {
      body: {
        announcement_id: announcement.id,
        title: announcement.title,
        body: announcement.body,
        tag: announcement.tag,
      },
    })
    if (error) {
      console.error("[ANNOUNCEMENTS] Notification error:", error)
    }
  }

  const handleSave = async () => {
    if (!canManageAnnouncements) return
    if (source === "fallback") {
      Alert.alert(
        "Novedades",
        "Activa la tabla announcements en Supabase antes de crear novedades.",
      )
      return
    }
    if (!form.title.trim()) {
      Alert.alert("Novedades", "Escribe el titulo del anuncio.")
      return
    }
    if (!form.body.trim()) {
      Alert.alert("Novedades", "Escribe el contenido del anuncio.")
      return
    }

    setIsSaving(true)
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
          .eq("id", editingId)
        if (error) throw error
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
          .single()
        if (error) throw error
        if (data) {
          await notifyWorkers(mapRowToAnnouncement(data as AnnouncementRow))
        }
      }

      closeForm()
      await loadAnnouncements()
    } catch (err) {
      console.error("[ANNOUNCEMENTS] Save error:", err)
      Alert.alert(
        "Novedades",
        getUserFacingAuthError(err, "No se pudo guardar la novedad."),
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = (announcement: Announcement) => {
    if (!canManageAnnouncements) return
    Alert.alert(
      "Eliminar novedad",
      "Esta accion no se puede deshacer.",
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
                .eq("id", announcement.id)
              if (error) throw error
              await loadAnnouncements()
            } catch (err) {
              console.error("[ANNOUNCEMENTS] Delete error:", err)
              Alert.alert(
                "Novedades",
                getUserFacingAuthError(err, "No se pudo eliminar la novedad."),
              )
            }
          },
        },
      ],
      { cancelable: true },
    )
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Math.max(16, insets.top + 8),
          paddingBottom: 40,
        }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <Text style={styles.title}>Novedades</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {canManageAnnouncements ? (
          <TouchableOpacity
            onPress={openCreate}
            style={[
              ANNOUNCEMENTS_UI.card,
              styles.createButton,
            ]}
          >
            <Ionicons name="add-circle-outline" size={18} color={COLORS.accent} />
            <Text style={styles.createButtonText}>Nueva novedad</Text>
          </TouchableOpacity>
        ) : null}

        {isLoading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        ) : null}

        {!isLoading && items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin novedades por ahora</Text>
            <Text style={styles.emptySubtitle}>
              Cuando publiquemos nuevos comunicados, apareceran aqui.
            </Text>
          </View>
        ) : null}

        <View style={{ marginTop: 18, gap: 12 }}>
          {items.map((item) => (
            <View key={item.id}>
              <AnnouncementCard announcement={item} />
              {canManageAnnouncements ? (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    onPress={() => openEdit(item)}
                    style={[ANNOUNCEMENTS_UI.tag, styles.actionChip]}
                  >
                    <Text style={styles.actionText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    style={[ANNOUNCEMENTS_UI.tag, styles.actionChipDanger]}
                  >
                    <Text style={styles.actionTextDanger}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal transparent visible={isFormOpen} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={closeForm}>
          <Pressable
            style={styles.modalCard}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.modalTitle}>
              {editingId ? "Editar novedad" : "Nueva novedad"}
            </Text>
            <TextInput
              value={form.title}
              onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
              placeholder="Titulo"
              placeholderTextColor={COLORS.neutral}
              style={styles.input}
            />
            <TextInput
              value={form.body}
              onChangeText={(value) => setForm((prev) => ({ ...prev, body: value }))}
              placeholder="Contenido"
              placeholderTextColor={COLORS.neutral}
              multiline
              style={[styles.input, styles.multilineInput]}
            />
            <View style={styles.tagsRow}>
              {TAG_OPTIONS.map((tag) => {
                const active = form.tag === tag
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => setForm((prev) => ({ ...prev, tag }))}
                    style={[
                      ANNOUNCEMENTS_UI.tag,
                      active ? styles.tagActive : styles.tagInactive,
                    ]}
                  >
                    <Text style={active ? styles.tagTextActive : styles.tagTextInactive}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={closeForm} style={[ANNOUNCEMENTS_UI.tag, styles.cancelChip]}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                style={[ANNOUNCEMENTS_UI.tag, styles.saveChip, isSaving ? styles.saveChipDisabled : null]}
              >
                <Text style={styles.saveText}>{isSaving ? "Guardando..." : "Guardar"}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
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
  centerWrap: {
    paddingTop: 24,
    alignItems: "center",
  },
  emptyCard: {
    marginTop: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 14,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.neutral,
  },
  createButton: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderColor: COLORS.accent,
    borderWidth: 1,
  },
  createButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.accent,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 8,
    marginRight: 2,
  },
  actionChip: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  actionChipDanger: {
    borderColor: COLORS.rosegold,
    backgroundColor: "rgba(217, 142, 150, 0.1)",
  },
  actionText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text,
  },
  actionTextDanger: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.rosegold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
  },
  input: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    padding: 12,
    color: COLORS.text,
  },
  multilineInput: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  tagsRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  tagActive: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(226, 0, 106, 0.12)",
  },
  tagInactive: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  tagTextActive: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.accent,
  },
  tagTextInactive: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text,
  },
  modalActions: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  cancelChip: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
  },
  saveChip: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(226, 0, 106, 0.12)",
  },
  saveChipDisabled: {
    opacity: 0.6,
  },
  cancelText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
  },
  saveText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.accent,
  },
})
