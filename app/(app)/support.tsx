import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
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
import {
  CONTENT_HORIZONTAL_PADDING,
  CONTENT_MAX_WIDTH,
} from "@/constants/layout";
import ContactWorkerModal, { type WorkerOption } from "@/components/support/ContactWorkerModal";
import SupportTicketModal from "@/components/support/SupportTicketModal";
import { useSupportActions } from "@/components/support/use-support-actions";
import { useSupportData } from "@/components/support/use-support-data";
import { SUPPORT_UI } from "@/components/support/ui";
import { useAuth } from "@/contexts/auth-context";
import type { FaqItem, TicketStatus } from "@/components/support/types";

const UI = SUPPORT_UI;

const FAQ_ITEMS: FaqItem[] = [
  {
    key: "checkin",
    label: "No puedo hacer check-in",
    icon: "location-outline",
    content: [
      "Verifica que tengas internet estable y vuelve a actualizar la ubicación desde Home.",
      "Confirma que estás dentro del radio permitido de la sede y con precisión GPS suficiente.",
      "Si sigue fallando, crea un ticket con captura del mensaje y hora del intento.",
    ],
  },
  {
    key: "site",
    label: "Cómo actualizar mi sede",
    icon: "business-outline",
    content: [
      "La sede principal la gestiona un gerente, gerente general o propietario desde Equipo.",
      "Si trabajas en varias sedes, selecciona la sede correcta antes del check-in.",
      "Después del cambio, refresca Home para recargar permisos y geocerca.",
    ],
  },
  {
    key: "gps",
    label: "Error en la ubicación GPS",
    icon: "navigate-outline",
    content: [
      "Activa GPS de alta precisión y evita registrar asistencia en interiores sin señal.",
      "Desactiva apps de ubicación simulada o modo desarrollador con mock location.",
      "Si Android no muestra el permiso en app, ve a Ajustes del sistema y habilítalo manualmente.",
    ],
  },
  {
    key: "android-permissions",
    label: "Cómo activar permisos en Android",
    icon: "phone-portrait-outline",
    content: [
      "En Configuración > Permisos de ANIMA, habilita Ubicación y Notificaciones.",
      "Si el permiso aparece bloqueado, usa el botón Abrir ajustes en Configuración de ANIMA.",
      "Vuelve a la app y entra a Home para que el estado de permisos se refresque.",
    ],
  },
  {
    key: "break",
    label: "Cómo usar descanso de turno",
    icon: "cafe-outline",
    content: [
      "Con turno activo verás el botón Tomar descanso debajo del registro de entrada/salida.",
      "Mientras estás en descanso, el contador neto no aumenta.",
      "Al finalizar descanso o cerrar turno, el tiempo neto se calcula descontando la pausa.",
    ],
  },
  {
    key: "export-role",
    label: "Cómo exportar asistencia por rol",
    icon: "download-outline",
    content: [
      "Trabajadores y roles no gerenciales exportan solo su registro personal.",
      "Gerentes exportan asistencia global de su sede seleccionada.",
      "Propietario y gerente general pueden exportar global o por trabajador individual.",
    ],
  },
];

function statusMeta(status: TicketStatus) {
  if (status === "open") {
    return { label: "Abierto", color: COLORS.accent, bg: "rgba(226, 0, 106, 0.10)" };
  }
  if (status === "in_progress") {
    return { label: "En progreso", color: "#B45309", bg: "#FFFBEB" };
  }
  if (status === "resolved") {
    return { label: "Resuelto", color: "#0F766E", bg: "#ECFEFF" };
  }
  return { label: "Cerrado", color: COLORS.neutral, bg: COLORS.porcelainAlt };
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MANAGEMENT_ROLES = new Set(["propietario", "gerente_general", "gerente"]);

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { user, employee, selectedSiteId } = useAuth();
  const role = employee?.role ?? null;
  const canContactWorker = Boolean(role && MANAGEMENT_ROLES.has(role));
  const managerSiteId = role === "gerente" ? (employee?.siteId ?? selectedSiteId ?? null) : null;
  const [openFaqKey, setOpenFaqKey] = useState<string | null>(null);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const {
    workersForContact,
    isLoadingWorkers,
    tickets,
    isLoadingTickets,
    isRefreshing,
    selectedTicketId,
    setSelectedTicketId,
    selectedTicket,
    messages,
    isLoadingMessages,
    loadTickets,
    loadMessages,
    handleRefresh,
  } = useSupportData({
    userId: user?.id,
    canContactWorker,
    role,
    managerSiteId,
    contactModalVisible,
  });
  const {
    isTicketOpen,
    setIsTicketOpen,
    ticketTitle,
    setTicketTitle,
    ticketMessage,
    setTicketMessage,
    isCreatingTicket,
    contactMode,
    setContactMode,
    selectedWorker,
    setSelectedWorker,
    contactMessage,
    setContactMessage,
    isSubmittingContact,
    newMessage,
    setNewMessage,
    isSendingMessage,
    submitTicket,
    sendMessage,
    submitContactWorker,
  } = useSupportActions({
    userId: user?.id,
    employeeSiteId: employee?.siteId,
    selectedSiteId: selectedSiteId ?? null,
    selectedTicketId,
    loadTickets,
    loadMessages,
    setSelectedTicketId,
  });
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
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <Text style={styles.title}>Soporte</Text>
        <Text style={styles.subtitle}>
          Chat interno por tickets para atender novedades operativas.
        </Text>

        <View style={{ marginTop: 18, gap: 12 }}>
          <View style={[UI.card, { padding: 14 }]}>
            <Text style={styles.cardTitle}>Canales rápidos</Text>
            <Text style={styles.cardSubtitle}>
              Crea ticket y conversa con soporte en el hilo interno.
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
                <Ionicons name="create-outline" size={16} color={COLORS.accent} />
                <Text style={{ fontWeight: "800", color: COLORS.accent }}>
                  Crear ticket
                </Text>
              </TouchableOpacity>

              <View
                style={[
                  UI.chip,
                  {
                    flex: 1,
                    borderColor: COLORS.border,
                    backgroundColor: COLORS.porcelainAlt,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 12,
                  },
                ]}
              >
                <Text style={{ fontWeight: "700", color: COLORS.text }}>
                  Chat activo
                </Text>
              </View>
            </View>
          </View>

          {canContactWorker ? (
            <View style={[UI.card, { padding: 14 }]}>
              <Text style={styles.cardTitle}>Contactar a un trabajador</Text>
              <Text style={styles.cardSubtitle}>
                Envía un aviso o inicia una conversación con un trabajador. Lo verá en su Soporte.
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => {
                    setContactMode("aviso");
                    setSelectedWorker(null);
                    setContactMessage("");
                    setContactModalVisible(true);
                  }}
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
                  <Ionicons name="megaphone-outline" size={16} color={COLORS.accent} />
                  <Text style={{ fontWeight: "800", color: COLORS.accent }}>Enviar aviso</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setContactMode("conversacion");
                    setSelectedWorker(null);
                    setContactMessage("");
                    setContactModalVisible(true);
                  }}
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
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.accent} />
                  <Text style={{ fontWeight: "800", color: COLORS.accent }}>Iniciar conversación</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <View style={[UI.card, { padding: 14 }]}>
            <Text style={styles.cardTitle}>Tickets</Text>
            <Text style={styles.cardSubtitle}>
              Selecciona un ticket para abrir el chat interno.
            </Text>

            {isLoadingTickets ? (
              <View style={{ marginTop: 14, alignItems: "center" }}>
                <ActivityIndicator color={COLORS.accent} />
              </View>
            ) : null}

            {!isLoadingTickets && tickets.length === 0 ? (
              <View
                style={{
                  marginTop: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.porcelainAlt,
                  padding: 12,
                }}
              >
                <Text style={{ color: COLORS.neutral, fontSize: 12 }}>
                  No tienes tickets abiertos. Crea uno para iniciar el chat.
                </Text>
              </View>
            ) : null}

            <View style={{ marginTop: 12, gap: 10 }}>
              {tickets.map((ticket) => {
                const status = statusMeta(ticket.status);
                const active = selectedTicketId === ticket.id;
                return (
                  <TouchableOpacity
                    key={ticket.id}
                    onPress={() => setSelectedTicketId(ticket.id)}
                    style={[
                      UI.row,
                      {
                        borderColor: active ? COLORS.accent : COLORS.border,
                        backgroundColor: active
                          ? "rgba(226, 0, 106, 0.06)"
                          : COLORS.white,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ fontWeight: "800", color: COLORS.text }}>
                        {ticket.title}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          color: COLORS.neutral,
                          marginTop: 4,
                        }}
                      >
                        {ticket.siteName ?? "Sin sede"} -{" "}
                        {formatDateTime(ticket.updated_at)}
                      </Text>
                    </View>
                    <View
                      style={{
                        borderRadius: 999,
                        paddingVertical: 5,
                        paddingHorizontal: 10,
                        backgroundColor: status.bg,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "800",
                          color: status.color,
                        }}
                      >
                        {status.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {selectedTicket ? (
            <View style={[UI.card, { padding: 14 }]}>
              <Text style={styles.cardTitle}>Chat interno</Text>
              <Text style={styles.cardSubtitle}>
                Ticket: {selectedTicket.title}
              </Text>

              {isLoadingMessages ? (
                <View style={{ marginTop: 12, alignItems: "center" }}>
                  <ActivityIndicator color={COLORS.accent} />
                </View>
              ) : (
                <View
                  style={{
                    marginTop: 12,
                    gap: 8,
                    maxHeight: 300,
                  }}
                >
                  {messages.length === 0 ? (
                    <Text style={{ color: COLORS.neutral, fontSize: 12 }}>
                      Aún no hay mensajes en este ticket.
                    </Text>
                  ) : (
                    messages.map((message) => {
                      const isOwn = message.author_id === user?.id;
                      return (
                        <View
                          key={message.id}
                          style={{
                            alignSelf: isOwn ? "flex-end" : "flex-start",
                            maxWidth: "85%",
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: isOwn ? COLORS.accent : COLORS.border,
                            backgroundColor: isOwn
                              ? "rgba(226, 0, 106, 0.10)"
                              : COLORS.porcelainAlt,
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                          }}
                        >
                          <Text style={{ color: COLORS.text, fontSize: 13 }}>
                            {message.body}
                          </Text>
                          <Text
                            style={{
                              marginTop: 4,
                              color: COLORS.neutral,
                              fontSize: 10,
                            }}
                          >
                            {formatDateTime(message.created_at)}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
                <TextInput
                  value={newMessage}
                  onChangeText={setNewMessage}
                  placeholder="Escribe un mensaje..."
                  placeholderTextColor={COLORS.neutral}
                  style={styles.messageInput}
                />
                <TouchableOpacity
                  onPress={sendMessage}
                  disabled={isSendingMessage || !newMessage.trim()}
                  style={[
                    UI.chip,
                    {
                      borderColor: COLORS.accent,
                      backgroundColor: "rgba(226, 0, 106, 0.12)",
                      justifyContent: "center",
                      opacity:
                        isSendingMessage || !newMessage.trim() ? 0.6 : 1,
                    },
                  ]}
                >
                  {isSendingMessage ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                  ) : (
                    <Ionicons name="send-outline" size={16} color={COLORS.accent} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <View style={[UI.card, { padding: 14 }]}>
            <Text style={styles.cardTitle}>Preguntas frecuentes</Text>
            <Text style={styles.cardSubtitle}>Guías rápidas para resolver dudas comunes.</Text>

            <View style={{ marginTop: 12, gap: 10 }}>
              {FAQ_ITEMS.map((item) => {
                const open = openFaqKey === item.key;
                return (
                  <View
                    key={item.key}
                    style={{
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: open ? COLORS.accent : COLORS.border,
                      backgroundColor: open
                        ? "rgba(226, 0, 106, 0.06)"
                        : COLORS.white,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => setOpenFaqKey(open ? null : item.key)}
                      style={[UI.row, { borderWidth: 0, backgroundColor: "transparent" }]}
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
                        name={open ? "chevron-up" : "chevron-forward"}
                        size={18}
                        color={COLORS.neutral}
                      />
                    </TouchableOpacity>

                    {open ? (
                      <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                        {item.content.map((paragraph, index) => (
                          <Text
                            key={`${item.key}-${index}`}
                            style={{
                              fontSize: 12,
                              color: COLORS.neutral,
                              lineHeight: 18,
                              marginTop: index === 0 ? 0 : 8,
                            }}
                          >
                            {paragraph}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      <SupportTicketModal
        visible={isTicketOpen}
        title={ticketTitle}
        message={ticketMessage}
        isSubmitting={isCreatingTicket}
        onChangeTitle={setTicketTitle}
        onChangeMessage={setTicketMessage}
        onClose={() => setIsTicketOpen(false)}
        onSubmit={submitTicket}
      />

      <ContactWorkerModal
        visible={contactModalVisible}
        workers={workersForContact}
        isLoadingWorkers={isLoadingWorkers}
        selectedWorker={selectedWorker}
        onSelectWorker={setSelectedWorker}
        onClose={() => {
          setContactModalVisible(false);
          setSelectedWorker(null);
          setContactMessage("");
        }}
        mode={contactMode}
        message={contactMessage}
        onChangeMessage={setContactMessage}
        isSubmitting={isSubmittingContact}
        onSubmit={submitContactWorker}
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
  messageInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.porcelainAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
  },
});
