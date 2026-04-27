import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/constants/colors";

import type { FaqItem } from "./types";
import { SUPPORT_UI } from "./ui";

type Props = {
  items: FaqItem[];
  openFaqKey: string | null;
  onToggle: (key: string) => void;
};

export function SupportFaqSection({ items, openFaqKey, onToggle }: Props) {
  return (
    <View style={[SUPPORT_UI.card, { padding: 14 }]}>
      <Text style={styles.cardTitle}>Preguntas frecuentes</Text>
      <Text style={styles.cardSubtitle}>Guías rápidas para resolver dudas comunes.</Text>

      <View style={{ marginTop: 12, gap: 10 }}>
        {items.map((item) => {
          const open = openFaqKey === item.key;
          return (
            <View
              key={item.key}
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: open ? COLORS.accent : COLORS.border,
                backgroundColor: open ? "rgba(226, 0, 106, 0.06)" : COLORS.white,
              }}
            >
              <TouchableOpacity
                onPress={() => onToggle(item.key)}
                style={[SUPPORT_UI.row, { borderWidth: 0, backgroundColor: "transparent" }]}
                activeOpacity={0.85}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <Ionicons name={item.icon} size={18} color={COLORS.text} />
                  <Text style={{ fontWeight: "800", color: COLORS.text, flex: 1 }}>{item.label}</Text>
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
  );
}

const styles = {
  cardTitle: {
    fontSize: 15,
    fontWeight: "800" as const,
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.neutral,
    marginTop: 6,
  },
};
