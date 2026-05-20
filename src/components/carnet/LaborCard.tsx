import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

import { COLORS } from "@/constants/colors";
import type { Employee, EmployeeSite } from "@/core/auth/types";
import type { LaborCardEligibility } from "@/components/carnet/types";

type LaborCardProps = {
  employee: Employee | null;
  employeeSites: EmployeeSite[];
  eligibility: LaborCardEligibility | null;
};

function formatRole(value: string | null | undefined) {
  if (!value) return "Trabajador";
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getInitials(name: string | null | undefined) {
  const clean = name?.trim();
  if (!clean) return "A";
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "A";
}

function getPrimarySite(employee: Employee | null, employeeSites: EmployeeSite[]) {
  const primary = employeeSites.find((site) => site.isPrimary) ?? employeeSites[0] ?? null;
  return primary?.siteName ?? employee?.siteName ?? "Sede pendiente";
}

export function LaborCard({ employee, employeeSites, eligibility }: LaborCardProps) {
  const sheen = useSharedValue(0);
  const name = employee?.fullName || employee?.alias || "Empleado";
  const initials = getInitials(name);
  const statusReady =
    employee?.isActive === true &&
    (eligibility == null || (eligibility.contract_active && eligibility.documents_complete));
  const statusLabel = statusReady ? "Activo" : "Pendiente";
  const statusColor = statusReady ? COLORS.success : COLORS.warning;
  const primarySite = getPrimarySite(employee, employeeSites);
  const secondarySites = employeeSites
    .filter((site) => site.siteName !== primarySite)
    .map((site) => site.siteName)
    .filter(Boolean);

  useEffect(() => {
    sheen.value = withRepeat(
      withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [sheen]);

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(sheen.value, [0, 1], [-190, 190]) }],
    opacity: interpolate(sheen.value, [0, 0.5, 1], [0.08, 0.22, 0.08]),
  }));

  return (
    <View style={styles.cardOuter}>
      <View style={styles.accentTop}>
        <Animated.View style={[styles.sheen, sheenStyle]} />
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brandKicker}>ANIMA</Text>
            <Text style={styles.brandTitle}>Carnet laboral</Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.photoWrap}>
        <View style={styles.photoFrame}>
          {employee?.avatarUrl ? (
            <Image source={{ uri: employee.avatarUrl }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={styles.photoFallback}>
              <Text style={styles.photoInitials}>{initials}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.identityBlock}>
        <Text style={styles.name} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.82}>
          {name}
        </Text>
        <Text style={styles.role} numberOfLines={2}>
          {formatRole(employee?.role)}
        </Text>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="business-outline" size={17} color={COLORS.accent} />
          </View>
          <View style={styles.detailTextWrap}>
            <Text style={styles.detailLabel}>Sede principal</Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {primarySite}
            </Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="shield-checkmark-outline" size={17} color={COLORS.accent} />
          </View>
          <View style={styles.detailTextWrap}>
            <Text style={styles.detailLabel}>Estado documental</Text>
            <Text style={styles.detailValue} numberOfLines={2}>
              {eligibility?.documents_complete ? "Documentos completos" : "Documentos por validar"}
            </Text>
          </View>
        </View>
      </View>

      {secondarySites.length > 0 ? (
        <View style={styles.siteChips}>
          {secondarySites.slice(0, 3).map((siteName) => (
            <View key={siteName} style={styles.siteChip}>
              <Text style={styles.siteChipText} numberOfLines={1}>
                {siteName}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.footerRule} />
        <Text style={styles.footerText}>Identificación interna Vento Group</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardOuter: {
    overflow: "hidden",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(226, 0, 106, 0.16)",
    backgroundColor: COLORS.white,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  accentTop: {
    minHeight: 142,
    padding: 20,
    backgroundColor: COLORS.accent,
  },
  sheen: {
    position: "absolute",
    top: -42,
    bottom: -42,
    width: 92,
    backgroundColor: COLORS.white,
    transform: [{ rotate: "18deg" }],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  brandKicker: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
  },
  brandTitle: {
    marginTop: 6,
    color: COLORS.white,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "900",
    letterSpacing: 0,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: COLORS.white,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "900",
  },
  photoWrap: {
    marginTop: -54,
    alignItems: "center",
  },
  photoFrame: {
    width: 136,
    height: 166,
    borderRadius: 24,
    borderWidth: 5,
    borderColor: COLORS.white,
    backgroundColor: COLORS.porcelainAlt,
    overflow: "hidden",
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  photoFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentSoft,
  },
  photoInitials: {
    color: COLORS.accent,
    fontSize: 38,
    fontWeight: "900",
  },
  identityBlock: {
    paddingHorizontal: 22,
    paddingTop: 16,
    alignItems: "center",
  },
  name: {
    width: "100%",
    color: COLORS.text,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
    letterSpacing: 0,
    textAlign: "center",
  },
  role: {
    marginTop: 7,
    color: COLORS.accent,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
    textAlign: "center",
  },
  details: {
    marginTop: 18,
    paddingHorizontal: 18,
    gap: 10,
  },
  detailRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    backgroundColor: COLORS.porcelain,
  },
  detailIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentSoft,
  },
  detailTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  detailLabel: {
    color: COLORS.neutral,
    fontSize: 11,
    fontWeight: "900",
  },
  detailValue: {
    marginTop: 3,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "800",
  },
  siteChips: {
    paddingHorizontal: 18,
    paddingTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  siteChip: {
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
  },
  siteChipText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "900",
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    alignItems: "center",
  },
  footerRule: {
    width: 74,
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.rosegoldBright,
  },
  footerText: {
    marginTop: 10,
    color: COLORS.neutral,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textAlign: "center",
  },
});
