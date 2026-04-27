import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { COLORS } from "@/constants/colors";

import {
  formatShiftMinutes,
  formatShiftShortDate,
  getShiftDurationMinutes,
  formatShiftTime,
  getShiftStatusMeta,
  getShiftSiteName,
  type ShiftRow,
} from "./utils";
import { getEmployeeName, type ManagerShiftRow } from "./use-shifts-data";

type WeekDayGroup<T> = {
  date: string;
  label: string;
  items: T[];
};

type Props = {
  title: string;
  subtitle: string;
  days: WeekDayGroup<ShiftRow | ManagerShiftRow>[];
  mode: "personal" | "site";
};

function isToday(value: string) {
  return value === new Date().toISOString().slice(0, 10);
}

export function WeeklyShiftsSection({ title, subtitle, days, mode }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {days.map((day) => (
        <View
          key={day.date}
          style={[styles.dayCard, isToday(day.date) ? styles.dayCardToday : null]}
        >
          <View style={styles.dayHeader}>
            <View style={styles.dayHeaderMain}>
              <View style={styles.dayHeaderTitleRow}>
                <Text style={styles.dayLabel}>{day.label}</Text>
                {isToday(day.date) ? (
                  <View style={styles.todayPill}>
                    <Text style={styles.todayPillText}>Hoy</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.dayDate}>{formatShiftShortDate(day.date)}</Text>
            </View>
            {day.items.length > 0 ? (
              <View style={styles.dayMetaRow}>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>
                    {day.items.length} {day.items.length === 1 ? "turno" : "turnos"}
                  </Text>
                </View>
                {mode === "personal" ? (
                  <View style={[styles.metaPill, styles.metaPillSoft]}>
                    <Text style={styles.metaPillText}>
                      {formatShiftMinutes(
                        day.items.reduce(
                          (total, item) =>
                            total +
                            getShiftDurationMinutes({
                              shift_date: item.shift_date,
                              start_time: item.start_time,
                              end_time: item.end_time,
                              break_minutes: item.break_minutes ?? 0,
                            }),
                          0,
                        ),
                      )}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {day.items.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {mode === "personal" ? "Libre" : "Sin turnos publicados"}
              </Text>
              <Text style={styles.emptyText}>
                {mode === "personal"
                  ? "No tienes turnos programados este día."
                  : "No hay equipo publicado para este día en tu sede."}
              </Text>
            </View>
          ) : (
            day.items.map((item) => (
              <View key={item.id} style={styles.shiftRow}>
                <View style={styles.timeRail}>
                  <Text style={styles.timeStart}>{formatShiftTime(item.start_time)}</Text>
                  <View style={styles.timeDot} />
                  <Text style={styles.timeEnd}>
                    {item.show_end_as_close ? "Cierre" : formatShiftTime(item.end_time)}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.shiftTitle}>
                    {mode === "site" && "employee_id" in item
                      ? getEmployeeName(item)
                      : getShiftSiteName(item.sites)}
                  </Text>
                  <Text style={styles.shiftSubMeta}>
                    {mode === "site"
                      ? getShiftSiteName(item.sites)
                      : `${formatShiftMinutes(
                          getShiftDurationMinutes({
                            shift_date: item.shift_date,
                            start_time: item.start_time,
                            end_time: item.end_time,
                            break_minutes: item.break_minutes ?? 0,
                          }),
                        )} · ${getShiftSiteName(item.sites)}`}
                  </Text>
                </View>
                {(() => {
                  const statusMeta = getShiftStatusMeta(item.status);
                  return (
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
                  );
                })()}
              </View>
            ))
          )}
        </View>
      ))}
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
    lineHeight: 19,
  },
  dayCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayCardToday: {
    borderColor: COLORS.accent,
    backgroundColor: "#FFF9FC",
  },
  dayHeader: {
    marginBottom: 10,
  },
  dayHeaderMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  dayDate: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.neutral,
  },
  todayPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: "#F9A8D4",
  },
  todayPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.accent,
  },
  dayMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  metaPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.porcelainAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metaPillSoft: {
    backgroundColor: COLORS.accentSoft,
    borderColor: "#F9A8D4",
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.text,
  },
  emptyState: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: COLORS.porcelainAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.neutral,
    lineHeight: 18,
  },
  shiftRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  timeRail: {
    width: 58,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: COLORS.porcelainAlt,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timeStart: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.text,
  },
  timeDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
    marginVertical: 6,
  },
  timeEnd: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.neutral,
  },
  shiftTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },
  shiftSubMeta: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 4,
    lineHeight: 18,
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
});
