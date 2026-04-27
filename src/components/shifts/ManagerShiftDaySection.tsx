import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/constants/colors";

import { getEmployeeName, type ManagerShiftRow } from "./use-shifts-data";
import {
  formatShiftDateLabel,
  getShiftRangeLabel,
  getShiftSiteName,
  getShiftStatusMeta,
  isUpcomingShift,
} from "./utils";

type DayGroup = {
  shiftDate: string;
  rows: ManagerShiftRow[];
};

type Props = {
  dayGroups: DayGroup[];
  expandedManagerDays: Record<string, boolean>;
  updatingShiftId: string | null;
  onToggleDay: (shiftDate: string) => void;
  onEditShift: (row: ManagerShiftRow) => void;
  onConfirmShift: (row: ManagerShiftRow) => void;
  onCancelShift: (row: ManagerShiftRow) => void;
};

export function ManagerShiftDaySection({
  dayGroups,
  expandedManagerDays,
  updatingShiftId,
  onToggleDay,
  onEditShift,
  onConfirmShift,
  onCancelShift,
}: Props) {
  if (dayGroups.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>Semana del equipo</Text>
      <Text style={styles.subtitle}>
        Turnos que puedes revisar o ajustar desde el móvil sin abrir el planner completo.
      </Text>

      {dayGroups.map(({ shiftDate, rows }) => {
        const isExpanded = expandedManagerDays[shiftDate] ?? true;
        const actionableCount = rows.filter((row) => isUpcomingShift(row)).length;

        return (
          <View key={shiftDate} style={styles.dayCard}>
            <TouchableOpacity
              onPress={() => onToggleDay(shiftDate)}
              activeOpacity={0.86}
              style={styles.dayHeader}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.dayTitle}>{formatShiftDateLabel(shiftDate)}</Text>
                <Text style={styles.dayMeta}>
                  {rows.length} turnos · {actionableCount} editables
                </Text>
              </View>
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={18}
                color={COLORS.neutral}
              />
            </TouchableOpacity>

            {isExpanded ? (
              <View style={styles.dayBody}>
                {rows.map((row) => {
                  const statusMeta = getShiftStatusMeta(row.status);
                  const canMutate =
                    isUpcomingShift(row) && (row.status === "scheduled" || row.status === "confirmed");

                  return (
                    <View key={row.id} style={styles.shiftCard}>
                      <View style={styles.shiftHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.employeeName}>{getEmployeeName(row)}</Text>
                          <Text style={styles.siteName}>{getShiftSiteName(row.sites)}</Text>
                          <Text style={styles.rangeLabel}>{getShiftRangeLabel(row)}</Text>
                        </View>

                        <View
                          style={[
                            styles.statusPill,
                            { backgroundColor: statusMeta.bg, borderColor: statusMeta.border },
                          ]}
                        >
                          <Text style={[styles.statusText, { color: statusMeta.text }]}>
                            {statusMeta.label}
                          </Text>
                        </View>
                      </View>

                      {canMutate ? (
                        <View style={styles.actionsRow}>
                          <TouchableOpacity
                            onPress={() => onEditShift(row)}
                            disabled={updatingShiftId === row.id}
                            style={[styles.actionButton, styles.editButton]}
                          >
                            <Text style={[styles.actionText, { color: COLORS.accent }]}>Editar</Text>
                          </TouchableOpacity>

                          {row.status === "scheduled" ? (
                            <TouchableOpacity
                              onPress={() => onConfirmShift(row)}
                              disabled={updatingShiftId === row.id}
                              style={[styles.actionButton, styles.confirmButton]}
                            >
                              {updatingShiftId === row.id ? (
                                <ActivityIndicator size="small" color="#047857" />
                              ) : (
                                <Text style={[styles.actionText, { color: "#047857" }]}>Confirmar</Text>
                              )}
                            </TouchableOpacity>
                          ) : null}

                          <TouchableOpacity
                            onPress={() => onCancelShift(row)}
                            disabled={updatingShiftId === row.id}
                            style={[styles.actionButton, styles.cancelButton]}
                          >
                            <Text style={[styles.actionText, { color: "#B91C1C" }]}>Cancelar</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={styles.readOnlyHint}>Turno finalizado o no editable.</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 22,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.neutral,
    marginBottom: 12,
  },
  dayCard: {
    borderRadius: 18,
    marginBottom: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  dayHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.porcelainAlt,
  },
  dayTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.text,
  },
  dayMeta: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 4,
  },
  dayBody: {
    padding: 12,
  },
  shiftCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shiftHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  siteName: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 5,
  },
  rangeLabel: {
    fontSize: 13,
    color: COLORS.text,
    marginTop: 6,
    fontWeight: "700",
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  editButton: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(226, 0, 106, 0.08)",
  },
  confirmButton: {
    borderColor: "#047857",
    backgroundColor: "#ECFDF3",
  },
  cancelButton: {
    borderColor: "#B91C1C",
    backgroundColor: "#FEF2F2",
  },
  actionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  readOnlyHint: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 12,
  },
});
