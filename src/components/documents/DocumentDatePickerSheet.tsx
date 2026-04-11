import { Modal, Text, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "@/constants/colors";
import { DOCUMENTS_UI } from "@/components/documents/ui";

type DocumentDatePickerSheetProps = {
  visible: boolean;
  title: string;
  value: Date;
  minimumDate?: Date;
  maximumDate?: Date;
  onClose: () => void;
  onChange: (date: Date) => void;
  onConfirm: () => void;
};

export function DocumentDatePickerSheet({
  visible,
  title,
  value,
  minimumDate,
  maximumDate,
  onClose,
  onChange,
  onConfirm,
}: DocumentDatePickerSheetProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: "white",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text }}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={value}
            mode="date"
            display="spinner"
            onChange={(_, date) => {
              if (date) onChange(date);
            }}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            style={{ height: 200 }}
          />
          <TouchableOpacity
            onPress={onConfirm}
            style={[
              DOCUMENTS_UI.chip,
              {
                marginTop: 16,
                borderColor: COLORS.accent,
                backgroundColor: "rgba(226, 0, 106, 0.10)",
                paddingVertical: 12,
                alignItems: "center",
              },
            ]}
          >
            <Text style={{ fontWeight: "800", color: COLORS.accent }}>Confirmar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
