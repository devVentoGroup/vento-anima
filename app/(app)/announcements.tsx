import { useMemo } from "react"
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"

import { COLORS } from "@/constants/colors"
import {
  CONTENT_HORIZONTAL_PADDING,
  CONTENT_MAX_WIDTH,
  MODAL_MAX_WIDTH,
} from "@/constants/layout"
import { useAuth } from "@/contexts/auth-context"
import AnnouncementCard from "@/components/announcements/AnnouncementCard"
import { useAnnouncementsScreen } from "@/components/announcements/use-announcements-screen"
import type { Announcement } from "@/components/announcements/types"
import { ANNOUNCEMENTS_UI } from "@/components/announcements/ui"

export default function AnnouncementsScreen() {
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const { employee } = useAuth()
  const canManageAnnouncements = useMemo(() => {
    const role = employee?.role ?? null
    return (
      role === "propietario" || role === "gerente_general" || role === "gerente"
    )
  }, [employee?.role])
  const {
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
  } = useAnnouncementsScreen({
    canManageAnnouncements,
  })
  const isKeyboardVisible = keyboardHeight > 0
  const modalTopGap = Math.max(14, insets.top + 8)
  const modalBottomGap = 20
  const modalMaxHeight = isKeyboardVisible
    ? Math.max(220, windowHeight - keyboardHeight - modalTopGap - modalBottomGap)
    : Math.max(320, windowHeight - modalBottomGap * 2)

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          alignSelf: "center",
          width: "100%",
          maxWidth: CONTENT_MAX_WIDTH,
          paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
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
              Cuando publiquemos nuevos comunicados, aparecerán aquí.
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
        <Pressable
          style={[
            styles.modalOverlay,
            isKeyboardVisible ? styles.modalOverlayKeyboard : styles.modalOverlayCentered,
            { paddingTop: isKeyboardVisible ? modalTopGap : 20, paddingBottom: 20 },
          ]}
          onPress={closeForm}
        >
          <View style={styles.keyboardWrap}>
            <Pressable
              style={[styles.modalCard, { maxHeight: modalMaxHeight }]}
              onPress={(event) => event.stopPropagation()}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.modalScrollContent}
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
                {!editingId ? (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        setFormAudienceExpanded((prev) => !prev)
                        if (!formAudienceExpanded && !isAudienceOptionsLoaded) void loadAudienceOptions()
                      }}
                      style={[ANNOUNCEMENTS_UI.tag, styles.audienceToggle]}
                    >
                      <Ionicons
                        name={formAudienceExpanded ? "chevron-down" : "chevron-forward"}
                        size={16}
                        color={COLORS.accent}
                      />
                      <Text style={styles.audienceToggleText}>Seleccionar sede o trabajador</Text>
                    </TouchableOpacity>
                    {formAudienceExpanded ? (
                      <View style={styles.formAudienceSection}>
                        <Text style={styles.notifyAudienceHint}>
                          Opcional. Sin marcar = se envía a todos.
                        </Text>
                        {!isAudienceOptionsLoaded ? (
                          <Text style={styles.audienceLoadingText}>Cargando...</Text>
                        ) : (
                          <>
                            {sites.length > 0 ? (
                              <View style={styles.notifySection}>
                                <Text style={styles.notifySectionTitle}>Por sede</Text>
                                <View style={styles.notifyChips}>
                                  {sites.map((s) => (
                                    <TouchableOpacity
                                      key={s.id}
                                      onPress={() => toggleFormSite(s.id)}
                                      style={[
                                        ANNOUNCEMENTS_UI.tag,
                                        formSiteIds.includes(s.id) ? styles.tagActive : styles.tagInactive,
                                      ]}
                                    >
                                      <Text
                                        style={
                                          formSiteIds.includes(s.id) ? styles.tagTextActive : styles.tagTextInactive
                                        }
                                      >
                                        {s.name}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                            ) : null}
                            {roles.length > 0 ? (
                              <View style={styles.notifySection}>
                                <Text style={styles.notifySectionTitle}>Por rol</Text>
                                <View style={styles.notifyChips}>
                                  {roles.map((r) => (
                                    <TouchableOpacity
                                      key={r.code}
                                      onPress={() => toggleFormRole(r.code)}
                                      style={[
                                        ANNOUNCEMENTS_UI.tag,
                                        formRoleCodes.includes(r.code) ? styles.tagActive : styles.tagInactive,
                                      ]}
                                    >
                                      <Text
                                        style={
                                          formRoleCodes.includes(r.code) ? styles.tagTextActive : styles.tagTextInactive
                                        }
                                      >
                                        {r.name}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                            ) : null}
                          </>
                        )}
                      </View>
                    ) : null}
                  </>
                ) : null}
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
              </ScrollView>
            </Pressable>
          </View>
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
  actionChipNotify: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(226, 0, 106, 0.08)",
  },
  actionTextNotify: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.accent,
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
  },
  modalOverlayCentered: {
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalOverlayKeyboard: {
    justifyContent: "flex-start",
    paddingHorizontal: 20,
  },
  keyboardWrap: {
    width: "100%",
    maxWidth: MODAL_MAX_WIDTH,
    alignSelf: "center",
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  modalScrollContent: {
    paddingBottom: 4,
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
    flexWrap: "wrap",
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
  audienceToggle: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderColor: COLORS.accent,
    backgroundColor: "rgba(226, 0, 106, 0.08)",
  },
  audienceToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.accent,
  },
  formAudienceSection: {
    marginTop: 10,
  },
  audienceLoadingText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.neutral,
  },
  notifyAudienceHint: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.neutral,
  },
  notifySection: {
    marginTop: 10,
  },
  notifySectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
  },
  notifyChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
})
