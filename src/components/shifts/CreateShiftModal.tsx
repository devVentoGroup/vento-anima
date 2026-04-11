import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/constants/colors";
import { CONTENT_MAX_WIDTH } from "@/constants/layout";
import { useShiftPolicy } from "@/hooks/use-shift-policy";
import { supabase } from "@/lib/supabase";
import { getUserFacingAuthError } from "@/utils/error-messages";
import { ShiftFormFields } from "./ShiftFormFields";
import { ShiftOptionToggles } from "./ShiftOptionToggles";
import type { EmployeeOption, ShiftFormState, SiteOption } from "./shift-form";
import { today, validateShiftForm } from "./shift-form";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employees: EmployeeOption[];
  sites: SiteOption[];
  currentUserId: string;
};

export function CreateShiftModal({
  visible,
  onClose,
  onSuccess,
  employees,
  sites,
  currentUserId,
}: Props) {
  const [form, setForm] = useState<ShiftFormState>({
    employeeId: "",
    siteId: "",
    shiftDate: today(),
    startTime: "08:00",
    endTime: "14:00",
    breakMinutes: "0",
    notes: "",
    publishNow: false,
    showEndAsClose: false,
    shiftKind: "laboral",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { policy: shiftPolicy, loaded: shiftPolicyLoaded } = useShiftPolicy();

  useEffect(() => {
    if (visible && sites.length > 0 && !form.siteId) {
      setForm((prev) => ({ ...prev, siteId: sites[0].id }));
    }
  }, [visible, sites, form.siteId]);

  const resetForm = useCallback(() => {
    setForm({
      employeeId: "",
      siteId: sites[0]?.id ?? "",
      shiftDate: today(),
      startTime: "08:00",
      endTime: "14:00",
      breakMinutes: "0",
      notes: "",
      publishNow: false,
      showEndAsClose: false,
      shiftKind: "laboral",
    });
  }, [sites]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const validate = (): string | null => {
    return validateShiftForm({
      form,
      maxShiftHoursPerDay: shiftPolicy.maxShiftHoursPerDay,
      policyLoaded: shiftPolicyLoaded,
    });
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      Alert.alert("Crear turno", err);
      return;
    }

    setIsSubmitting(true);
    try {
      const startTime = form.startTime.length >= 5 ? form.startTime.slice(0, 5) : form.startTime + ":00";
      const endTime = form.endTime.length >= 5 ? form.endTime.slice(0, 5) : form.endTime + ":00";
      const breakMinutes = Math.max(0, parseInt(form.breakMinutes, 10) || 0);

      const payload = {
        employee_id: form.employeeId,
        site_id: form.siteId,
        shift_date: form.shiftDate,
        start_time: startTime.length === 5 ? startTime + ":00" : startTime,
        end_time: endTime.length === 5 ? endTime + ":00" : endTime,
        break_minutes: breakMinutes,
        notes: form.notes.trim() || null,
        shift_kind: form.shiftKind,
        show_end_as_close: form.showEndAsClose,
        status: "scheduled",
        published_at: form.publishNow ? new Date().toISOString() : null,
        published_by: form.publishNow ? currentUserId : null,
      };

      const { error } = await supabase.from("employee_shifts").insert(payload);

      if (error) throw error;

      if (form.publishNow) {
        supabase.functions
          .invoke("shift-publish-notify", {
            body: {
              employee_id: form.employeeId,
              shift_date: form.shiftDate,
              start_time: startTime,
              end_time: endTime,
              type: "published",
            },
          })
          .catch((notifyError) => {
            console.warn("[CreateShiftModal] shift-publish-notify error:", notifyError);
          });
      }

      Alert.alert("Turno creado", form.publishNow ? "El turno quedó publicado para el empleado." : "Turno guardado en borrador.");
      handleClose();
      onSuccess();
    } catch (e) {
      console.error("[CreateShiftModal] Error:", e);
      Alert.alert("Crear turno", getUserFacingAuthError(e, "No se pudo crear el turno."));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Crear turno</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <ShiftFormFields
              form={form}
              employees={employees}
              sites={sites}
              onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            />

            <ShiftOptionToggles
              form={form}
              publishLabel="Publicar ya (visible para el empleado)"
              onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            />

            <View style={styles.actions}>
              <TouchableOpacity onPress={handleClose} style={styles.btnSecondary}>
                <Text style={styles.btnSecondaryText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting}
                style={[styles.btnPrimary, isSubmitting && styles.btnDisabled]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.btnPrimaryText}>Crear turno</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    maxHeight: "85%",
    backgroundColor: COLORS.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
  btnSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  btnPrimary: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.white,
  },
});
