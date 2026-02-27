import React from "react"
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"

import type { AppUpdateInfo } from "@/hooks/use-app-update-policy"

interface AppUpdateGateProps {
  updateInfo: AppUpdateInfo
  onUpdatePress: () => void
  onDismissOptional: () => void
}

export function AppUpdateGate({
  updateInfo,
  onUpdatePress,
  onDismissOptional,
}: AppUpdateGateProps) {
  if (!updateInfo || updateInfo.loading) {
    return null
  }

  const isRequired = updateInfo.status === "required"
  const isOptional = updateInfo.status === "optional"

  if (!isRequired && !isOptional) {
    return null
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!isRequired) {
          onDismissOptional()
        }
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{updateInfo.title || "Actualización"}</Text>
          <Text style={styles.message}>{updateInfo.message}</Text>

          {updateInfo.currentVersion ? (
            <Text style={styles.versionInfo}>
              Versión actual: {updateInfo.currentVersion}
              {updateInfo.targetVersion ? ` | Requerida: ${updateInfo.targetVersion}` : ""}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, !updateInfo.storeUrl && styles.primaryButtonDisabled]}
            onPress={onUpdatePress}
            disabled={!updateInfo.storeUrl}
            activeOpacity={0.85}
          >
            {updateInfo.storeUrl ? (
              <Text style={styles.primaryButtonText}>Actualizar ahora</Text>
            ) : (
              <View style={styles.rowCenter}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.primaryButtonText}>Buscando enlace de tienda...</Text>
              </View>
            )}
          </TouchableOpacity>

          {!isRequired ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onDismissOptional}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Más tarde</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.56)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0F172A",
  },
  message: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: "#334155",
  },
  versionInfo: {
    marginTop: 12,
    fontSize: 12,
    color: "#64748B",
  },
  primaryButton: {
    marginTop: 20,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#0EA5E9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primaryButtonDisabled: {
    backgroundColor: "#94A3B8",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    marginTop: 10,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
  },
  rowCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
})
