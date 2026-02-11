import React from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "@/constants/colors";

type Props = {
  submitting: boolean;
  onRequestDataCleanup: () => Promise<{ success: boolean; error?: string }>;
};

export function DataCleanupFlow({ submitting, onRequestDataCleanup }: Props) {
  const handlePress = async () => {
    const result = await onRequestDataCleanup();
    if (!result.success) {
      Alert.alert("Error", result.error || "No se pudieron limpiar los datos opcionales.");
      return;
    }

    Alert.alert("Listo", "Se limpiaron favoritos y preferencias opcionales.");
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Eliminar datos opcionales</Text>
      <Text style={styles.description}>
        Limpia favoritos y preferencias de marketing sin eliminar tu cuenta.
      </Text>

      <TouchableOpacity style={styles.button} disabled={submitting} onPress={handlePress}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Limpiar datos opcionales</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  title: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },
  description: {
    color: COLORS.neutral,
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    marginTop: 4,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
