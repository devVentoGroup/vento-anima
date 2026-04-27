import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/constants/colors";

import {
  formatShiftDateLabel,
  formatShiftShortDate,
  getShiftRangeLabel,
  getShiftSiteName,
  type ShiftRow,
} from "./utils";

type Props = {
  canManageShifts: boolean;
  nextShift: ShiftRow | null;
  upcomingCount: number;
  onCreateShift: () => void;
};

export function ShiftsHeroCard({
  canManageShifts,
  nextShift,
  upcomingCount,
  onCreateShift,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>MIS TURNOS</Text>
      <Text style={styles.title}>Tu horario programado</Text>
      <Text style={styles.copy}>
        Consulta tu semana completa y, si gestionas una sede, revisa también los turnos del
        equipo sin ir al planner web.
      </Text>

      {canManageShifts ? (
        <TouchableOpacity onPress={onCreateShift} style={styles.createButton}>
          <Ionicons name="add-circle-outline" size={20} color={COLORS.accent} />
          <Text style={styles.createButtonText}>Crear turno</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Próximo turno</Text>
          <Text style={styles.metricValue}>
            {nextShift ? formatShiftShortDate(nextShift.shift_date) : "Sin asignar"}
          </Text>
          <Text style={styles.metricHint}>
            {nextShift ? getShiftRangeLabel(nextShift) : "Todavía no tienes turnos próximos"}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Turnos próximos</Text>
          <Text style={styles.metricValue}>{upcomingCount}</Text>
          <Text style={styles.metricHint}>Programados o confirmados</Text>
        </View>
      </View>

      {nextShift ? (
        <View style={styles.nextShiftHighlight}>
          <View style={styles.nextShiftHeader}>
            <Text style={styles.nextShiftEyebrow}>SIGUIENTE ENTRADA</Text>
            <Ionicons name="calendar-clear-outline" size={18} color={COLORS.accent} />
          </View>
          <Text style={styles.nextShiftTitle}>{formatShiftDateLabel(nextShift.shift_date)}</Text>
          <Text style={styles.nextShiftMeta}>
            {getShiftRangeLabel(nextShift)} · {getShiftSiteName(nextShift.sites)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    borderRadius: 24,
    padding: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.accent,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.text,
    marginTop: 8,
  },
  copy: {
    fontSize: 13,
    color: COLORS.neutral,
    marginTop: 8,
    lineHeight: 19,
  },
  createButton: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: "rgba(226, 0, 106, 0.08)",
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.accent,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: COLORS.porcelainAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metricLabel: {
    fontSize: 12,
    color: COLORS.neutral,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
    marginTop: 8,
  },
  metricHint: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 4,
  },
  nextShiftHighlight: {
    marginTop: 16,
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#FFF1F7",
    borderWidth: 1,
    borderColor: "#FBCFE8",
  },
  nextShiftHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nextShiftEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.accent,
  },
  nextShiftTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
    marginTop: 8,
  },
  nextShiftMeta: {
    fontSize: 15,
    color: COLORS.text,
    marginTop: 8,
  },
});
