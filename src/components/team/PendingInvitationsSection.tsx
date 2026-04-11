import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "@/constants/colors";
import { TEAM_UI } from "@/components/team/ui";
import type { SiteRow } from "@/components/team/types";
import type { StaffInvitationRow } from "@/components/team/use-team-data";

type PendingInvitationsSectionProps = {
  pendingInvitations: StaffInvitationRow[];
  sites: SiteRow[];
  isLoadingInvitations: boolean;
  resendingInvitationId: string | null;
  cancellingInvitationId: string | null;
  roleLabel: (code: string) => string;
  getEffectiveInvitationStatus: (invitation: StaffInvitationRow) => string;
  getInvitationStatusLabel: (status: string) => string;
  formatInvitationDate: (value: string | null) => string;
  onResendInvitation: (invitation: StaffInvitationRow) => void | Promise<void>;
  onCancelInvitation: (invitation: StaffInvitationRow) => void | Promise<void>;
};

const UI = TEAM_UI;

export default function PendingInvitationsSection({
  pendingInvitations,
  sites,
  isLoadingInvitations,
  resendingInvitationId,
  cancellingInvitationId,
  roleLabel,
  getEffectiveInvitationStatus,
  getInvitationStatusLabel,
  formatInvitationDate,
  onResendInvitation,
  onCancelInvitation,
}: PendingInvitationsSectionProps) {
  return (
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
          const siteName = invitationSiteId
            ? sites.find((site) => site.id === invitationSiteId)?.name ?? "Sede"
            : "Sin sede";
          const isLinkedExisting = effectiveStatus === "linked_existing_user";
          const canResend = !isLinkedExisting && effectiveStatus !== "cancelled";
          const canCancel = effectiveStatus === "sent" || effectiveStatus === "expired";
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
                  onPress={() => void onResendInvitation(invitation)}
                  style={[
                    styles.pendingActionButton,
                    canResend ? styles.pendingActionPrimary : styles.pendingActionDisabled,
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
                    onPress={() => void onCancelInvitation(invitation)}
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
  );
}

const styles = StyleSheet.create({
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
});
