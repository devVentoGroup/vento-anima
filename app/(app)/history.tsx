import { useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";
import { CONTENT_HORIZONTAL_PADDING, CONTENT_MAX_WIDTH } from "@/constants/layout";
import { useAuth } from "@/contexts/auth-context";
import HistoryEmptyState from "@/components/history/HistoryEmptyState";
import HistoryDetailModal from "@/components/history/HistoryDetailModal";
import HistoryIncidentModal from "@/components/history/HistoryIncidentModal";
import { useHistoryData } from "@/components/history/use-history-data";
import { useHistoryInteractions } from "@/components/history/use-history-interactions";
import { HISTORY_UI } from "@/components/history/ui";

const UI = HISTORY_UI;

function formatHour(value: string) {
  return new Date(value).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayLabel(value: string) {
  const date = new Date(value);
  const day = date.toLocaleDateString("es-CO", { weekday: "long" });
  const prettyDay = `${day.charAt(0).toUpperCase()}${day.slice(1)}`;
  const prettyDate = date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return `${prettyDay} - ${prettyDate}`;
}

function formatDuration(minutes: number | null) {
  if (minutes == null) return "--";
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours <= 0) return `${mins} min`;
  return `${hours}h ${mins.toString().padStart(2, "0")}m`;
}

function getSiteName(
  sites: { name: string | null } | { name: string | null }[] | null,
) {
  if (!sites) return null;
  if (Array.isArray(sites)) return sites[0]?.name ?? null;
  return sites.name ?? null;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const {
    rangeMode,
    setRangeMode,
    rows,
    setRows,
    isLoading,
    isRefreshing,
    rangeLabel,
    grouped,
    handleRefresh,
    shiftRange,
  } = useHistoryData({
    userId: user?.id,
  });
  const {
    selectedLog,
    isDetailOpen,
    isIncidentOpen,
    incidentText,
    setIncidentText,
    isSavingIncident,
    openDetails,
    openIncident,
    closeDetails,
    closeIncident,
    saveIncident,
  } = useHistoryInteractions({
    setRows,
  });
  const statusUI = (label: string) => {
    if (label === "En curso") {
      return {
        tone: COLORS.accent,
        bg: "rgba(226, 0, 106, 0.10)",
        border: "rgba(226, 0, 106, 0.22)",
        icon: "time-outline" as const,
      };
    }
    if (label === "Turno cerrado") {
      return {
        tone: COLORS.rosegold,
        bg: "rgba(242, 198, 192, 0.28)",
        border: COLORS.rosegold,
        icon: "checkmark-circle-outline" as const,
      };
    }
    if (label === "Salida registrada") {
      return {
        tone: COLORS.rosegold,
        bg: "rgba(242, 198, 192, 0.20)",
        border: "rgba(183, 110, 121, 0.55)",
        icon: "checkmark-done-outline" as const,
      };
    }
    if (label === "Sin salida" || label === "Sin entrada") {
      return {
        tone: COLORS.neutral,
        bg: COLORS.porcelainAlt,
        border: COLORS.border,
        icon: "alert-circle-outline" as const,
      };
    }
    return {
      tone: COLORS.neutral,
      bg: COLORS.porcelainAlt,
      border: COLORS.border,
      icon: "information-circle-outline" as const,
    };
  };

  return (
    <View style={styles.root}>
      <View
        style={{
          alignSelf: "center",
          width: "100%",
          maxWidth: CONTENT_MAX_WIDTH,
          paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
          paddingTop: Math.max(16, insets.top + 8),
        }}
      >
        <Text style={styles.title}>Historial</Text>
        <Text style={styles.subtitle}>Tus registros de asistencia</Text>

        <View style={{ ...UI.card, padding: 14, marginTop: 16 }}>
          <Text style={{ fontSize: 12, color: COLORS.neutral }}>Periodo</Text>
          <View
            style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}
          >
            <TouchableOpacity
              onPress={() => shiftRange("prev")}
              style={[
                UI.chip,
                {
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.porcelainAlt,
                },
              ]}
            >
              <Ionicons name="chevron-back" size={16} color={COLORS.text} />
            </TouchableOpacity>

            <View style={{ flex: 1, alignItems: "center" }}>
              <Text
                style={{ fontSize: 14, fontWeight: "700", color: COLORS.text }}
              >
                {rangeLabel}
              </Text>
              <Text
                style={{ fontSize: 12, color: COLORS.neutral, marginTop: 4 }}
              >
                {rangeMode === "week" ? "Semana" : "Mes"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => shiftRange("next")}
              style={[
                UI.chip,
                {
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.porcelainAlt,
                },
              ]}
            >
              <Ionicons name="chevron-forward" size={16} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.segmentWrap}>
            <TouchableOpacity
              onPress={() => setRangeMode("week")}
              style={[
                styles.segmentItem,
                rangeMode === "week" ? styles.segmentActive : null,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  rangeMode === "week" ? styles.segmentTextActive : null,
                ]}
              >
                Semana
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setRangeMode("month")}
              style={[
                styles.segmentItem,
                rangeMode === "month" ? styles.segmentActive : null,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  rangeMode === "month" ? styles.segmentTextActive : null,
                ]}
              >
                Mes
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          alignSelf: "center",
          width: "100%",
          maxWidth: CONTENT_MAX_WIDTH,
          paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
          paddingTop: 18,
          paddingBottom: Math.max(24, insets.bottom + 24),
        }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {isLoading ? (
          <View style={{ paddingTop: 40, alignItems: "center" }}>
            <ActivityIndicator color={COLORS.accent} />
            <Text style={{ marginTop: 8, color: COLORS.neutral }}>
              Cargando...
            </Text>
          </View>
        ) : null}

        {!isLoading && grouped.length === 0 ? <HistoryEmptyState /> : null}

        {grouped.map(([dayKey, items]) => (
          <View key={dayKey} style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: COLORS.text,
                marginBottom: 8,
              }}
            >
              {formatDayLabel(items[0].occurred_at)}
            </Text>
            <View style={{ ...UI.card, padding: 12 }}>
              {items.map((item, index) => {
                const actionLabel =
                  item.action === "check_in" ? "Entrada" : "Salida";
                const st = statusUI(item.statusLabel);
                return (
                  <View key={item.id}>
                    {index > 0 ? (
                      <View
                        style={{
                          height: 1,
                          backgroundColor: COLORS.border,
                          marginVertical: 12,
                        }}
                      />
                    ) : null}
                    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Ionicons
                            name={
                              item.action === "check_in"
                                ? "log-in-outline"
                                : "log-out-outline"
                            }
                            size={16}
                            color={COLORS.text}
                          />
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "800",
                              color: COLORS.text,
                              fontVariant: ["tabular-nums"],
                            }}
                          >
                            {actionLabel} - {formatHour(item.occurred_at)}
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 12,
                            color: COLORS.neutral,
                            marginTop: 4,
                          }}
                        >
                          {getSiteName(item.sites) ?? "Sede no disponible"}
                        </Text>
                      </View>
                      <View
                        style={[
                          UI.pill,
                          {
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            borderColor: st.border,
                            backgroundColor: st.bg,
                            maxWidth: "46%",
                            alignSelf: "flex-start",
                          },
                        ]}
                      >
                        <Ionicons name={st.icon} size={14} color={st.tone} />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "800",
                            color: st.tone,
                            flexShrink: 1,
                          }}
                        >
                          {item.statusLabel}
                        </Text>
                      </View>
                    </View>

                    <View style={{ marginTop: 10 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{ fontSize: 12, color: COLORS.neutral, flex: 1 }}
                        >
                          Duracion neta del turno
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "800",
                            color: COLORS.text,
                            fontVariant: ["tabular-nums"],
                            marginLeft: 8,
                          }}
                        >
                          {formatDuration(item.durationMinutes)}
                        </Text>
                      </View>
                      {item.breakMinutes != null ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginTop: 6,
                          }}
                        >
                          <Text
                            style={{ fontSize: 12, color: COLORS.neutral, flex: 1 }}
                          >
                            Descanso
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "700",
                              color: COLORS.neutral,
                              fontVariant: ["tabular-nums"],
                              marginLeft: 8,
                            }}
                          >
                            {formatDuration(item.breakMinutes)}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View
                      style={{ flexDirection: "row", gap: 10, marginTop: 12 }}
                    >
                      <TouchableOpacity
                        onPress={() => openDetails(item)}
                        style={[
                          UI.chip,
                          {
                            borderColor: COLORS.border,
                            backgroundColor: COLORS.porcelainAlt,
                            flex: 1,
                          },
                        ]}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons
                            name="information-circle-outline"
                            size={16}
                            color={COLORS.text}
                          />
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "800",
                              color: COLORS.text,
                            }}
                          >
                            Ver detalle
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => openIncident(item)}
                        style={[
                          UI.chip,
                          {
                            borderColor: COLORS.rosegold,
                            backgroundColor: "rgba(242, 198, 192, 0.2)",
                            flex: 1,
                          },
                        ]}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons
                            name="alert-circle-outline"
                            size={16}
                            color={COLORS.rosegold}
                          />
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "800",
                              color: COLORS.rosegold,
                            }}
                          >
                            Incidencia
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <HistoryDetailModal
        visible={isDetailOpen}
        log={selectedLog}
        onClose={closeDetails}
        formatHour={formatHour}
        formatDuration={formatDuration}
        getSiteName={getSiteName}
      />

      <HistoryIncidentModal
        visible={isIncidentOpen}
        incidentText={incidentText}
        isSaving={isSavingIncident}
        onChangeText={setIncidentText}
        onCancel={closeIncident}
        onSave={saveIncident}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.porcelain,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.neutral,
  },
  segmentWrap: {
    flexDirection: "row",
    marginTop: 12,
    padding: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: "rgba(226, 0, 106, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(226, 0, 106, 0.18)",
  },
  segmentText: {
    fontWeight: "800",
    color: COLORS.text,
  },
  segmentTextActive: {
    color: COLORS.accent,
  },
});



