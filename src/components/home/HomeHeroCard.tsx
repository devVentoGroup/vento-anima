import { Image, Text, TouchableOpacity, View } from "react-native";

import { PALETTE, RGBA } from "@/components/home/theme";

type HomeHeroCardProps = {
  cardStyle: object;
  pillStyle: object;
  todayLabel: string;
  displayName: string;
  avatarUrl: string | null | undefined;
  avatarInitial: string;
  statusUI: {
    label: string;
    tone: "active" | "done" | "idle";
  };
  geofenceUI: {
    label: string;
  };
  geofencePill: {
    bg: string;
    border: string;
    text: string;
  };
  isOffline: boolean;
  hasPendingAny: boolean;
  isSyncingAny: boolean;
  pendingCount: number;
  showHeaderOpsPill: boolean;
  headerOpsPill: {
    label: string;
    bg: string;
    border: string;
    text: string;
  };
  onOpenUserMenu: () => void;
  onPressOpsPill: () => void;
};

export function HomeHeroCard({
  cardStyle,
  pillStyle,
  todayLabel,
  displayName,
  avatarUrl,
  avatarInitial,
  statusUI,
  geofenceUI,
  geofencePill,
  isOffline,
  hasPendingAny,
  isSyncingAny,
  pendingCount,
  showHeaderOpsPill,
  headerOpsPill,
  onOpenUserMenu,
  onPressOpsPill,
}: HomeHeroCardProps) {
  return (
    <View
      style={{
        ...cardStyle,
        padding: 16,
        overflow: "hidden",
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -36,
          right: -28,
          width: 132,
          height: 132,
          borderRadius: 66,
          backgroundColor: RGBA.washPink,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: -44,
          left: -34,
          width: 140,
          height: 140,
          borderRadius: 70,
          backgroundColor: RGBA.cardTint,
        }}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: PALETTE.neutral,
              letterSpacing: 0.2,
            }}
          >
            {todayLabel}
          </Text>
          <Text
            style={{
              fontSize: 34,
              fontWeight: "900",
              color: PALETTE.text,
              marginTop: 4,
              lineHeight: 38,
            }}
            numberOfLines={1}
          >
            Hola, {displayName}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onOpenUserMenu}
          accessibilityRole="button"
          accessibilityLabel="Abrir menú de usuario"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: PALETTE.porcelain2,
            borderWidth: 1,
            borderColor: PALETTE.border,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <Text style={{ fontSize: 18, fontWeight: "900", color: PALETTE.text }}>
              {avatarInitial}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          marginTop: 14,
        }}
      >
        <View
          style={{
            ...pillStyle,
            borderColor: statusUI.tone === "active" ? RGBA.borderPink : PALETTE.border,
            backgroundColor:
              statusUI.tone === "active" ? RGBA.washRoseGlow : PALETTE.porcelain2,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "900",
              color: statusUI.tone === "active" ? PALETTE.accent : PALETTE.neutral,
              letterSpacing: 0.45,
              textTransform: "uppercase",
            }}
          >
            {statusUI.label}
          </Text>
        </View>

        <View
          style={{
            ...pillStyle,
            borderColor: geofencePill.border,
            backgroundColor: geofencePill.bg,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "900",
              color: geofencePill.text,
              letterSpacing: 0.45,
              textTransform: "uppercase",
            }}
          >
            {geofenceUI.label}
          </Text>
        </View>

        <View
          style={{
            ...pillStyle,
            borderColor: isOffline ? RGBA.borderPink : PALETTE.border,
            backgroundColor: isOffline ? "rgba(226, 0, 106, 0.08)" : PALETTE.porcelain2,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              backgroundColor: isOffline ? PALETTE.accent : "#16a34a",
            }}
          />
          <Text
            style={{
              fontSize: 11,
              fontWeight: "900",
              color: isOffline ? PALETTE.accent : PALETTE.neutral,
              letterSpacing: 0.45,
              textTransform: "uppercase",
            }}
          >
            {isOffline ? "Sin conexión" : "En línea"}
          </Text>
        </View>

        <View
          style={{
            ...pillStyle,
            borderColor: hasPendingAny ? RGBA.borderPink : PALETTE.border,
            backgroundColor: hasPendingAny ? "rgba(226, 0, 106, 0.08)" : PALETTE.porcelain2,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "900",
              color: hasPendingAny ? PALETTE.accent : PALETTE.neutral,
              letterSpacing: 0.45,
              textTransform: "uppercase",
            }}
          >
            {hasPendingAny
              ? `${pendingCount} pendientes`
              : isSyncingAny
                ? "Sincronizando"
                : "Al día"}
          </Text>
        </View>

        {showHeaderOpsPill ? (
          <TouchableOpacity
            onPress={onPressOpsPill}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              ...pillStyle,
              backgroundColor: headerOpsPill.bg,
              borderColor: headerOpsPill.border,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "900",
                color: headerOpsPill.text,
                letterSpacing: 0.45,
                textTransform: "uppercase",
              }}
            >
              {headerOpsPill.label}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
