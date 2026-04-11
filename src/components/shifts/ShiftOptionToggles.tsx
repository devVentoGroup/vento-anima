import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/constants/colors";

import type { ShiftFormState } from "./shift-form";

type Props = {
  form: ShiftFormState;
  showPublishToggle?: boolean;
  publishLabel: string;
  onChange: (patch: Partial<ShiftFormState>) => void;
};

export function ShiftOptionToggles({
  form,
  showPublishToggle = true,
  publishLabel,
  onChange,
}: Props) {
  return (
    <>
      {showPublishToggle ? (
        <TouchableOpacity
          onPress={() => onChange({ publishNow: !form.publishNow })}
          style={styles.checkRow}
        >
          <Ionicons
            name={form.publishNow ? "checkbox" : "square-outline"}
            size={22}
            color={form.publishNow ? COLORS.accent : COLORS.neutral}
          />
          <Text style={styles.checkLabel}>{publishLabel}</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={() => onChange({ showEndAsClose: !form.showEndAsClose })}
        style={styles.checkRow}
      >
        <Ionicons
          name={form.showEndAsClose ? "checkbox" : "square-outline"}
          size={22}
          color={form.showEndAsClose ? COLORS.accent : COLORS.neutral}
        />
        <Text style={styles.checkLabel}>Mostrar salida como "Cierre" al empleado</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() =>
          onChange({
            shiftKind: form.shiftKind === "descanso" ? "laboral" : "descanso",
          })
        }
        style={styles.checkRow}
      >
        <Ionicons
          name={form.shiftKind === "descanso" ? "checkbox" : "square-outline"}
          size={22}
          color={form.shiftKind === "descanso" ? COLORS.accent : COLORS.neutral}
        />
        <Text style={styles.checkLabel}>Marcar como turno de descanso (no laboral)</Text>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
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
});
