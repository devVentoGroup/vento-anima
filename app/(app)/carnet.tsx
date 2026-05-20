import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { LaborCard } from "@/components/carnet/LaborCard";
import { useLaborCardEligibility } from "@/components/carnet/use-labor-card-eligibility";
import { COLORS } from "@/constants/colors";
import { CONTENT_HORIZONTAL_PADDING, CONTENT_MAX_WIDTH } from "@/constants/layout";
import { useAuth } from "@/contexts/auth-context";

export default function CarnetScreen() {
  const insets = useSafeAreaInsets();
  const { user, employee, employeeSites, refreshEmployee } = useAuth();
  const { eligibility, isLoading, refresh } = useLaborCardEligibility({ userId: user?.id });

  const handleRefresh = async () => {
    await Promise.all([refreshEmployee(), refresh()]);
  };

  const statusItems = [
    {
      key: "employee",
      label: employee?.isActive ? "Empleado activo" : "Empleado pendiente",
      ok: employee?.isActive === true,
    },
    {
      key: "contract",
      label: eligibility?.contract_active ? "Contrato vigente" : "Contrato por revisar",
      ok: eligibility?.contract_active === true,
    },
    {
      key: "documents",
      label: eligibility?.documents_complete ? "Documentos completos" : "Documentos pendientes",
      ok: eligibility?.documents_complete === true,
    },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Math.max(20, insets.top + 18),
            paddingBottom: Math.max(28, insets.bottom + 18),
          },
        ]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>Identificación laboral</Text>
          <Text style={styles.title}>Carnet laboral</Text>
          <Text style={styles.subtitle}>
            Presenta este carnet dentro de la operación cuando necesites identificarte.
          </Text>
        </View>

        <LaborCard employee={employee} employeeSites={employeeSites} eligibility={eligibility} />

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.accent} />
            <Text style={styles.panelTitle}>Estado del carnet</Text>
            {isLoading ? <ActivityIndicator size="small" color={COLORS.accent} /> : null}
          </View>

          <View style={styles.statusList}>
            {statusItems.map((item) => (
              <View key={item.key} style={styles.statusRow}>
                <View
                  style={[
                    styles.statusIcon,
                    { backgroundColor: item.ok ? "rgba(22, 163, 74, 0.12)" : "#FFFBEB" },
                  ]}
                >
                  <Ionicons
                    name={item.ok ? "checkmark" : "alert-outline"}
                    size={16}
                    color={item.ok ? COLORS.success : COLORS.warning}
                  />
                </View>
                <Text style={styles.statusLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.porcelain,
  },
  content: {
    alignSelf: "center",
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
  },
  header: {
    marginBottom: 18,
  },
  kicker: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
  },
  title: {
    marginTop: 6,
    color: COLORS.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: 0,
  },
  subtitle: {
    marginTop: 8,
    color: COLORS.neutral,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  panel: {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  panelTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
  },
  statusList: {
    marginTop: 14,
    gap: 10,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  statusLabel: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
});
