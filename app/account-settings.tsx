import { useEffect } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { COLORS } from "@/constants/colors";
import { useAuth } from "@/contexts/auth-context";
import { useAccountDeletion } from "@/hooks/useAccountDeletion";
import { DataCleanupFlow } from "@/components/settings/DataCleanupFlow";
import { DeleteAccountFlow } from "@/components/settings/DeleteAccountFlow";

export default function AccountSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const {
    loadingStatus,
    submitting,
    pendingRequest,
    refreshStatus,
    requestFullDeletion,
    requestDataCleanup,
    cancelFullDeletion,
  } = useAccountDeletion(session);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.porcelain} />
        <View style={styles.centered}>
          <Text style={styles.title}>Configuracion y privacidad</Text>
          <Text style={styles.muted}>No hay sesion activa.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.porcelain} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backInline} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={COLORS.accent} />
          <Text style={styles.backInlineText}>Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Configuracion y privacidad</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loadingStatus} onRefresh={() => void refreshStatus()} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Gestion de cuenta</Text>
          <Text style={styles.infoText}>
            Aqui puedes limpiar datos opcionales o programar la eliminacion completa de tu cuenta.
          </Text>
        </View>

        <DataCleanupFlow
          submitting={submitting}
          onRequestDataCleanup={async () => {
            const result = await requestDataCleanup();
            if (!result.success) {
              Alert.alert("Error", result.error || "No se pudo procesar la limpieza.");
            }
            return result;
          }}
        />

        <View style={styles.dangerHeader}>
          <Text style={styles.dangerTitle}>Zona de riesgo</Text>
          {loadingStatus ? <ActivityIndicator color={COLORS.accent} /> : null}
        </View>

        <DeleteAccountFlow
          session={session}
          pendingRequest={pendingRequest}
          submitting={submitting}
          onRequestFullDeletion={requestFullDeletion}
          onCancelFullDeletion={cancelFullDeletion}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.porcelain,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    gap: 12,
  },
  header: {
    paddingHorizontal: 18,
    gap: 10,
    paddingBottom: 8,
  },
  backInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  backInlineText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
  },
  muted: {
    color: COLORS.neutral,
    fontSize: 14,
  },
  backButton: {
    marginTop: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 13,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 14,
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  infoTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
  },
  infoText: {
    color: COLORS.neutral,
    fontSize: 13,
    lineHeight: 18,
  },
  dangerHeader: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dangerTitle: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
