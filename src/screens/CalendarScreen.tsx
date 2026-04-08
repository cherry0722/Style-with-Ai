import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSettings } from '../store/settings';
import {
  requestCalendarPermission,
  fetchEventsForDate,
  DeviceCalendarEvent,
  formatEventTime,
} from '../services/deviceCalendar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Calendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { hapticFeedback } from '../utils/haptics';
import {
  getPlannerRange,
  patchPlanner,
  type PlannerEntry,
  type PlannerSlotLabel,
  type PlannerStatus,
} from '../api/planner';
import { Picker } from '@react-native-picker/picker';

// ─── Design palette ──────────────────────────────────────────────────────────
const P = {
  background:    '#F5F0E8',
  cardSurface:   '#EDE6D8',
  cardWhite:     '#FFFFFF',
  primaryText:   '#3D3426',
  secondaryText: '#8C7E6A',
  lightText:     '#B5A894',
  accent:        '#C4A882',
  border:        '#E8E0D0',
  shadow:        'rgba(61, 52, 38, 0.08)',
  error:         '#C8706A',
} as const;

const SLOT_LABELS: PlannerSlotLabel[]  = ['morning', 'afternoon', 'evening', 'custom'];
const STATUSES: PlannerStatus[] = ['planned', 'worn', 'skipped'];

function getMonthRange(date: Date): { from: string; to: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const from = new Date(y, m, 1).toISOString().slice(0, 10);
  const to   = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

type Nav = NativeStackNavigationProp<RootStackParamList, 'Calendar'>;

export default function CalendarScreen() {
  const navigation = useNavigation<Nav>();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [entries, setEntries]   = useState<PlannerEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState<string | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addSlotLabel, setAddSlotLabel]       = useState<PlannerSlotLabel>('morning');
  const [addOccasion, setAddOccasion]         = useState('');
  const [addOccasionError, setAddOccasionError] = useState<string | null>(null);
  const [patching, setPatching] = useState<string | null>(null);

  const calendarConnected = useSettings(s => s.calendarConnected);
  const setCalendarConnected = useSettings(s => s.setCalendarConnected);
  const [deviceEvents, setDeviceEvents] = useState<DeviceCalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const { from, to } = getMonthRange(currentMonth);

  const fetchRange = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPlannerRange(from, to);
      setEntries(data.entries || []);
    } catch (err) {
      const msg = (err as { message?: string })?.message || 'Failed to load planner';
      setToast(msg);
      setTimeout(() => setToast(null), 2500);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useFocusEffect(useCallback(() => { fetchRange(); }, [fetchRange]));

  useEffect(() => {
    if (!calendarConnected || !selectedDate) return;
    setEventsLoading(true);
    fetchEventsForDate(selectedDate)
      .then(setDeviceEvents)
      .catch(() => setDeviceEvents([]))
      .finally(() => setEventsLoading(false));
  }, [selectedDate, calendarConnected]);

  const markedDates = React.useMemo(() => {
    const acc: Record<string, { marked: boolean; dotColor?: string }> = {};
    for (const e of entries) {
      if (e.plans && e.plans.length > 0) {
        acc[e.date] = { marked: true, dotColor: P.accent };
      }
    }
    return acc;
  }, [entries]);

  const selectedEntry = entries.find((e) => e.date === selectedDate);
  const plans = selectedEntry?.plans ?? [];

  const handleMonthChange = useCallback(
    (month: { year: number; month: number }) => {
      setCurrentMonth(new Date(month.year, month.month - 1));
    }, []
  );

  const handleDateSelect = useCallback((day: DateData) => {
    setSelectedDate(day.dateString);
    setAddModalVisible(false);
    hapticFeedback.light();
  }, []);

  const updatePlanStatus = useCallback(async (planIndex: number, newStatus: PlannerStatus) => {
    const nextPlans = plans.map((p, i) => i === planIndex ? { ...p, status: newStatus } : p);
    setEntries((prev) => prev.map((e) => e.date === selectedDate ? { ...e, plans: nextPlans } : e));
    setPatching(selectedDate);
    try {
      await patchPlanner(selectedDate, nextPlans);
    } catch (err) {
      setToast((err as { message?: string })?.message || 'Update failed');
      setTimeout(() => setToast(null), 2500);
      setEntries((prev) => prev.map((e) => e.date === selectedDate ? { ...e, plans } : e));
    } finally {
      setPatching(null);
    }
  }, [selectedDate, plans]);

  const openAddModal = useCallback(() => {
    setAddOccasion('');
    setAddOccasionError(null);
    setAddSlotLabel('morning');
    setAddModalVisible(true);
  }, []);

  const handleContinueToSuggestions = useCallback(() => {
    const occ = addOccasion.trim();
    if (!occ) { setAddOccasionError('Occasion is required'); return; }
    setAddOccasionError(null);
    setAddModalVisible(false);
    hapticFeedback.light();
    navigation.navigate('PlanOutfitSuggestions', { date: selectedDate, slotLabel: addSlotLabel, occasion: occ });
  }, [selectedDate, addSlotLabel, addOccasion, navigation]);

  const handleConnectCalendar = async () => {
    const granted = await requestCalendarPermission();
    if (granted) {
      await setCalendarConnected(true);
    } else {
      Alert.alert(
        'Calendar Access Needed',
        'Please allow calendar access in Settings to sync your schedule.',
        [{ text: 'OK' }]
      );
    }
  };

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={goBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={P.primaryText} />
        </Pressable>
        <Text style={styles.title}>CALENDAR</Text>
        <View style={styles.headerRight}>
          <Pressable style={styles.headerPill} onPress={() => {}}>
            <Text style={styles.headerPillEmoji}>☁️</Text>
          </Pressable>
          <Pressable style={styles.headerPill} onPress={() => {}}>
            <Text style={styles.headerPillEmoji}>👔</Text>
          </Pressable>
          <Pressable style={styles.headerPillSmall} onPress={openAddModal}>
            <Ionicons name="add" size={18} color={P.primaryText} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={P.accent} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ── Calendar card ─────────────────────────────────────────── */}
          <View style={styles.calendarCard}>
            <Calendar
              current={`${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`}
              onDayPress={handleDateSelect}
              onMonthChange={handleMonthChange}
              markedDates={{
                ...markedDates,
                [selectedDate]: {
                  ...markedDates[selectedDate],
                  selected: true,
                  selectedColor: P.accent,
                },
              }}
              theme={{
                backgroundColor: 'transparent',
                calendarBackground: 'transparent',
                textSectionTitleColor: P.secondaryText,
                selectedDayBackgroundColor: P.accent,
                selectedDayTextColor: '#FFFFFF',
                todayTextColor: '#FFFFFF',
                todayBackgroundColor: P.primaryText,
                dayTextColor: P.primaryText,
                textDisabledColor: P.lightText,
                dotColor: P.accent,
                selectedDotColor: '#FFFFFF',
                arrowColor: P.accent,
                disabledArrowColor: P.lightText,
                monthTextColor: P.primaryText,
                indicatorColor: P.accent,
                textDayFontWeight: '500',
                textMonthFontWeight: '700',
                textDayHeaderFontWeight: '600',
                textDayFontSize: 15,
                textMonthFontSize: 17,
                textDayHeaderFontSize: 13,
              }}
              style={styles.calendar}
            />
          </View>

          {/* ── Device Calendar Connect Banner ─────────────────────── */}
          {!calendarConnected && (
            <TouchableOpacity
              style={calStyles.connectBanner}
              onPress={handleConnectCalendar}
              activeOpacity={0.85}
            >
              <View style={calStyles.connectBannerLeft}>
                <Text style={calStyles.connectBannerIcon}>📅</Text>
                <View>
                  <Text style={calStyles.connectBannerTitle}>Connect Your Calendar</Text>
                  <Text style={calStyles.connectBannerSub}>
                    Sync your schedule for smarter outfit suggestions
                  </Text>
                </View>
              </View>
              <Text style={calStyles.connectBannerArrow}>›</Text>
            </TouchableOpacity>
          )}

          {/* ── Device Calendar Events ──────────────────────────────── */}
          {calendarConnected && selectedDate && (
            <View style={calStyles.deviceEventsSection}>
              <Text style={calStyles.deviceEventsSectionTitle}>
                YOUR SCHEDULE
              </Text>
              {eventsLoading ? (
                <ActivityIndicator
                  size="small"
                  color="#C4A882"
                  style={{ marginVertical: 8 }}
                />
              ) : deviceEvents.length === 0 ? (
                <Text style={calStyles.deviceEventsEmpty}>
                  No events on your calendar for this day
                </Text>
              ) : (
                deviceEvents.map(event => (
                  <View key={event.id} style={calStyles.deviceEventCard}>
                    <View style={calStyles.deviceEventTimeBar} />
                    <View style={calStyles.deviceEventContent}>
                      <Text style={calStyles.deviceEventTitle} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <Text style={calStyles.deviceEventTime}>
                        {formatEventTime(event.startDate)}
                        {event.endDate
                          ? ` – ${formatEventTime(event.endDate)}`
                          : ''}
                      </Text>
                      {event.location ? (
                        <Text style={calStyles.deviceEventLocation} numberOfLines={1}>
                          📍 {event.location}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ── Day detail ────────────────────────────────────────────── */}
          <View style={styles.dayDetail}>
            <Text style={styles.dayTitle}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
            </Text>

            {patching === selectedDate && (
              <View style={styles.savingRow}>
                <ActivityIndicator size="small" color={P.accent} />
                <Text style={styles.savingText}>Saving…</Text>
              </View>
            )}

            {plans.length === 0 ? (
              <View style={styles.noPlans}>
                <Ionicons name="calendar-outline" size={36} color={P.lightText} style={{ marginBottom: 10 }} />
                <Text style={styles.noPlansText}>No plans for this day</Text>
                <Pressable style={styles.addPlanBtn} onPress={openAddModal}>
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.addPlanBtnText}>Add plan</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {plans.map((plan, index) => (
                  <View key={`${selectedDate}-${plan.slotLabel}-${index}`} style={styles.planCard}>
                    <View style={styles.planRow}>
                      <Text style={styles.planSlot}>{plan.slotLabel}</Text>
                      <Text style={styles.planOccasion}>{plan.occasion}</Text>
                    </View>
                    {!!plan.outfitId && (
                      <View style={styles.statusRow}>
                        {STATUSES.map((s) => (
                          <Pressable
                            key={s}
                            style={[styles.statusChip, plan.status === s && styles.statusChipActive]}
                            onPress={() => updatePlanStatus(index, s)}
                          >
                            <Text style={[styles.statusChipText, plan.status === s && styles.statusChipTextActive]}>
                              {s}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
                <Pressable style={styles.addMoreBtn} onPress={openAddModal}>
                  <Ionicons name="add" size={16} color={P.accent} />
                  <Text style={styles.addMoreText}>Add plan</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      )}

      {/* ── Add plan modal ────────────────────────────────────────────── */}
      <Modal visible={addModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setAddModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Add plan</Text>

            <Text style={styles.formLabel}>Time slot</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={addSlotLabel}
                onValueChange={(v) => setAddSlotLabel(v as PlannerSlotLabel)}
                style={styles.picker}
                dropdownIconColor={P.primaryText}
              >
                {SLOT_LABELS.map((l) => <Picker.Item key={l} label={l} value={l} />)}
              </Picker>
            </View>

            <Text style={styles.formLabel}>Occasion (required)</Text>
            <TextInput
              style={[styles.input, addOccasionError ? styles.inputError : null]}
              value={addOccasion}
              onChangeText={(t) => { setAddOccasion(t); setAddOccasionError(null); }}
              placeholder="e.g. casual, work"
              placeholderTextColor={P.lightText}
            />
            {addOccasionError && <Text style={styles.errorText}>{addOccasionError}</Text>}

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.continueBtn, !addOccasion.trim() && styles.continueBtnDisabled]}
                onPress={handleContinueToSuggestions}
                disabled={!addOccasion.trim()}
              >
                <Text style={styles.continueBtnText}>Continue</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {!!toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.background },
  scroll:    { flex: 1 },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: P.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: P.cardSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: P.primaryText,
    letterSpacing: -0.3,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 6,
  },
  headerPill: {
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: P.cardWhite,
    borderWidth: 1,
    borderColor: P.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerPillEmoji: { fontSize: 15 },
  headerPillSmall: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: P.cardWhite,
    borderWidth: 1,
    borderColor: P.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Calendar card
  calendarCard: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    backgroundColor: P.cardWhite,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: P.border,
    padding: 12,
    shadowColor: P.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 3,
  },
  calendar: { borderRadius: 14 },

  // Day detail
  dayDetail:   { marginHorizontal: 20, marginBottom: 32 },
  dayTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: P.primaryText,
    marginBottom: 14,
    letterSpacing: 0.1,
  },
  savingRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  savingText: { fontSize: 13, color: P.secondaryText },

  // No plans
  noPlans: {
    alignItems: 'center',
    paddingVertical: 28,
    backgroundColor: P.cardSurface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: P.border,
  },
  noPlansText: { fontSize: 15, color: P.secondaryText, marginBottom: 16 },
  addPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: P.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
  },
  addPlanBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  // Plan cards
  planCard: {
    backgroundColor: P.cardSurface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: P.border,
    shadowColor: P.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
  },
  planRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  planSlot:    { fontSize: 12, fontWeight: '700', color: P.accent, textTransform: 'capitalize', marginRight: 10, letterSpacing: 0.3 },
  planOccasion:{ fontSize: 15, color: P.primaryText, flex: 1 },
  statusRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusChip:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: P.border },
  statusChipActive: { backgroundColor: P.accent },
  statusChipText:       { fontSize: 12, color: P.secondaryText },
  statusChipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  addMoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, paddingVertical: 6 },
  addMoreText:{ fontSize: 13, color: P.accent, fontWeight: '600' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(61, 52, 38, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: P.cardSurface,
    borderRadius: 22,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: P.border,
    shadowColor: P.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: P.primaryText, marginBottom: 18 },
  formLabel:  { fontSize: 12, color: P.secondaryText, marginBottom: 6, marginTop: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  pickerWrap: { borderWidth: 1, borderColor: P.border, borderRadius: 12, overflow: 'hidden', backgroundColor: P.background },
  picker:     { color: P.primaryText },
  input: {
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: P.primaryText,
    backgroundColor: P.background,
  },
  inputError: { borderColor: P.error },
  errorText:  { fontSize: 12, color: P.error, marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: P.border,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, color: P.primaryText, fontWeight: '600' },
  continueBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: P.accent,
    alignItems: 'center',
  },
  continueBtnDisabled: { opacity: 0.45 },
  continueBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 28,
    left: 20,
    right: 20,
    backgroundColor: P.primaryText,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  toastText: { fontSize: 13, color: '#FFFFFF', textAlign: 'center' },
});

const calStyles = StyleSheet.create({
  connectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(196,168,130,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(196,168,130,0.3)',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  connectBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  connectBannerIcon: {
    fontSize: 28,
  },
  connectBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C4A882',
  },
  connectBannerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  connectBannerArrow: {
    fontSize: 22,
    color: '#C4A882',
    fontWeight: '300',
  },
  deviceEventsSection: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
  },
  deviceEventsSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C4A882',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  deviceEventsEmpty: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  deviceEventCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  deviceEventTimeBar: {
    width: 3,
    backgroundColor: '#C4A882',
    borderRadius: 2,
  },
  deviceEventContent: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deviceEventTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deviceEventTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  deviceEventLocation: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
});
