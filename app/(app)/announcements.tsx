import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { COLORS } from "@/constants/colors"

type Announcement = {
  id: string
  title: string
  body: string
  tag: "IMPORTANTE" | "INFO" | "ALERTA"
  date: string
}

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "a-1",
    title: "Nueva politica de turnos",
    body: "A partir del lunes, los check-ins deben hacerse dentro del radio definido por cada sede.",
    tag: "IMPORTANTE",
    date: "22 ene 2026",
  },
  {
    id: "a-2",
    title: "Mantenimiento programado",
    body: "El sistema estara en mantenimiento este sabado de 2:00 a 4:00 a.m.",
    tag: "ALERTA",
    date: "19 ene 2026",
  },
  {
    id: "a-3",
    title: "Nuevo modulo de documentos",
    body: "Pronto podras firmar documentos desde la app sin salir de ANIMA.",
    tag: "INFO",
    date: "15 ene 2026",
  },
]

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
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
} as const

function getTagTone(tag: Announcement["tag"]) {
  if (tag === "IMPORTANTE") return COLORS.accent
  if (tag === "ALERTA") return COLORS.rosegold
  return COLORS.neutral
}

export default function AnnouncementsScreen() {
  const insets = useSafeAreaInsets()

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: Math.max(16, insets.top + 8),
          paddingBottom: 40,
        }}
      >
        <Text style={styles.title}>Novedades</Text>
        <Text style={styles.subtitle}>Comunicados y anuncios internos.</Text>

        <View style={{ marginTop: 18, gap: 12 }}>
          {ANNOUNCEMENTS.map((item) => {
            const tone = getTagTone(item.tag)
            return (
              <View key={item.id} style={[UI.card, { padding: 14 }]}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardDate}>{item.date}</Text>
                  </View>
                  <View
                    style={[
                      UI.tag,
                      {
                        borderColor: tone,
                        backgroundColor: "rgba(242, 238, 242, 0.7)",
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color: tone }}>
                      {item.tag}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardBody}>{item.body}</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
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
  cardDate: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 4,
  },
  cardBody: {
    fontSize: 13,
    color: COLORS.text,
    marginTop: 10,
    lineHeight: 18,
  },
})
