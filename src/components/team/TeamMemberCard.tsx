import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import { TEAM_UI } from "@/components/team/ui";
import type { EmployeeRow } from "@/components/team/types";

type TeamMemberCardProps = {
  employee: EmployeeRow;
  formatName: (employee: EmployeeRow) => string;
  roleLabel: (role: string) => string;
  canEdit: boolean;
  onEdit: () => void;
};

export default function TeamMemberCard({
  employee,
  formatName,
  roleLabel,
  canEdit,
  onEdit,
}: TeamMemberCardProps) {
  const statusActive = employee.is_active !== false;
  const statusColor = statusActive ? COLORS.rosegold : COLORS.neutral;
  const siteName = employee.sites?.name ?? "Sin sede";
  const initial = employee.full_name?.charAt(0).toUpperCase() ?? "?";

  return (
    <View style={[TEAM_UI.card, styles.card]}>
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {formatName(employee)}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {roleLabel(employee.role)} · {siteName}
          </Text>
        </View>

        <View
          style={[
            TEAM_UI.pill,
            {
              borderColor: statusColor,
              backgroundColor:
                statusActive && statusColor === COLORS.rosegold
                  ? "rgba(242, 198, 192, 0.28)"
                  : COLORS.porcelainAlt,
            },
          ]}
        >
          <Text style={[styles.statusText, { color: statusColor }]}>
            {statusActive ? "Activo" : "Inactivo"}
          </Text>
        </View>
      </View>

      {canEdit ? (
        <TouchableOpacity
          onPress={onEdit}
          style={[TEAM_UI.chip, styles.editButton]}
        >
          <Ionicons name="create-outline" size={16} color={COLORS.accent} />
          <Text style={styles.editText}>Editar</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(226, 0, 106, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(226, 0, 106, 0.18)",
    marginRight: 12,
  },
  avatarText: {
    fontWeight: "800",
    color: COLORS.accent,
  },
  headerText: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  meta: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
  },
  editButton: {
    marginTop: 12,
    borderColor: COLORS.accent,
    backgroundColor: "rgba(226, 0, 106, 0.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  editText: {
    fontWeight: "800",
    color: COLORS.accent,
  },
});
