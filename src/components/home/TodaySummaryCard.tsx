import { Text, View } from "react-native"

import { COLORS } from "@/constants/colors"

type TodaySummaryCardProps = {
  cardStyle: object
  cardTintStyle: object
  surfaceStyle: object
  showHours: boolean
  hoursLabel: string
  statusHint: string
  lastCheckOutSource: string | null | undefined
  lastCheckOutRaw: string | null
  lastCheckIn: string
  lastCheckOut: string
  formatClock: (value: string | null) => string
}

export function TodaySummaryCard({
  cardStyle,
  cardTintStyle,
  surfaceStyle,
  showHours,
  hoursLabel,
  statusHint,
  lastCheckOutSource,
  lastCheckOutRaw,
  lastCheckIn,
  lastCheckOut,
  formatClock,
}: TodaySummaryCardProps) {
  return (
    <View style={{ ...cardStyle, padding: 18 }}>
      <View pointerEvents="none" style={cardTintStyle} />
      <Text style={{ fontSize: 13, color: COLORS.neutral }}>
        {showHours ? "Mi jornada hoy" : "Registro de hoy"}
      </Text>

      {showHours ? (
        <View
          style={{
            marginTop: 12,
            flexDirection: "row",
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <Text
            style={{
              fontSize: 52,
              lineHeight: 56,
              fontWeight: "800",
              color: COLORS.text,
              fontVariant: ["tabular-nums"],
              flexShrink: 0,
            }}
          >
            {hoursLabel}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: COLORS.neutral,
              marginLeft: 10,
              marginBottom: 10,
            }}
          >
            netos hoy
          </Text>
        </View>
      ) : null}

      <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: showHours ? 6 : 12 }}>
        {statusHint}
      </Text>
      {lastCheckOutSource === "system" && lastCheckOutRaw ? (
        <Text style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}>
          Turno cerrado automáticamente a las {formatClock(lastCheckOutRaw)}.
        </Text>
      ) : null}

      <View
        style={{
          height: 1,
          backgroundColor: COLORS.border,
          marginVertical: 16,
        }}
      />

      <View style={{ flexDirection: "row", gap: 12 }}>
        <View
          style={{
            flex: 1,
            ...surfaceStyle,
            padding: 12,
          }}
        >
          <Text style={{ fontSize: 12, color: COLORS.neutral }}>Entrada</Text>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "800",
              fontVariant: ["tabular-nums"],
              color: COLORS.text,
              marginTop: 8,
            }}
          >
            {lastCheckIn}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
            ...surfaceStyle,
            padding: 12,
          }}
        >
          <Text style={{ fontSize: 12, color: COLORS.neutral }}>Salida</Text>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "800",
              color: COLORS.text,
              fontVariant: ["tabular-nums"],
              marginTop: 8,
            }}
          >
            {lastCheckOut}
          </Text>
        </View>
      </View>
    </View>
  )
}
