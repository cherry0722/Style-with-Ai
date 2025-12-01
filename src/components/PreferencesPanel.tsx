import React from 'react';
import { View, Text, Pressable, Switch } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../utils/haptics';
import { OutfitPreferences } from '../types';

export interface Preferences {
  occasion?: string;
  style_vibe?: string;
  prefer_favorites?: boolean;
  avoid_colors?: string[];
}

interface PreferencesPanelProps {
  value: Preferences;
  onChange: (prefs: Preferences) => void;
}

export function PreferencesPanel({ value, onChange }: PreferencesPanelProps) {
  const theme = useTheme();

  const occasion = value.occasion;
  const styleVibe = value.style_vibe;
  const preferFavorites = !!value.prefer_favorites;
  const avoidColors = value.avoid_colors || [];

  const update = (patch: Partial<OutfitPreferences>) => {
    onChange({
      ...value,
      ...patch,
    });
  };

  const toggleOccasion = (opt: string) => {
    hapticFeedback.selection();
    update({ occasion: occasion === opt ? undefined : opt });
  };

  const toggleStyle = (opt: string) => {
    hapticFeedback.selection();
    update({ style_vibe: styleVibe === opt ? undefined : opt });
  };

  const toggleAvoidColor = (color: string) => {
    hapticFeedback.selection();
    const lower = color.toLowerCase();
    const next = avoidColors.includes(lower)
      ? avoidColors.filter((c) => c !== lower)
      : [...avoidColors, lower];
    update({ avoid_colors: next });
  };

  const setPreferFavorites = (val: boolean) => {
    hapticFeedback.selection();
    update({ prefer_favorites: val });
  };

  return (
    <View
      style={{
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.lg,
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: theme.spacing.md,
      }}
    >
      <Text
        style={{
          fontSize: theme.typography.sm,
          fontWeight: theme.typography.medium,
          color: theme.colors.textSecondary,
          marginBottom: theme.spacing.xs,
        }}
      >
        Outfit Preferences
      </Text>

      {/* Occasion */}
      <View style={{ marginBottom: theme.spacing.xs }}>
        <Text
          style={{
            fontSize: theme.typography.xs,
            color: theme.colors.textSecondary,
            marginBottom: theme.spacing.xs,
          }}
        >
          Occasion
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          {['casual', 'work', 'date-night', 'party'].map((opt) => (
            <Pressable
              key={opt}
              onPress={() => toggleOccasion(opt)}
              style={{
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: theme.spacing.xs,
                borderRadius: theme.borderRadius.md,
                backgroundColor: occasion === opt ? theme.colors.accent : theme.colors.backgroundSecondary,
                borderWidth: 1,
                borderColor: occasion === opt ? theme.colors.accent : theme.colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: theme.typography.xs,
                  color: occasion === opt ? theme.colors.white : theme.colors.textPrimary,
                  textTransform: 'capitalize',
                }}
              >
                {opt.replace('-', ' ')}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Style */}
      <View style={{ marginBottom: theme.spacing.xs }}>
        <Text
          style={{
            fontSize: theme.typography.xs,
            color: theme.colors.textSecondary,
            marginBottom: theme.spacing.xs,
          }}
        >
          Style
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          {['streetwear', 'classy', 'minimal', 'sporty'].map((opt) => (
            <Pressable
              key={opt}
              onPress={() => toggleStyle(opt)}
              style={{
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: theme.spacing.xs,
                borderRadius: theme.borderRadius.md,
                backgroundColor: styleVibe === opt ? theme.colors.accent : theme.colors.backgroundSecondary,
                borderWidth: 1,
                borderColor: styleVibe === opt ? theme.colors.accent : theme.colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: theme.typography.xs,
                  color: styleVibe === opt ? theme.colors.white : theme.colors.textPrimary,
                  textTransform: 'capitalize',
                }}
              >
                {opt}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Avoid colors */}
      <View style={{ marginBottom: theme.spacing.xs }}>
        <Text
          style={{
            fontSize: theme.typography.xs,
            color: theme.colors.textSecondary,
            marginBottom: theme.spacing.xs,
          }}
        >
          Avoid colors
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          {['red', 'yellow', 'green', 'blue'].map((color) => {
            const lower = color.toLowerCase();
            const isSelected = avoidColors.includes(lower);
            return (
              <Pressable
                key={color}
                onPress={() => toggleAvoidColor(color)}
                style={{
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: theme.spacing.xs,
                  borderRadius: theme.borderRadius.md,
                  backgroundColor: isSelected ? theme.colors.error : theme.colors.backgroundSecondary,
                  borderWidth: 1,
                  borderColor: isSelected ? theme.colors.error : theme.colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: theme.typography.xs,
                    color: isSelected ? theme.colors.white : theme.colors.textPrimary,
                    textTransform: 'capitalize',
                  }}
                >
                  {color}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Favorites */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: theme.spacing.xs,
        }}
      >
        <Text
          style={{
            fontSize: theme.typography.xs,
            color: theme.colors.textSecondary,
          }}
        >
          Prefer favorites first
        </Text>
        <Switch
          value={preferFavorites}
          onValueChange={setPreferFavorites}
          trackColor={{ false: theme.colors.border, true: theme.colors.accent + '80' }}
          thumbColor={preferFavorites ? theme.colors.accent : theme.colors.textTertiary}
        />
      </View>
    </View>
  );
}


