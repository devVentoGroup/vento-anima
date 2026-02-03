import { ScrollView, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { COLORS } from "@/constants/colors"
import { ANNOUNCEMENTS } from "@/components/announcements/data"
import AnnouncementCard from "@/components/announcements/AnnouncementCard"

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
          {ANNOUNCEMENTS.map((item) => (
            <AnnouncementCard key={item.id} announcement={item} />
          ))}
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
})
