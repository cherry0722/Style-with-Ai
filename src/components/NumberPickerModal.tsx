import React, { useMemo, useState, useEffect } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { Picker } from "@react-native-picker/picker";

type Props = {
  visible: boolean;
  title: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;          // e.g., "cm", "lb"
  value?: number;
  onConfirm: (val: number) => void;
  onClose: () => void;
};

export default function NumberPickerModal({
  visible,
  title,
  min,
  max,
  step = 1,
  unit,
  value,
  onConfirm,
  onClose,
}: Props) {
  const options = useMemo(() => {
    const arr: number[] = [];
    for (let v = min; v <= max; v += step) arr.push(v);
    return arr;
  }, [min, max, step]);

  const [selected, setSelected] = useState<number>(value ?? min);
  useEffect(() => setSelected(value ?? min), [value, min]);

  function handleDone() {
    onConfirm(selected);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)" }} onPress={onClose}>
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#fff",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: 16,
          }}
        >
          <Text style={{ fontWeight: "800", fontSize: 16, textAlign: "center", marginBottom: 8 }}>
            {title}
          </Text>

          <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 12, overflow: "hidden" }}>
            <Picker
              selectedValue={selected}
              onValueChange={(v) => setSelected(Number(v))}
              style={{ height: 200 }}
            >
              {options.map((v) => (
                <Picker.Item key={v} label={`${v}${unit ? ` ${unit}` : ""}`} value={v} />
              ))}
            </Picker>
          </View>

          <Pressable onPress={handleDone} style={{ marginTop: 12, backgroundColor: "#111", borderRadius: 12, padding: 14, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Done</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

