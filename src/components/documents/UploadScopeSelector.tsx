import { Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "@/constants/colors";
import { DOCUMENTS_UI } from "@/components/documents/ui";
import type { DocumentScope } from "@/components/documents/types";

type UploadScopeSelectorProps = {
  scope: DocumentScope;
  canManageScopes: boolean;
  setScope: (value: DocumentScope) => void;
};

export function UploadScopeSelector({
  scope,
  canManageScopes,
  setScope,
}: UploadScopeSelectorProps) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
      <TouchableOpacity
        onPress={() => setScope("employee")}
        style={[
          DOCUMENTS_UI.chip,
          {
            flex: 1,
            borderColor: scope === "employee" ? COLORS.accent : COLORS.border,
            backgroundColor:
              scope === "employee" ? "rgba(226, 0, 106, 0.10)" : "white",
          },
        ]}
      >
        <Text style={{ textAlign: "center", fontWeight: "700", color: COLORS.text }}>
          Personal
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setScope("site")}
        disabled={!canManageScopes}
        style={[
          DOCUMENTS_UI.chip,
          {
            flex: 1,
            borderColor: scope === "site" ? COLORS.accent : COLORS.border,
            backgroundColor:
              scope === "site" ? "rgba(226, 0, 106, 0.10)" : "white",
            opacity: canManageScopes ? 1 : 0.4,
          },
        ]}
      >
        <Text style={{ textAlign: "center", fontWeight: "700", color: COLORS.text }}>
          Sede
        </Text>
      </TouchableOpacity>
    </View>
  );
}
