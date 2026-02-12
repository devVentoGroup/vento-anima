import { useState } from "react";
import {
  Alert,
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
import SupportTicketModal from "@/components/support/SupportTicketModal";
import { SUPPORT_UI } from "@/components/support/ui";

const UI = SUPPORT_UI;

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [message, setMessage] = useState("");

  const submitTicket = () => {
    if (!message.trim()) {
      Alert.alert("Soporte", "Escribe el detalle antes de enviar.");
      return;
    }
    setIsTicketOpen(false);
    setMessage("");
    Alert.alert("Soporte", "Solicitud enviada. Te responderemos pronto.");
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          alignSelf: "center",
          width: "100%",
          maxWidth: CONTENT_MAX_WIDTH,
          paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
          paddingTop: Math.max(16, insets.top + 8),
          paddingBottom: Math.max(24, insets.bottom + 24),
        }}
      >
        <Text style={styles.title}>Soporte</Text>
        <Text style={styles.subtitle}>Estamos aquí para ayudarte.</Text>

        <View style={{ marginTop: 18, gap: 12 }}>
          <View style={[UI.card, { padding: 14 }]}>
            <Text style={styles.cardTitle}>Canales rápidos</Text>
            <Text style={styles.cardSubtitle}>
              Elige el canal más adecuado para tu solicitud.
            </Text>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => setIsTicketOpen(true)}
                style={[
                  UI.chip,
                  {
                    flex: 1,
                    borderColor: COLORS.accent,
                    backgroundColor: "rgba(226, 0, 106, 0.12)",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 12,
                  },
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={COLORS.accent}
                />
                <Text style={{ fontWeight: "800", color: COLORS.accent }}>
                  Crear ticket
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  Alert.alert("Soporte", "Abriremos el chat interno pronto.")
                }
                style={[
                  UI.chip,
                  {
                    flex: 1,
                    borderColor: COLORS.border,
                    backgroundColor: COLORS.porcelainAlt,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 12,
                  },
                ]}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={16}
                  color={COLORS.text}
                />
                <Text style={{ fontWeight: "800", color: COLORS.text }}>
                  Chat interno
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[UI.card, { padding: 14 }]}>
            <Text style={styles.cardTitle}>Preguntas frecuentes</Text>
            <Text style={styles.cardSubtitle}>
              Guías rápidas para resolver dudas.
            </Text>

            <View style={{ marginTop: 12, gap: 10 }}>
              {[
                {
                  key: "checkin",
                  label: "No puedo hacer check-in",
                  icon: "location-outline" as const,
                },
                {
                  key: "site",
                  label: "Cómo actualizar mi sede",
                  icon: "business-outline" as const,
                },
                {
                  key: "gps",
                  label: "Error en la ubicación GPS",
                  icon: "navigate-outline" as const,
                },
              ].map((item) => (
                <TouchableOpacity
                  key={item.key}
                  onPress={() =>
                    Alert.alert("FAQ", "Te mostraremos la guía pronto.")
                  }
                  style={UI.row}
                  activeOpacity={0.85}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      flex: 1,
                    }}
                  >
                    <Ionicons name={item.icon} size={18} color={COLORS.text} />
                    <Text
                      style={{ fontWeight: "800", color: COLORS.text, flex: 1 }}
                    >
                      {item.label}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={COLORS.neutral}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <SupportTicketModal
        visible={isTicketOpen}
        message={message}
        onChangeMessage={setMessage}
        onClose={() => setIsTicketOpen(false)}
        onSubmit={submitTicket}
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
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 6,
  },
});
