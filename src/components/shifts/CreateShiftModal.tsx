import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/constants/colors";
import { CONTENT_MAX_WIDTH } from "@/constants/layout";
import { useShiftPolicy } from "@/hooks/use-shift-policy";
import { supabase } from "@/lib/supabase";
import { getUserFacingAuthError } from "@/utils/error-messages";

export type SiteOption = { id: string; name: string };
export type EmployeeOption = { id: string; full_name: string | null };

type FormState = {
  employeeId: string;
  siteId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  notes: string;
  publishNow: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);

function toTimeInput(v: string) {
  if (!v) return "";
  const part = v.slice(0, 5);
  return part.length === 5 ? part : v;
}

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
  const [form, setForm] = useState<FormState>({
    employeeId: "",
    siteId: "",
    shiftDate: today(),
    startTime: "08:00",
    endTime: "14:00",
    breakMinutes: "0",
    notes: "",
    publishNow: false,
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
    });
  }, [sites]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const validate = (): string | null => {
    if (!form.employeeId) return "Elige un empleado.";
    if (!form.siteId) return "Elige una sede.";
    if (!form.shiftDate.trim()) return "Indica la fecha.";
    if (!form.startTime.trim()) return "Indica la hora de inicio.";
    if (!form.endTime.trim()) return "Indica la hora de fin.";
    const start = form.startTime.slice(0, 5);
    const end = form.endTime.slice(0, 5);
    if (end <= start) return "La hora de fin debe ser posterior a la de inicio.";
    const breakM = Math.max(0, parseInt(form.breakMinutes, 10) || 0);
    if (breakM > 480) return "El descanso no puede superar 8 horas.";
    if (shiftPolicyLoaded && shiftPolicy.maxShiftHoursPerDay > 0) {
      const startMs = new Date(`${form.shiftDate}T${start}`).getTime();
      const endMs = new Date(`${form.shiftDate}T${end}`).getTime();
      const durationMinutes = Math.max(0, Math.round((endMs - startMs) / 60000) - breakM);
      const durationHours = durationMinutes / 60;
      if (durationHours > shiftPolicy.maxShiftHoursPerDay) {
        return `El turno no puede superar ${shiftPolicy.maxShiftHoursPerDay} horas (según política).`;
      }
    }
    return null;
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
            <Text style={styles.label}>Empleado</Text>
            <View style={styles.chipRow}>
              {employees.map((emp) => (
                <TouchableOpacity
                  key={emp.id}
                  onPress={() => setForm((p) => ({ ...p, employeeId: emp.id }))}
                  style={[styles.chip, form.employeeId === emp.id && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, form.employeeId === emp.id && styles.chipTextActive]}
                    numberOfLines={1}
                  >
                    {emp.full_name || "Sin nombre"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {employees.length === 0 ? (
              <Text style={styles.hint}>No hay empleados en tu sede.</Text>
            ) : null}

            <Text style={styles.label}>Sede</Text>
            <View style={styles.chipRow}>
              {sites.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setForm((p) => ({ ...p, siteId: s.id }))}
                  style={[styles.chip, form.siteId === s.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, form.siteId === s.id && styles.chipTextActive]}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Fecha</Text>
            <TextInput
              value={form.shiftDate}
              onChangeText={(v) => setForm((p) => ({ ...p, shiftDate: v }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.neutral}
              style={styles.input}
            />

            <Text style={styles.label}>Hora inicio</Text>
            <TextInput
              value={form.startTime}
              onChangeText={(v) => setForm((p) => ({ ...p, startTime: toTimeInput(v) }))}
              placeholder="08:00"
              placeholderTextColor={COLORS.neutral}
              style={styles.input}
            />

            <Text style={styles.label}>Hora fin</Text>
            <TextInput
              value={form.endTime}
              onChangeText={(v) => setForm((p) => ({ ...p, endTime: toTimeInput(v) }))}
              placeholder="14:00"
              placeholderTextColor={COLORS.neutral}
              style={styles.input}
            />

            <Text style={styles.label}>Descanso (min)</Text>
            <TextInput
              value={form.breakMinutes}
              onChangeText={(v) => setForm((p) => ({ ...p, breakMinutes: v }))}
              placeholder="0"
              placeholderTextColor={COLORS.neutral}
              keyboardType="number-pad"
              style={styles.input}
            />

            <Text style={styles.label}>Notas (opcional)</Text>
            <TextInput
              value={form.notes}
              onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))}
              placeholder="Notas del turno"
              placeholderTextColor={COLORS.neutral}
              style={[styles.input, styles.inputMultiline]}
              multiline
            />

            <TouchableOpacity
              onPress={() => setForm((p) => ({ ...p, publishNow: !p.publishNow }))}
              style={styles.checkRow}
            >
              <Ionicons
                name={form.publishNow ? "checkbox" : "square-outline"}
                size={22}
                color={form.publishNow ? COLORS.accent : COLORS.neutral}
              />
              <Text style={styles.checkLabel}>Publicar ya (visible para el empleado)</Text>
            </TouchableOpacity>

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
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
  },
  chipActive: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(226, 0, 106, 0.12)",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  chipTextActive: {
    color: COLORS.accent,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },
  checkLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
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
