import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useCalendar } from '../store/calendar';
import { hapticFeedback } from '../utils/haptics';

export default function CalendarScreen() {
  const theme = useTheme();
  const { events } = useCalendar();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const markedDates = events.reduce((acc, event) => {
    acc[event.date] = {
      marked: true,
      dotColor: theme.colors.accent,
      selectedColor: theme.colors.accent,
    };
    return acc;
  }, {} as any);

  const selectedDateEvents = events.filter(event => event.date === selectedDate);

  const handleDateSelect = useCallback((day: DateData) => {
    setSelectedDate(day.dateString);
    hapticFeedback.light();
  }, []);

  const handleAddEvent = useCallback(() => {
    // TODO: Implement add event modal
    Alert.alert('Add Event', 'Event creation feature coming soon!');
    hapticFeedback.light();
  }, []);

  const handleDeleteEvent = useCallback((eventId: string) => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement removeEvent in calendar store
            hapticFeedback.light();
          },
        },
      ]
    );
  }, []);

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
        <Text style={styles.subtitle}>Plan your outfits for special occasions</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Calendar */}
        <View style={styles.calendarContainer}>
          <Calendar
            onDayPress={handleDateSelect}
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

        {/* Selected Date Events */}
        <View style={styles.eventsContainer}>
          <View style={styles.eventsHeader}>
            <Text style={styles.eventsTitle}>
              Events for {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
            <Pressable style={styles.addButton} onPress={handleAddEvent}>
              <Ionicons name="add" size={20} color={theme.colors.white} />
              <Text style={styles.addButtonText}>Add Event</Text>
            </Pressable>
          </View>

          {selectedDateEvents.length === 0 ? (
            <View style={styles.noEventsContainer}>
              <Ionicons name="calendar-outline" size={48} color={theme.colors.textTertiary} />
              <Text style={styles.noEventsText}>No events scheduled</Text>
              <Text style={styles.noEventsSubtext}>Tap "Add Event" to plan your outfit</Text>
            </View>
          ) : (
            <View style={styles.eventsList}>
              {selectedDateEvents.map((event) => (
                <View key={event.id} style={styles.eventCard}>
                  <View style={styles.eventContent}>
                    <View style={styles.eventIcon}>
                      <Ionicons 
                        name={event.type === 'interview' ? 'briefcase' : 'star'} 
                        size={20} 
                        color={theme.colors.accent} 
                      />
                    </View>
                    <View style={styles.eventDetails}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text style={styles.eventTime}>{event.time}</Text>
                      <Text style={styles.eventType}>{event.type}</Text>
                    </View>
                  </View>
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => handleDeleteEvent(event.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing['2xl'],
    paddingBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography['2xl'],
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.base,
    color: theme.colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  calendarContainer: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  calendar: {
    borderRadius: theme.borderRadius.lg,
  },
  eventsContainer: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  eventsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  eventsTitle: {
    fontSize: theme.typography.lg,
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  addButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontWeight: theme.typography.medium,
  },
  noEventsContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing['2xl'],
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.xl,
    ...theme.shadows.sm,
  },
  noEventsText: {
    fontSize: theme.typography.lg,
    fontWeight: theme.typography.medium,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  noEventsSubtext: {
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  eventsList: {
    gap: theme.spacing.md,
  },
  eventCard: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadows.sm,
  },
  eventContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: theme.typography.base,
    fontWeight: theme.typography.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  eventTime: {
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  eventType: {
    fontSize: theme.typography.xs,
    color: theme.colors.accent,
    fontWeight: theme.typography.medium,
    textTransform: 'capitalize',
  },
  deleteButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.error + '20',
  },
});