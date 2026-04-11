import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native"

import { PALETTE } from "@/components/home/theme"
import { COLORS } from "@/constants/colors"

type GeofencePill = {
  bg: string
  border: string
  text: string
}

type GeofenceStatusCardProps = {
  cardStyle: object
  cardTintStyle: object
  pillStyle: object
  surfaceStyle: object
  buttonGhostStyle: object
  geofencePill: GeofencePill
  geofenceLabel: string
  activeSiteName: string
  isCheckedIn: boolean
  isLoading: boolean
  isGeoChecking: boolean
  isCheckActionLocked: boolean
  canChooseSite: boolean
  distanceMeters: number | null | undefined
  accuracyMeters: number | null | undefined
  effectiveRadiusMeters: number | null | undefined
  infoMessage: string
  onRefresh: () => void
  onSelectSite: () => void
}

export function GeofenceStatusCard({
  cardStyle,
  cardTintStyle,
  pillStyle,
  surfaceStyle,
  buttonGhostStyle,
  geofencePill,
  geofenceLabel,
  activeSiteName,
  isCheckedIn,
  isLoading,
  isGeoChecking,
  isCheckActionLocked,
  canChooseSite,
  distanceMeters,
  accuracyMeters,
  effectiveRadiusMeters,
  infoMessage,
  onRefresh,
  onSelectSite,
}: GeofenceStatusCardProps) {
  return (
    <View style={{ marginTop: 18 }}>
      <View style={{ ...cardStyle, padding: 16, marginBottom: 12 }}>
        <View pointerEvents="none" style={cardTintStyle} />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontSize: 12, color: COLORS.neutral }}>
            Verificación de ubicación
          </Text>

          <View
            style={{
              ...pillStyle,
              backgroundColor: geofencePill.bg,
              borderColor: geofencePill.border,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 0.4,
                color: geofencePill.text,
              }}
            >
              {geofenceLabel}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 10,
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "800",
                color: COLORS.text,
              }}
            >
              {activeSiteName}
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
              {isCheckedIn ? "Para registrar salida" : "Para registrar entrada"}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onRefresh}
            disabled={isLoading || isGeoChecking || isCheckActionLocked}
            style={{
              ...buttonGhostStyle,
              opacity: isLoading || isGeoChecking || isCheckActionLocked ? 0.6 : 1,
            }}
          >
            {isGeoChecking ? (
              <ActivityIndicator color={PALETTE.accent} />
            ) : (
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "800",
                  color: PALETTE.accent,
                }}
              >
                Actualizar
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {canChooseSite ? (
          <TouchableOpacity
            onPress={onSelectSite}
            style={{
              marginTop: 10,
              alignSelf: "flex-start",
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: PALETTE.border,
              backgroundColor: PALETTE.porcelain2,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: PALETTE.text,
              }}
            >
              Seleccionar sede
            </Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
          <View style={{ flex: 1, ...surfaceStyle, padding: 12 }}>
            <Text style={{ fontSize: 12, color: PALETTE.neutral }}>Distancia</Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: PALETTE.text,
                marginTop: 8,
              }}
            >
              {distanceMeters != null ? `${distanceMeters}m` : "--"}
            </Text>
          </View>

          <View style={{ flex: 1, ...surfaceStyle, padding: 12 }}>
            <Text style={{ fontSize: 12, color: PALETTE.neutral }}>Precisión</Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: PALETTE.text,
                marginTop: 8,
              }}
            >
              {accuracyMeters != null ? `${Math.round(accuracyMeters)}m` : "--"}
            </Text>
          </View>

          <View style={{ flex: 1, ...surfaceStyle, padding: 12 }}>
            <Text style={{ fontSize: 12, color: PALETTE.neutral }}>Radio</Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: PALETTE.text,
                marginTop: 8,
              }}
            >
              {effectiveRadiusMeters != null ? `${effectiveRadiusMeters}m` : "--"}
            </Text>
          </View>
        </View>

        <Text
          style={{
            fontSize: 12,
            color: COLORS.neutral,
            marginTop: 12,
            lineHeight: 16,
          }}
        >
          {infoMessage}
        </Text>
      </View>
    </View>
  )
}
