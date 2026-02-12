import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";

import { COLORS } from "@/constants/colors";

type PendingDeletion = {
  id: string;
  status: string;
  execute_after: string | null;
};

type Props = {
  session: Session;
  pendingRequest: PendingDeletion | null;
  submitting: boolean;
  onRequestFullDeletion: () => Promise<{ success: boolean; error?: string }>;
  onCancelFullDeletion: () => Promise<{ success: boolean; error?: string }>;
};

export function DeleteAccountFlow({
  session,
  pendingRequest,
  submitting,
  onRequestFullDeletion,
  onCancelFullDeletion,
}: Props) {
  const [phrase, setPhrase] = useState("");
  const [irreversibleChecked, setIrreversibleChecked] = useState(false);

  const hasPending = pendingRequest?.status === "pending" || pendingRequest?.status === "processing";
  const canSubmit = phrase.trim().toUpperCase() === "ELIMINAR" && irreversibleChecked && !submitting;

  const executeDateText = useMemo(() => {
    if (!pendingRequest?.execute_after) return null;
    const date = new Date(pendingRequest.execute_after);
    return date.toLocaleString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [pendingRequest?.execute_after]);

  const handleSubmit = async () => {
    const result = await onRequestFullDeletion();
    if (!result.success) {
      Alert.alert("Error", result.error || "No se pudo programar la eliminacion.");
      return;
    }

    Alert.alert("Solicitud creada", "Tu cuenta quedo programada para eliminacion en 30 dias.");
    setPhrase("");
    setIrreversibleChecked(false);
  };

  const handleCancel = async () => {
    const result = await onCancelFullDeletion();
    if (!result.success) {
      Alert.alert("Error", result.error || "No se pudo cancelar la solicitud.");
      return;
    }

    Alert.alert("Solicitud cancelada", "La eliminacion de cuenta fue cancelada.");
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Eliminar cuenta completa</Text>
      <Text style={styles.description}>
        Se eliminara el acceso y se anonimizaran tus datos personales. El historico operativo se conserva sin datos identificables.
      </Text>

      {hasPending ? (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingTitle}>Eliminacion programada</Text>
          <Text style={styles.pendingText}>Estado: {pendingRequest?.status === "processing" ? "Procesando" : "Pendiente"}</Text>
          {executeDateText ? <Text style={styles.pendingText}>Fecha estimada: {executeDateText}</Text> : null}
          <TouchableOpacity style={styles.cancelButton} disabled={submitting} onPress={handleCancel}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.cancelButtonText}>Cancelar solicitud</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>Confirmacion final</Text>
            <Text style={styles.helperLabel}>Escribe ELIMINAR</Text>
            <TextInput
              value={phrase}
              onChangeText={setPhrase}
              autoCapitalize="characters"
              style={styles.input}
              placeholder="ELIMINAR"
              placeholderTextColor={COLORS.neutral}
            />

            <View style={styles.switchRow}>
              <Switch value={irreversibleChecked} onValueChange={setIrreversibleChecked} />
              <Text style={styles.switchText}>Entiendo que esta acción es irreversible tras 30 dias.</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.dangerButton, !canSubmit && styles.disabled]} disabled={!canSubmit} onPress={handleSubmit}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.dangerButtonText}>Programar eliminacion</Text>}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderColor: "rgba(226, 0, 106, 0.22)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
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
  sectionBox: {
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    backgroundColor: COLORS.porcelain,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
  },
  helperLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
  },
  input: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 14,
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryButton: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.accent,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  switchText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
  },
  dangerButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
  },
  dangerButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.45,
  },
  pendingBox: {
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    backgroundColor: COLORS.porcelain,
  },
  pendingTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  pendingText: {
    color: COLORS.neutral,
    fontSize: 13,
  },
  cancelButton: {
    marginTop: 4,
    backgroundColor: COLORS.text,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});

