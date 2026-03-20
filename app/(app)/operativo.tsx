import { View, Text, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/auth-context";
import { COLORS } from "@/constants/colors";
import { PALETTE } from "@/components/home/theme";
import { CONTENT_HORIZONTAL_PADDING, CONTENT_MAX_WIDTH } from "@/constants/layout";
import { OperativoReportScreen } from "@/components/home/OperativoReportScreen";

export default function OperativoScreen() {
  const insets = useSafeAreaInsets();
  const { employee } = useAuth();
  const role = employee?.role ?? null;
  const canSee =
    role === "propietario" || role === "gerente_general" || role === "gerente";

  if (!canSee) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: PALETTE.porcelain }}>
        <Text style={{ fontSize: 15, color: COLORS.neutral, textAlign: "center", paddingHorizontal: 24 }}>
          Solo propietarios y gerentes pueden ver el resumen operativo.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: PALETTE.porcelain }}
      contentContainerStyle={{
        paddingTop: Math.max(20, insets.top + 12),
        paddingBottom: 24,
        alignSelf: "center",
        width: "100%",
        maxWidth: CONTENT_MAX_WIDTH,
        paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
      }}
      showsVerticalScrollIndicator={false}
    >
      <OperativoReportScreen />
    </ScrollView>
  );
}
