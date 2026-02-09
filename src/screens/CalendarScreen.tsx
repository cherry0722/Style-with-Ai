import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Calendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../utils/haptics';
import {
  getPlannerRange,
  patchPlanner,
  type PlannerEntry,
  type PlannerSlotLabel,
  type PlannerStatus,
} from '../api/planner';
import { Picker } from '@react-native-picker/picker';

const SLOT_LABELS: PlannerSlotLabel[] = ['morning', 'afternoon', 'evening', 'custom'];
const STATUSES: PlannerStatus[] = ['planned', 'worn', 'skipped'];

function getMonthRange(date: Date): { from: string; to: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const from = first.toISOString().slice(0, 10);
  const to = last.toISOString().slice(0, 10);
  return { from, to };
}

type Nav = NativeStackNavigationProp<RootStackParamList, 'Calendar'>;

export default function CalendarScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<PlannerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addSlotLabel, setAddSlotLabel] = useState<PlannerSlotLabel>('morning');
  const [addOccasion, setAddOccasion] = useState('');
  const [addOccasionError, setAddOccasionError] = useState<string | null>(null);
  const [patching, setPatching] = useState<string | null>(null);

  const { from, to } = getMonthRange(currentMonth);

  const fetchRange = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPlannerRange(from, to);
      setEntries(data.entries || []);
    } catch (err) {
      setToast((err as { message?: string })?.message || 'Failed to load planner');
      setTimeout(() => setToast(null), 2500);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useFocusEffect(
    useCallback(() => {
      fetchRange();
    }, [fetchRange])
  );

  const markedDates = React.useMemo(() => {
    const acc: Record<string, { marked: boolean; dotColor?: string; selectedColor?: string }> = {};
    for (const e of entries) {
      if (e.plans && e.plans.length > 0) {
        acc[e.date] = {
          marked: true,
          dotColor: theme.colors.accent,
          selectedColor: theme.colors.accent,
        };
      }
    }
    return acc;
  }, [entries, theme.colors.accent]);

  const selectedEntry = entries.find((e) => e.date === selectedDate);
  const plans = selectedEntry?.plans ?? [];

  const handleMonthChange = useCallback(
    (month: { year: number; month: number }) => {
      setCurrentMonth(new Date(month.year, month.month - 1));
    },
    []
  );

  const handleDateSelect = useCallback((day: DateData) => {
    setSelectedDate(day.dateString);
    setAddModalVisible(false);
    hapticFeedback.light();
  }, []);

  const updatePlanStatus = useCallback(
    async (planIndex: number, newStatus: PlannerStatus) => {
      const nextPlans = plans.map((p, i) =>
        i === planIndex ? { ...p, status: newStatus } : p
      );
      setEntries((prev) =>
        prev.map((e) =>
          e.date === selectedDate ? { ...e, plans: nextPlans } : e
        )
      );
      setPatching(selectedDate);
      try {
        await patchPlanner(selectedDate, nextPlans);
      } catch (err) {
        setToast((err as { message?: string })?.message || 'Update failed');
        setTimeout(() => setToast(null), 2500);
        setEntries((prev) =>
          prev.map((e) => (e.date === selectedDate ? { ...e, plans } : e))
        );
      } finally {
        setPatching(null);
      }
    },
    [selectedDate, plans]
  );

  const openAddModal = useCallback(() => {
    setAddOccasion('');
    setAddOccasionError(null);
    setAddSlotLabel('morning');
    setAddModalVisible(true);
  }, []);

  const handleContinueToSuggestions = useCallback(() => {
    const occasionTrimmed = addOccasion.trim();
    if (!occasionTrimmed) {
      setAddOccasionError('Occasion is required');
      return;
    }
    setAddOccasionError(null);
    setAddModalVisible(false);
    hapticFeedback.light();
    navigation.navigate('PlanOutfitSuggestions', {
      date: selectedDate,
      slotLabel: addSlotLabel,
      occasion: occasionTrimmed,
    });
  }, [selectedDate, addSlotLabel, addOccasion, navigation]);

  const goToHistory = useCallback(() => {
    hapticFeedback.light();
    navigation.navigate('History');
  }, [navigation]);

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const styles = createStyles(theme);

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Pressable style={styles.headerBack} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Calendar</Text>
          <Text style={styles.subtitle}>Plan your outfits by day</Text>
        </View>
        <Pressable style={styles.headerRight} onPress={goToHistory}>
          <Text style={styles.historyButtonText}>History</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.calendarContainer}>
            <Calendar
              current={`${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`}
              onDayPress={handleDateSelect}
              onMonthChange={handleMonthChange}
              markedDates={{
                ...markedDates,
                [selectedDate]: {
                  ...markedDates[selectedDate],
                  selected: true,
                  selectedColor: theme.colors.accent,
                },
              }}
              theme={{
                backgroundColor: theme.colors.backgroundSecondary,
                calendarBackground: theme.colors.backgroundSecondary,
                textSectionTitleColor: theme.colors.textPrimary,
                selectedDayBackgroundColor: theme.colors.accent,
                selectedDayTextColor: theme.colors.white,
                todayTextColor: theme.colors.accent,
                dayTextColor: theme.colors.textPrimary,
                textDisabledColor: theme.colors.textTertiary,
                dotColor: theme.colors.accent,
                selectedDotColor: theme.colors.white,
                arrowColor: theme.colors.accent,
                disabledArrowColor: theme.colors.textTertiary,
                monthTextColor: theme.colors.textPrimary,
                indicatorColor: theme.colors.accent,
                textDayFontWeight: '600',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '600',
                textDayFontSize: 16,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 14,
              }}
              style={styles.calendar}
            />
          </View>

          <View style={styles.dayDetail}>
            <Text style={styles.dayDetailTitle}>
              {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>

            {patching === selectedDate && (
              <View style={styles.savingRow}>
                <ActivityIndicator size="small" color={theme.colors.accent} />
                <Text style={styles.savingText}>Saving…</Text>
              </View>
            )}

            {plans.length === 0 ? (
              <View style={styles.noPlans}>
                <Text style={styles.noPlansText}>No plans for this day</Text>
                <Pressable style={styles.addPlanButton} onPress={openAddModal}>
                  <Ionicons name="add" size={18} color={theme.colors.white} />
                  <Text style={styles.addPlanButtonText}>Add plan</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {plans.map((plan, index) => (
                  <View
                    key={`${selectedDate}-${plan.slotLabel}-${index}`}
                    style={styles.planCard}
                  >
                    <View style={styles.planRow}>
                      <Text style={styles.planSlot}>{plan.slotLabel}</Text>
                      <Text style={styles.planOccasion}>{plan.occasion}</Text>
                    </View>
                    {plan.outfitId ? (
                      <View style={styles.statusRow}>
                        {STATUSES.map((s) => (
                          <Pressable
                            key={s}
                            style={[
                              styles.statusChip,
                              plan.status === s && styles.statusChipActive,
                            ]}
                            onPress={() => updatePlanStatus(index, s)}
                          >
                            <Text
                              style={[
                                styles.statusChipText,
                                plan.status === s && styles.statusChipTextActive,
                              ]}
                            >
                              {s}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))}
                <Pressable style={styles.addPlanButtonSecondary} onPress={openAddModal}>
                  <Ionicons name="add" size={18} color={theme.colors.accent} />
                  <Text style={styles.addPlanButtonSecondaryText}>Add plan</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      )}

      <Modal visible={addModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setAddModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Add plan</Text>
            <Text style={styles.addFormLabel}>Slot</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={addSlotLabel}
                onValueChange={(v) => setAddSlotLabel(v as PlannerSlotLabel)}
                style={styles.picker}
                dropdownIconColor={theme.colors.textPrimary}
              >
                {SLOT_LABELS.map((l) => (
                  <Picker.Item key={l} label={l} value={l} />
                ))}
              </Picker>
            </View>
            <Text style={styles.addFormLabel}>Occasion (required)</Text>
            <TextInput
              style={[styles.input, addOccasionError ? styles.inputError : null]}
              value={addOccasion}
              onChangeText={(t) => {
                setAddOccasion(t);
                setAddOccasionError(null);
              }}
              placeholder="e.g. casual, work"
              placeholderTextColor={theme.colors.textTertiary}
            />
            {addOccasionError ? (
              <Text style={styles.errorText}>{addOccasionError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelButton} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.continueButton, !addOccasion.trim() && styles.continueButtonDisabled]}
                onPress={handleContinueToSuggestions}
                disabled={!addOccasion.trim()}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {toast ? (
        <View style={styles.toastWrap}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerBack: { padding: theme.spacing.sm, marginRight: theme.spacing.xs },
    headerCenter: { flex: 1 },
    headerRight: { padding: theme.spacing.sm },
    title: {
      fontSize: theme.typography.xl,
      fontWeight: theme.typography.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    subtitle: {
      fontSize: theme.typography.sm,
      color: theme.colors.textSecondary,
    },
    historyButtonText: {
      fontSize: theme.typography.sm,
      fontWeight: '600',
      color: theme.colors.accent,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollView: { flex: 1 },
    calendarContainer: {
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
      marginTop: theme.spacing.lg,
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      ...theme.shadows.md,
    },
    calendar: { borderRadius: theme.borderRadius.lg },
    dayDetail: {
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
    },
    dayDetailTitle: {
      fontSize: theme.typography.lg,
      fontWeight: theme.typography.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
    },
    savingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    savingText: { fontSize: theme.typography.sm, color: theme.colors.textSecondary },
    noPlans: {
      alignItems: 'center',
      paddingVertical: theme.spacing.xl,
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.lg,
    },
    noPlansText: {
      fontSize: theme.typography.base,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.md,
    },
    addPlanButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
    },
    addPlanButtonText: {
      color: theme.colors.white,
      fontSize: theme.typography.sm,
      fontWeight: theme.typography.medium,
    },
    addPlanButtonSecondary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      marginTop: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    addPlanButtonSecondaryText: {
      color: theme.colors.accent,
      fontSize: theme.typography.sm,
      fontWeight: theme.typography.medium,
    },
    planCard: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      ...theme.shadows.sm,
    },
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    planSlot: {
      fontSize: theme.typography.sm,
      fontWeight: theme.typography.medium,
      color: theme.colors.accent,
      textTransform: 'capitalize',
      marginRight: theme.spacing.sm,
    },
    planOccasion: {
      fontSize: theme.typography.base,
      color: theme.colors.textPrimary,
      flex: 1,
    },
    statusRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    statusChip: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.border,
    },
    statusChipActive: { backgroundColor: theme.colors.accent },
    statusChipText: { fontSize: theme.typography.xs, color: theme.colors.textSecondary },
    statusChipTextActive: { color: theme.colors.white },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    modalContent: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.xl,
      width: '100%',
      maxWidth: 360,
    },
    modalTitle: {
      fontSize: theme.typography.lg,
      fontWeight: theme.typography.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.lg,
    },
    addFormLabel: {
      fontSize: theme.typography.sm,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xs,
      marginTop: theme.spacing.sm,
    },
    pickerWrap: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      overflow: 'hidden',
    },
    picker: { color: theme.colors.textPrimary },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      fontSize: theme.typography.base,
      color: theme.colors.textPrimary,
    },
    inputError: { borderColor: theme.colors.error },
    errorText: { fontSize: theme.typography.xs, color: theme.colors.error, marginTop: theme.spacing.xs },
    modalActions: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginTop: theme.spacing.xl,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.border,
      alignItems: 'center',
    },
    cancelButtonText: { fontSize: theme.typography.sm, color: theme.colors.textPrimary },
    continueButton: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
    },
    continueButtonDisabled: {
      opacity: 0.5,
      backgroundColor: theme.colors.border,
    },
    continueButtonText: { fontSize: theme.typography.sm, fontWeight: '600', color: theme.colors.white },
    toastWrap: {
      position: 'absolute',
      bottom: theme.spacing.xl,
      left: theme.spacing.lg,
      right: theme.spacing.lg,
      backgroundColor: theme.colors.textPrimary,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
    },
    toastText: { fontSize: theme.typography.sm, color: theme.colors.white, textAlign: 'center' },
  });
}
