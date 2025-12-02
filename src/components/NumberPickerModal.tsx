import React, { useMemo, useState, useEffect } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useTheme } from "../context/ThemeContext";

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
  const theme = useTheme();
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

  const styles = createStyles(theme);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>
            {title}
          </Text>

          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selected}
              onValueChange={(v) => setSelected(Number(v))}
              style={styles.picker}
            >
              {options.map((v) => (
                <Picker.Item 
                  key={v} 
                  label={`${v}${unit ? ` ${unit}` : ""}`} 
                  value={v}
                  color={theme.colors.textPrimary}
                />
              ))}
            </Picker>
          </View>

          <Pressable onPress={handleDone} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderTopLeftRadius: theme.borderRadius["2xl"],
      borderTopRightRadius: theme.borderRadius["2xl"],
      padding: theme.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    title: {
      fontWeight: theme.typography.extrabold,
      fontSize: theme.typography.base,
      textAlign: "center",
      marginBottom: theme.spacing.md,
      color: theme.colors.textPrimary,
    },
    pickerContainer: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.lg,
      overflow: "hidden",
      backgroundColor: theme.colors.background,
    },
    picker: {
      height: 200,
    },
    doneButton: {
      marginTop: theme.spacing.md,
      backgroundColor: theme.colors.accent,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      alignItems: "center",
    },
    doneButtonText: {
      color: theme.colors.white,
      fontWeight: theme.typography.bold,
      fontSize: theme.typography.base,
    },
  });
