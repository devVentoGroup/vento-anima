import { useCallback, useState } from "react";

import { Alert } from "react-native";

import { ANIMA_COPY } from "@/brand/anima/copy/app-copy";
import { supabase } from "@/lib/supabase";
import { getUserFacingAuthError } from "@/utils/error-messages";
import type { InviteFormState, SiteRow } from "@/components/team/types";
import type { StaffInvitationRow } from "@/components/team/use-team-data";

type UseTeamInvitationsArgs = {
  canManageTeam: boolean;
  canAssignRole: (targetRole: string) => boolean;
  isManager: boolean;
  managerSiteId: string | null;
  selectedSiteId: string | null;
  employeeSiteId: string | null | undefined;
  sites: SiteRow[];
  loadInvitations: () => Promise<void>;
};

export function useTeamInvitations({
  canManageTeam,
  canAssignRole,
  isManager,
  managerSiteId,
  selectedSiteId,
  employeeSiteId,
  sites,
  loadInvitations,
}: UseTeamInvitationsArgs) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteEmailSent, setInviteEmailSent] = useState<string | null>(null);
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState<InviteFormState>({
    email: "",
    fullName: "",
    role: "",
    siteId: null,
    expiresAt: "",
  });
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);
  const [cancellingInvitationId, setCancellingInvitationId] = useState<string | null>(null);

  const updateInviteForm = useCallback((patch: Partial<InviteFormState>) => {
    setInviteForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const getInviteErrorMessage = useCallback((error: unknown, fallback: string) => {
    const parsed =
      error && typeof error === "object"
        ? (error as { message?: string; context?: unknown; details?: string })
        : {};

    const context = typeof parsed.context === "string" ? parsed.context : "";
    const details = typeof parsed.details === "string" ? parsed.details : "";
    const raw = [parsed.message, context, details]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(" ");

    const normalized = raw.toLowerCase();
    if (
      normalized.includes("forbidden role") ||
      normalized.includes("forbidden site") ||
      normalized.includes("invalid role") ||
      normalized.includes("invalid site")
    ) {
      return "La invitación no es válida para el rol o la sede seleccionada.";
    }
    if (normalized.includes("already registered")) {
      return "Ese correo ya existe en el sistema, pero no se pudo vincular automáticamente al equipo.";
    }
    if (normalized.includes("no se pudo enviar el correo")) {
      return "No se pudo enviar el correo de invitación.";
    }
    if (
      normalized.includes("resend_api_key") ||
      normalized.includes("set_password_web_url") ||
      normalized.includes("redirect_url")
    ) {
      return "Falta configuración de invitaciones en el backend.";
    }

    return getUserFacingAuthError(error, raw || fallback);
  }, []);

  const openInvite = useCallback(() => {
    if (!canManageTeam) return;
    const defaultSite = isManager
      ? managerSiteId
      : selectedSiteId ?? employeeSiteId ?? sites[0]?.id ?? null;
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
  }, [canManageTeam, employeeSiteId, isManager, managerSiteId, selectedSiteId, sites]);

  const closeInvite = useCallback(() => {
    setIsInviteOpen(false);
    setInviteEmailSent(null);
    setInviteSuccessMessage(null);
  }, []);

  const handleInvite = useCallback(async () => {
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
          getInviteErrorMessage(
            error,
            "No se pudo procesar la invitación. Intenta nuevamente.",
          ),
        );
        return;
      }
      if ((data as { error?: string; details?: string })?.error) {
        const payload = data as { error?: string; details?: string };
        Alert.alert(
          "Equipo",
          getInviteErrorMessage(
            {
              message: payload.error,
              details: payload.details,
            },
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
        getInviteErrorMessage(
          err,
          "No se pudo procesar la invitación. Intenta nuevamente.",
        ),
      );
    } finally {
      setIsInviting(false);
    }
  }, [canAssignRole, canManageTeam, getInviteErrorMessage, inviteForm, isManager, loadInvitations, managerSiteId]);

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
    if (status === "expired") return "Vencida";
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
          ANIMA_COPY.teamExistingUserNeedsPasswordBody,
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

  return {
    isInviteOpen,
    isInviting,
    inviteEmailSent,
    inviteSuccessMessage,
    inviteForm,
    resendingInvitationId,
    cancellingInvitationId,
    updateInviteForm,
    openInvite,
    closeInvite,
    handleInvite,
    getEffectiveInvitationStatus,
    getInvitationStatusLabel,
    formatInvitationDate,
    handleResendInvitation,
    handleCancelInvitation,
  };
}
