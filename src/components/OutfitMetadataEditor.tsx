import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  ActionSheetIOS,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import type { GarmentCategory } from "../types";

export const CATEGORY_OPTIONS: GarmentCategory[] = [
  "top",
  "bottom",
  "shoes",
  "outerwear",
  "accessory",
];

export const TYPE_OPTIONS_BY_CATEGORY: Record<string, string[]> = {
  top: ["t-shirt", "shirt", "hoodie", "sweatshirt", "polo", "kurta", "tank", "long-sleeve"],
  bottom: ["jeans", "trousers", "shorts", "joggers", "cargo", "skirt"],
  shoes: ["sneakers", "boots", "formal", "sandals"],
  outerwear: ["jacket", "coat", "blazer", "sweater"],
  accessory: ["cap", "belt", "watch", "scarf", "bag"],
};

export const FABRIC_OPTIONS = [
  "cotton",
  "denim",
  "wool",
  "linen",
  "polyester",
  "silk",
  "leather",
  "synthetic",
  "blend",
  "unknown",
] as const;

export const COLOR_FAMILY_OPTIONS = [
  "neutral",
  "warm",
  "cool",
  "vibrant",
  "pastel",
  "earthy",
] as const;

export const PATTERN_OPTIONS = [
  "solid",
  "striped",
  "plaid",
  "tartan",
  "printed",
  "graphic",
  "colorblock",
  "checked",
  "dotted",
  "unknown",
] as const;

export const FIT_OPTIONS = [
  "regular",
  "slim",
  "oversized",
  "relaxed",
  "skinny",
  "loose",
  "tailored",
  "unknown",
] as const;

export const STYLE_TAG_OPTIONS = [
  "casual",
  "streetwear",
  "minimal",
  "sporty",
  "formal",
  "athleisure",
  "retro",
  "y2k",
  "korean",
  "party",
  "business-casual",
] as const;

type OutfitMetadataEditorProps = {
  category: GarmentCategory;
  type: string | null;
  fabric: string | null;
  colorName: string;
  colorFamily: string | null;
  pattern: string | null;
  fit: string | null;
  styleTags: string[];
  onChangeCategory: (value: GarmentCategory) => void;
  onChangeType: (value: string | null) => void;
  onChangeFabric: (value: string | null) => void;
  onChangeColorName: (value: string) => void;
  onChangeColorFamily: (value: string | null) => void;
  onChangePattern: (value: string | null) => void;
  onChangeFit: (value: string | null) => void;
  onToggleStyleTag: (value: string) => void;
};

const OutfitMetadataEditor: React.FC<OutfitMetadataEditorProps> = ({
  category,
  type,
  fabric,
  colorName,
  colorFamily,
  pattern,
  fit,
  styleTags,
  onChangeCategory,
  onChangeType,
  onChangeFabric,
  onChangeColorName,
  onChangeColorFamily,
  onChangePattern,
  onChangeFit,
  onToggleStyleTag,
}) => {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const showSelectSheet = (
    label: string,
    options: string[],
    current: string | null,
    onSelect: (value: string | null) => void
  ) => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: label,
          options: ["Cancel", ...options],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) return;
          const selected = options[buttonIndex - 1];
          onSelect(selected);
        }
      );
    } else {
      Alert.alert(
        label,
        undefined,
        [
          ...options.map((opt) => ({
            text: opt,
            onPress: () => onSelect(opt),
          })),
          {
            text: "Clear",
            style: "destructive",
            onPress: () => onSelect(null),
          },
          {
            text: "Cancel",
            style: "cancel",
          },
        ],
        { cancelable: true }
      );
    }
  };

  const currentTypeOptions = TYPE_OPTIONS_BY_CATEGORY[category] ?? [];

  const renderSelectField = (
    label: string,
    value: string | null,
    options: string[],
    onSelect: (value: string | null) => void
  ) => {
    const displayValue = value || "Select";
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>{label}</Text>
        <Pressable
          style={styles.selectInput}
          onPress={() => showSelectSheet(label, options, value, onSelect)}
        >
          <Text
            style={[
              styles.selectText,
              !value && { color: theme.colors.textTertiary },
            ]}
          >
            {displayValue}
          </Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      </View>
    );
  };

  return (
    <View>
      {/* Details Section */}
      <Text style={styles.sectionTitle}>Details</Text>
      {renderSelectField("Category", category, CATEGORY_OPTIONS, (val) =>
        val ? onChangeCategory(val as GarmentCategory) : null
      )}
      {renderSelectField("Type", type, currentTypeOptions, onChangeType)}
      {renderSelectField("Fabric", fabric, FABRIC_OPTIONS as unknown as string[], onChangeFabric)}

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Color name</Text>
        <TextInput
          value={colorName}
          onChangeText={onChangeColorName}
          placeholder="e.g. light blue, charcoal, off-white"
          placeholderTextColor={theme.colors.textTertiary}
          style={styles.textInput}
        />
      </View>

      {renderSelectField(
        "Color family",
        colorFamily,
        COLOR_FAMILY_OPTIONS as unknown as string[],
        onChangeColorFamily
      )}

      {renderSelectField(
        "Pattern",
        pattern,
        PATTERN_OPTIONS as unknown as string[],
        onChangePattern
      )}

      {renderSelectField("Fit", fit, FIT_OPTIONS as unknown as string[], onChangeFit)}

      {/* Style & Vibe Section */}
      <Text style={[styles.sectionTitle, { marginTop: theme.spacing.lg }]}>
        Style & Vibe
      </Text>
      <View style={styles.chipGroup}>
        {STYLE_TAG_OPTIONS.map((tag) => {
          const isSelected = styleTags.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => onToggleStyleTag(tag)}
              style={[
                styles.chip,
                isSelected && styles.chipSelected,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextSelected,
                ]}
              >
                {tag}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    sectionTitle: {
      fontSize: theme.typography.base,
      fontWeight: theme.typography.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
    },
    fieldContainer: {
      marginBottom: theme.spacing.md,
    },
    label: {
      fontSize: theme.typography.sm,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    selectInput: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundSecondary,
    },
    selectText: {
      fontSize: theme.typography.base,
      color: theme.colors.textPrimary,
    },
    textInput: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundSecondary,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontSize: theme.typography.base,
      color: theme.colors.textPrimary,
    },
    chipGroup: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.xl,
    },
    chip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundSecondary,
    },
    chipSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    chipText: {
      fontSize: theme.typography.sm,
      color: theme.colors.textSecondary,
    },
    chipTextSelected: {
      color: theme.colors.white,
    },
  });

export default OutfitMetadataEditor;


