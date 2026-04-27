import { Text, TouchableOpacity, View } from "react-native"

import { COLORS } from "@/constants/colors"

type PendingSyncCardProps = {
  pendingAttendanceCount: number
  pendingAttendanceFailedCount: number
  pendingAttendanceConflictCount: number
  pendingAttendanceOldestCreatedAt: string | null
  pendingAttendanceNextRetryAt: number | null
  pendingAttendanceLastError: string | null
  formatClock: (value: string | null) => string
  formatRetryClock: (value: number | null) => string | null
  onSyncNow: () => void
}

export function PendingSyncCard({
  pendingAttendanceCount,
  pendingAttendanceFailedCount,
  pendingAttendanceConflictCount,
  pendingAttendanceOldestCreatedAt,
  pendingAttendanceNextRetryAt,
  pendingAttendanceLastError,
  formatClock,
  formatRetryClock,
  onSyncNow,
}: PendingSyncCardProps) {
  if (pendingAttendanceCount <= 0) return null

  return (
    <View
      style={{
        backgroundColor: "white",
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.text }}>
        Registros pendientes: {pendingAttendanceCount}
      </Text>
      <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
        {pendingAttendanceFailedCount > 0
          ? `${pendingAttendanceFailedCount} requieren reintento.`
          : "Se sincronizarán automáticamente cuando haya conexión estable."}
      </Text>
      {pendingAttendanceConflictCount > 0 ? (
        <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
          Conflictos detectados: {pendingAttendanceConflictCount} (requieren revisión).
        </Text>
      ) : null}
      {pendingAttendanceOldestCreatedAt ? (
        <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
          Pendiente más antiguo: {formatClock(pendingAttendanceOldestCreatedAt)}
        </Text>
      ) : null}
      {pendingAttendanceNextRetryAt ? (
        <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
          Próximo reintento: {formatRetryClock(pendingAttendanceNextRetryAt)}
        </Text>
      ) : null}
      {pendingAttendanceLastError ? (
        <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
          Último error: {pendingAttendanceLastError}
        </Text>
      ) : null}
      <TouchableOpacity
        onPress={onSyncNow}
        style={{
          marginTop: 12,
          alignSelf: "flex-start",
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 12,
          backgroundColor: COLORS.accent,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "800", color: "white" }}>
          Sincronizar ahora
        </Text>
      </TouchableOpacity>
    </View>
  )
}
