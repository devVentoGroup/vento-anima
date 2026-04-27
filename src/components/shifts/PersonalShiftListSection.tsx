import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { COLORS } from "@/constants/colors";

import {
  formatShiftDateLabel,
  getShiftRangeLabel,
  getShiftSiteName,
  getShiftStatusMeta,
  type ShiftRow,
} from "./utils";

type Props = {
  title: string;
  rows: ShiftRow[];
};

export function PersonalShiftListSection({ title, rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>
      {rows.map((row) => {
        const statusMeta = getShiftStatusMeta(row.status);
        return (
          <View key={row.id} style={styles.card}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{formatShiftDateLabel(row.shift_date)}</Text>
                <Text style={styles.cardSubTitle}>{getShiftSiteName(row.sites)}</Text>
              </View>

              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: statusMeta.bg, borderColor: statusMeta.border },
                ]}
              >
                <Text style={[styles.statusText, { color: statusMeta.text }]}>{statusMeta.label}</Text>
              </View>
            </View>

            <Text style={styles.rangeLabel}>{getShiftRangeLabel(row)}</Text>

            {row.notes ? <Text style={styles.notes}>{row.notes}</Text> : null}
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
    marginBottom: 12,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
  },
  cardSubTitle: {
    fontSize: 13,
    color: COLORS.neutral,
    marginTop: 6,
  },
  rangeLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 14,
  },
  notes: {
    fontSize: 12,
    color: COLORS.text,
    marginTop: 8,
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
