import { Text, View } from "react-native"

import { COLORS } from "@/constants/colors"

type Diagnostics = {
  lastErrorStage?: string | null
  lastErrorMessage?: string | null
  lastGeofenceDurationMs?: number | null
  lastCheckInDurationMs?: number | null
  lastCheckOutDurationMs?: number | null
  lastSyncDurationMs?: number | null
  gpsErrorCount: number
  networkErrorCount: number
  dbErrorCount: number
  permissionErrorCount: number
  syncConflictCount: number
}

type AttendanceDiagnosticsCardProps = {
  show: boolean
  diagnostics: Diagnostics
  formatLatency: (value: number | null) => string
}

export function AttendanceDiagnosticsCard({
  show,
  diagnostics,
  formatLatency,
}: AttendanceDiagnosticsCardProps) {
  if (
    !show ||
    !(
      diagnostics.lastErrorStage ||
      diagnostics.lastGeofenceDurationMs != null ||
      diagnostics.lastCheckInDurationMs != null ||
      diagnostics.lastCheckOutDurationMs != null ||
      diagnostics.lastSyncDurationMs != null
    )
  ) {
    return null
  }

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
        Diagnóstico de asistencia
      </Text>
      <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 6 }}>
        Geofence: {formatLatency(diagnostics.lastGeofenceDurationMs ?? null)} | Check-in:{" "}
        {formatLatency(diagnostics.lastCheckInDurationMs ?? null)} | Check-out:{" "}
        {formatLatency(diagnostics.lastCheckOutDurationMs ?? null)} | Sync:{" "}
        {formatLatency(diagnostics.lastSyncDurationMs ?? null)}
      </Text>
      {diagnostics.lastErrorStage ? (
        <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
          Último fallo [{diagnostics.lastErrorStage}]:{" "}
          {diagnostics.lastErrorMessage ?? "sin detalle"}
        </Text>
      ) : null}
      <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
        Conteos - GPS: {diagnostics.gpsErrorCount} | Red:{" "}
        {diagnostics.networkErrorCount} | DB: {diagnostics.dbErrorCount} | Permisos:{" "}
        {diagnostics.permissionErrorCount} | Conflictos sync:{" "}
        {diagnostics.syncConflictCount}
      </Text>
    </View>
  )
}
