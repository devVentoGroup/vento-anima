import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { COLORS } from "@/constants/colors";

import type {
  EmployeeOption,
  ShiftFormState,
  SiteOption,
} from "./shift-form";
import { toTimeInput } from "./shift-form";

type Props = {
  form: ShiftFormState;
  employees: EmployeeOption[];
  sites: SiteOption[];
  employeeHint?: string | null;
  showBreakMinutesField?: boolean;
  onChange: (patch: Partial<ShiftFormState>) => void;
};

export function ShiftFormFields({
  form,
  employees,
  sites,
  employeeHint,
  showBreakMinutesField = false,
  onChange,
}: Props) {
  return (
    <>
      <Text style={styles.label}>Empleado</Text>
      {employeeHint ? <Text style={styles.hint}>{employeeHint}</Text> : null}
      <View style={styles.chipRow}>
        {employees.map((emp) => (
          <TouchableOpacity
            key={emp.id}
            onPress={() => onChange({ employeeId: emp.id })}
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
        {sites.map((site) => (
          <TouchableOpacity
            key={site.id}
            onPress={() => onChange({ siteId: site.id })}
            style={[styles.chip, form.siteId === site.id && styles.chipActive]}
          >
            <Text
              style={[styles.chipText, form.siteId === site.id && styles.chipTextActive]}
            >
              {site.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Fecha</Text>
      <TextInput
        value={form.shiftDate}
        onChangeText={(shiftDate) => onChange({ shiftDate })}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={COLORS.neutral}
        style={styles.input}
      />

      <Text style={styles.label}>Hora inicio</Text>
      <TextInput
        value={form.startTime}
        onChangeText={(startTime) => onChange({ startTime: toTimeInput(startTime) })}
        placeholder="08:00"
        placeholderTextColor={COLORS.neutral}
        style={styles.input}
      />

      <Text style={styles.label}>Hora fin</Text>
      <TextInput
        value={form.endTime}
        onChangeText={(endTime) => onChange({ endTime: toTimeInput(endTime) })}
        placeholder="14:00"
        placeholderTextColor={COLORS.neutral}
        style={styles.input}
      />

      {showBreakMinutesField ? (
        <>
          <Text style={styles.label}>Descanso (min)</Text>
          <TextInput
            value={form.breakMinutes}
            onChangeText={(breakMinutes) => onChange({ breakMinutes })}
            placeholder="0"
            placeholderTextColor={COLORS.neutral}
            keyboardType="number-pad"
            style={styles.input}
          />
        </>
      ) : null}

      <Text style={styles.label}>Notas (opcional)</Text>
      <TextInput
        value={form.notes}
        onChangeText={(notes) => onChange({ notes })}
        placeholder="Notas del turno"
        placeholderTextColor={COLORS.neutral}
        style={[styles.input, styles.inputMultiline]}
        multiline
      />
    </>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 8,
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
});
