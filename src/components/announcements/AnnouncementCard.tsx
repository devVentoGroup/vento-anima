import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "@/constants/colors";
import { ANNOUNCEMENTS_UI } from "@/components/announcements/ui";
import type { Announcement } from "@/components/announcements/types";

type AnnouncementCardProps = {
  announcement: Announcement;
};

const getTagTone = (tag: Announcement["tag"]) => {
  if (tag === "IMPORTANTE") return COLORS.accent;
  if (tag === "ALERTA") return COLORS.rosegold;
  return COLORS.neutral;
};

export default function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  const tone = getTagTone(announcement.tag);

  return (
    <View style={[ANNOUNCEMENTS_UI.card, styles.card]}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.cardTitle}>{announcement.title}</Text>
          <Text style={styles.cardDate}>{announcement.date}</Text>
        </View>
        <View
          style={[
            ANNOUNCEMENTS_UI.tag,
            {
              borderColor: tone,
              backgroundColor: "rgba(242, 238, 242, 0.7)",
            },
          ]}
        >
          <Text style={[styles.tagText, { color: tone }]}>
            {announcement.tag}
          </Text>
        </View>
      </View>
      <Text style={styles.cardBody}>{announcement.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
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
  tagText: {
    fontSize: 11,
    fontWeight: "700",
  },
});

