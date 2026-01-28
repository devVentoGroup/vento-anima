import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/constants/colors";

const UI = {
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.text,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
} as const;

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
          paddingHorizontal: 20,
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

      <Modal transparent visible={isTicketOpen} animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsTicketOpen(false)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={styles.modalCard}
          >
            <Text style={styles.modalTitle}>Nuevo ticket</Text>
            <Text style={styles.modalSubtitle}>
              Describe el problema con el mayor detalle posible.
            </Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Ej: No puedo registrar entrada en Vento Group."
              placeholderTextColor={COLORS.neutral}
              multiline
              style={styles.input}
            />

            <View
              style={{
                flexDirection: "row",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <TouchableOpacity
                onPress={() => setIsTicketOpen(false)}
                style={[
                  UI.chip,
                  {
                    borderColor: COLORS.border,
                    backgroundColor: COLORS.porcelainAlt,
                  },
                ]}
              >
                <Text style={{ fontWeight: "700", color: COLORS.text }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitTicket}
                style={[
                  UI.chip,
                  {
                    borderColor: COLORS.accent,
                    backgroundColor: "rgba(226, 0, 106, 0.12)",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  },
                ]}
              >
                <Ionicons name="send-outline" size={16} color={COLORS.accent} />
                <Text style={{ fontWeight: "800", color: COLORS.accent }}>
                  Enviar
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 20,
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 6,
  },
  input: {
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    padding: 12,
    marginTop: 12,
    marginBottom: 12,
    color: COLORS.text,
    textAlignVertical: "top",
  },
});
