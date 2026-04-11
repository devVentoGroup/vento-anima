import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/constants/colors";
import { TEAM_UI } from "@/components/team/ui";
import type { InviteFormState } from "@/components/team/types";

type TeamInviteFormFieldsProps = {
  styles: Record<string, any>;
  form: InviteFormState;
  inviteEmailSent: string | null;
  inviteSuccessMessage?: string | null;
  isInviting: boolean;
  canPickSites: boolean;
  inviteRoleLabel: string | null;
  inviteSiteLabel: string | null;
  onClose: () => void;
  onSubmit: () => void;
  onOpenPicker: (picker: "inviteRole" | "inviteSite") => void;
  onUpdateForm: (patch: Partial<InviteFormState>) => void;
};

export function TeamInviteFormFields({
  styles,
  form,
  inviteEmailSent,
  inviteSuccessMessage = null,
  isInviting,
  canPickSites,
  inviteRoleLabel,
  inviteSiteLabel,
  onClose,
  onSubmit,
  onOpenPicker,
  onUpdateForm,
}: TeamInviteFormFieldsProps) {
  const hasInvite = Boolean(inviteEmailSent);

  return (
    <>
      <Text style={styles.modalTitle}>Invitar trabajador</Text>
      <Text style={styles.modalSubtitle}>
        Si no tiene cuenta, le enviaremos un correo con el enlace para crearla. Si ya
        tiene cuenta (ej. en Vento Pass), se agregará al equipo y podrá entrar con su
        correo y contraseña.
      </Text>

      <Text style={styles.modalLabel}>Correo</Text>
      <TextInput
        value={form.email}
        onChangeText={(value) => onUpdateForm({ email: value })}
        placeholder="correo@empresa.com"
        placeholderTextColor={COLORS.neutral}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <Text style={styles.modalLabel}>Nombre completo</Text>
      <TextInput
        value={form.fullName}
        onChangeText={(value) => onUpdateForm({ fullName: value })}
        placeholder="Nombre completo"
        placeholderTextColor={COLORS.neutral}
        style={styles.input}
      />

      <Text style={styles.modalLabel}>Rol</Text>
      <TouchableOpacity
        onPress={() => onOpenPicker("inviteRole")}
        style={[
          TEAM_UI.chip,
          {
            borderColor: COLORS.border,
            backgroundColor: COLORS.porcelainAlt,
            marginTop: 6,
          },
        ]}
      >
        <View style={styles.selectRow}>
          <Text style={styles.selectText}>
            {inviteRoleLabel ?? "Selecciona un rol"}
          </Text>
          <Ionicons name="chevron-down" size={16} color={COLORS.neutral} />
        </View>
      </TouchableOpacity>

      <Text style={styles.modalLabel}>Sede principal</Text>
      <TouchableOpacity
        onPress={canPickSites ? () => onOpenPicker("inviteSite") : undefined}
        disabled={!canPickSites}
        style={[
          TEAM_UI.chip,
          {
            borderColor: COLORS.border,
            backgroundColor: COLORS.porcelainAlt,
            marginTop: 6,
            opacity: canPickSites ? 1 : 0.6,
          },
        ]}
      >
        <View style={styles.selectRow}>
          <Text style={styles.selectText}>
            {inviteSiteLabel ?? "Selecciona la sede"}
          </Text>
          <Ionicons name="chevron-down" size={16} color={COLORS.neutral} />
        </View>
      </TouchableOpacity>

      <Text style={styles.modalLabel}>Expira</Text>
      <TextInput
        value={form.expiresAt}
        onChangeText={(value) => onUpdateForm({ expiresAt: value })}
        placeholder="Opcional, ej. 2026-03-20"
        placeholderTextColor={COLORS.neutral}
        style={styles.input}
        keyboardType="numbers-and-punctuation"
      />

      {hasInvite ? (
        <View style={styles.successBox}>
          <Text style={styles.successTitle}>
            {inviteSuccessMessage ? "Agregado al equipo" : "Invitacion enviada"}
          </Text>
          <Text style={styles.modalHint}>
            {inviteSuccessMessage ?? `Correo enviado a ${inviteEmailSent}.`}
          </Text>
        </View>
      ) : null}

      <View style={styles.modalActions}>
        <TouchableOpacity
          onPress={onClose}
          style={[
            TEAM_UI.chip,
            {
              borderColor: COLORS.border,
              backgroundColor: COLORS.porcelainAlt,
            },
          ]}
        >
          <Text style={styles.cancelText}>{hasInvite ? "Cerrar" : "Cancelar"}</Text>
        </TouchableOpacity>
        {!hasInvite ? (
          <TouchableOpacity
            onPress={onSubmit}
            disabled={isInviting}
            style={[
              TEAM_UI.chip,
              {
                borderColor: COLORS.rosegold,
                backgroundColor: "rgba(242, 198, 192, 0.25)",
                opacity: isInviting ? 0.7 : 1,
              },
            ]}
          >
            <Text style={styles.saveText}>
              {isInviting ? "Enviando..." : "Enviar invitación"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );
}
