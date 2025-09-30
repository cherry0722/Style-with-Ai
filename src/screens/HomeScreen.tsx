import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../store/settings';
import { useCalendar } from '../store/calendar';
import { useNotifications } from '../store/notifications';
import { getWeatherData, convertTemperature, getWeatherIconUrl } from '../services/weather';
import { WeatherData, LocationData } from '../types';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../utils/haptics';
import { dailyGreetings } from '../data/aestheticContent';
import StyleInspirationVideo from '../components/StyleInspirationVideo';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const settings = useSettings();
  const theme = useTheme();
  const { getEventsForDate } = useCalendar();
  const { unreadCount } = useNotifications();
  
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const firstName = user?.profile?.preferredName || user?.displayName || 'there';
  const today = new Date().toISOString().split('T')[0];
  const todayEvents = getEventsForDate(today);

  // Get daily greeting
  const getDailyGreeting = () => {
    const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const greetingIndex = dayOfYear % dailyGreetings.length;
    return dailyGreetings[greetingIndex].replace('{name}', firstName);
  };

  const loadWeatherData = useCallback(async (forceRefresh = false) => {
    try {
      const { weather: weatherData, location: locationData } = await getWeatherData(settings, forceRefresh);
      setWeather(weatherData);
      setLocation(locationData);
    } catch (error) {
      console.error('Error loading weather data:', error);
      Alert.alert('Error', 'Failed to load weather data. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [settings]);

  // Convert weather data when temperature unit changes
  const convertedWeather = React.useMemo(() => {
    if (!weather) return null;
    
    // If we have cached weather data, we need to convert it to the current unit
    // This handles the case where the user changes temperature unit without refreshing
    return {
      ...weather,
      temperature: convertTemperature(weather.temperature, 'celsius', settings.temperatureUnit),
      feelsLike: convertTemperature(weather.feelsLike, 'celsius', settings.temperatureUnit),
      minTemp: convertTemperature(weather.minTemp, 'celsius', settings.temperatureUnit),
      maxTemp: convertTemperature(weather.maxTemp, 'celsius', settings.temperatureUnit),
    };
  }, [weather, settings.temperatureUnit]);

  useEffect(() => {
    loadWeatherData();
  }, [loadWeatherData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadWeatherData(true);
  }, [loadWeatherData]);

  const handleQuickAction = (action: string) => {
    hapticFeedback.light();
    switch (action) {
      case 'plan-outfit':
        navigation.navigate('Ideas' as never);
        break;
      case 'scan-wardrobe':
        navigation.navigate('Scan' as never);
        break;
      case 'today-fit':
        navigation.navigate('Ideas' as never);
        break;
      case 'calendar':
        // Calendar navigation removed - no longer in bottom tabs
        break;
    }
  };

  const formatTemperature = (temp: number) => {
    const unit = settings.temperatureUnit === 'celsius' ? '°C' : '°F';
    return `${temp}${unit}`;
  };

  const getWeatherEmoji = (condition: string) => {
    const emojiMap: { [key: string]: string } = {
      'Clear': '☀️',
      'Clouds': '☁️',
      'Rain': '🌧️',
      'Thunderstorm': '⛈️',
      'Snow': '❄️',
      'Mist': '🌫️',
      'Fog': '🌫️',
      'Haze': '🌫️',
      'Dust': '🌫️',
      'Sand': '🌫️',
      'Ash': '🌫️',
      'Squall': '💨',
      'Tornado': '🌪️',
    };
    return emojiMap[condition] || '🌤️';
  };

  const styles = createStyles(theme);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>{getDailyGreeting()}</Text>
          <Text style={styles.subtitle}>
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
        </View>
                <View style={styles.headerActions}>
                  <Pressable
                    style={styles.calendarButton}
                    onPress={() => {
                      hapticFeedback.light();
                      navigation.navigate('Calendar' as never);
                    }}
                    accessibilityLabel="Open Calendar"
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={24}
                      color={theme.colors.textPrimary}
                    />
                  </Pressable>
                  <Pressable
                    style={styles.darkModeToggle}
                    onPress={() => {
                      hapticFeedback.light();
                      settings.toggleDarkMode();
                    }}
                    accessibilityLabel="Toggle Dark Mode"
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name={settings.darkMode ? "sunny-outline" : "moon-outline"}
                      size={24}
                      color={theme.colors.textPrimary}
                    />
                  </Pressable>
          {unreadCount > 0 && (
            <Pressable
              style={styles.notificationBadge}
              onPress={() => navigation.navigate('Notifications' as never)}
            >
              <Ionicons name="notifications" size={24} color={theme.colors.white} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </Pressable>
          )}
        </View>
      </View>

      {/* Weather Card */}
      <View style={styles.weatherCard}>
        <View style={styles.weatherHeader}>
          <View>
            <Text style={styles.weatherLocation}>
              {location?.city || 'Current Location'}
            </Text>
            <Text style={styles.weatherCondition}>
              {convertedWeather ? `${getWeatherEmoji(convertedWeather.condition)} ${convertedWeather.description}` : 'Loading...'}
            </Text>
          </View>
          <Pressable
            style={styles.tempToggle}
            onPress={() => {
              hapticFeedback.selection();
              settings.toggleTemperatureUnit();
            }}
            accessibilityLabel={`Switch to ${settings.temperatureUnit === 'celsius' ? 'Fahrenheit' : 'Celsius'}`}
            accessibilityRole="button"
            accessibilityHint="Toggles between Celsius and Fahrenheit temperature units"
          >
            <Text style={styles.tempToggleText}>
              {settings.temperatureUnit === 'celsius' ? '°C' : '°F'}
            </Text>
          </Pressable>
        </View>

        {convertedWeather && (
          <View style={styles.weatherContent}>
            <View style={styles.weatherMain}>
              <Image
                source={{ uri: getWeatherIconUrl(convertedWeather.conditionIcon) }}
                style={styles.weatherIcon}
              />
              <View>
                <Text style={styles.temperature}>
                  {formatTemperature(convertedWeather.temperature)}
                </Text>
                <Text style={styles.feelsLike}>
                  Feels like {formatTemperature(convertedWeather.feelsLike)}
                </Text>
              </View>
            </View>
            
            <View style={styles.weatherDetails}>
              <View style={styles.weatherDetail}>
                <Text style={styles.weatherDetailLabel}>Min</Text>
                <Text style={styles.weatherDetailValue}>
                  {formatTemperature(convertedWeather.minTemp)}
                </Text>
              </View>
              <View style={styles.weatherDetail}>
                <Text style={styles.weatherDetailLabel}>Max</Text>
                <Text style={styles.weatherDetailValue}>
                  {formatTemperature(convertedWeather.maxTemp)}
                </Text>
              </View>
              <View style={styles.weatherDetail}>
                <Text style={styles.weatherDetailLabel}>Humidity</Text>
                <Text style={styles.weatherDetailValue}>{convertedWeather.humidity}%</Text>
              </View>
            </View>

            <View style={styles.outfitTip}>
              <Ionicons name="shirt" size={16} color={theme.colors.accent} />
              <Text style={styles.outfitTipText}>{convertedWeather.outfitTip}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Calendar Widget */}
      <View style={styles.calendarWidget}>
        <View style={styles.calendarHeader}>
          <Text style={styles.calendarTitle}>Today's Outfit Options for {firstName}</Text>
          <Pressable onPress={() => handleQuickAction('calendar')}>
            <Text style={styles.calendarViewAll}>View All</Text>
          </Pressable>
        </View>
        
        {todayEvents.length > 0 ? (
          <View style={styles.eventsList}>
            {todayEvents.slice(0, 3).map((event) => (
              <View key={event.id} style={styles.eventItem}>
                <View style={styles.eventTime}>
                  <Text style={styles.eventTimeText}>
                    {event.time || 'All day'}
                  </Text>
                </View>
                <View style={styles.eventContent}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventType}>{event.type}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.noEvents}>
            <Text style={styles.noEventsText}>Upload outfits and let MYRA design it for you</Text>
          </View>
        )}
      </View>

      {/* MYRA's Collection */}
      <View style={styles.collectionSection}>
        <View style={styles.stickyHeader}>
          <Text style={styles.myraTitle}>MYRA</Text>
        </View>
        
        {/* Video with Description */}
        <View style={styles.collectionItem}>
          <StyleInspirationVideo 
            videoSource={require('../assets/video/1.mp4')}
          />
          <Text style={styles.styleDescription}>New York Edition</Text>
        </View>

        {/* Fashion Image with Description */}
        <View style={styles.imageCollectionItem}>
          <Image
            source={{ uri: 'https://images.pexels.com/photos/10679231/pexels-photo-10679231.jpeg' }}
            style={styles.fashionImage}
            resizeMode="cover"
          />
          <Text style={styles.styleDescription}>Parisian Chic</Text>
        </View>

        {/* Additional Content for More Scrolling */}
        <View style={styles.additionalContent}>
          <Text style={styles.styleDescription}>Discover More Styles</Text>
          <View style={styles.extraSpacing} />
          <Text style={styles.discoverText}>
            Explore MYRA's curated collection of fashion inspiration
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: any) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing['2xl'],
    paddingBottom: theme.spacing.lg,
    minHeight: 120,
  },
  headerContent: {
    flex: 1,
    paddingTop: theme.spacing.sm,
  },
  headerActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
          calendarButton: {
            padding: theme.spacing.sm,
            borderRadius: theme.borderRadius.md,
            backgroundColor: theme.colors.backgroundSecondary,
            marginRight: theme.spacing.sm,
          },
          darkModeToggle: {
            padding: theme.spacing.sm,
            borderRadius: theme.borderRadius.md,
            backgroundColor: theme.colors.backgroundSecondary,
          },
  greeting: {
    fontSize: theme.typography['2xl'],
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: theme.typography.base,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  notificationBadge: {
    position: 'relative' as const,
    padding: theme.spacing.sm,
  },
  badge: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    backgroundColor: theme.colors.error,
    borderRadius: theme.borderRadius.full,
    minWidth: 18,
    height: 18,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  badgeText: {
    color: theme.colors.white,
    fontSize: theme.typography.xs,
    fontWeight: theme.typography.bold,
  },
  weatherCard: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  weatherHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: theme.spacing.lg,
  },
  weatherLocation: {
    fontSize: theme.typography.lg,
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
  },
  weatherCondition: {
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textTransform: 'capitalize' as const,
  },
  tempToggle: {
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  tempToggleText: {
    fontSize: theme.typography.sm,
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
  },
  weatherContent: {
    gap: theme.spacing.lg,
  },
  weatherMain: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.lg,
  },
  weatherIcon: {
    width: 64,
    height: 64,
  },
  temperature: {
    fontSize: theme.typography['4xl'],
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
  },
  feelsLike: {
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  weatherDetails: {
    flexDirection: 'row' as const,
    justifyContent: 'space-around' as const,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  weatherDetail: {
    alignItems: 'center' as const,
  },
  weatherDetailLabel: {
    fontSize: theme.typography.xs,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  weatherDetailValue: {
    fontSize: theme.typography.base,
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
  },
  outfitTip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: theme.colors.accent + '10',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  outfitTipText: {
    fontSize: theme.typography.sm,
    color: theme.colors.accent,
    fontWeight: theme.typography.medium,
    flex: 1,
  },
  calendarWidget: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  calendarHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: theme.spacing.lg,
  },
  calendarTitle: {
    fontSize: theme.typography.lg,
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
  },
  calendarViewAll: {
    fontSize: theme.typography.sm,
    color: theme.colors.accent,
    fontWeight: theme.typography.medium,
  },
  eventsList: {
    gap: theme.spacing.md,
  },
  eventItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  eventTime: {
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    minWidth: 60,
    alignItems: 'center' as const,
  },
  eventTimeText: {
    fontSize: theme.typography.xs,
    fontWeight: theme.typography.bold,
    color: theme.colors.textSecondary,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: theme.typography.base,
    fontWeight: theme.typography.medium,
    color: theme.colors.textPrimary,
  },
  eventType: {
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textTransform: 'capitalize' as const,
  },
  noEvents: {
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.xl,
  },
  noEventsText: {
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
  },
  collectionSection: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  stickyHeader: {
    position: 'sticky' as const,
    top: 0,
    backgroundColor: theme.colors.background,
    zIndex: 10,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  myraTitle: {
    fontSize: theme.typography['5xl'],
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
    fontFamily: 'Didot',
    letterSpacing: 3,
    textAlign: 'center' as const,
  },
  collectionSubtitle: {
    fontSize: theme.typography.lg,
    fontWeight: theme.typography.medium,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center' as const,
  },
  collectionItem: {
    marginBottom: theme.spacing['2xl'],
  },
  imageCollectionItem: {
    marginTop: 80, // 5 inches of space (80px ≈ 5 inches on mobile)
    marginBottom: theme.spacing['2xl'],
  },
  styleDescription: {
    fontSize: theme.typography.base,
    fontWeight: theme.typography.medium,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    textAlign: 'center' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  fashionImage: {
    width: '40%',
    height: '40%',
    borderRadius: theme.borderRadius.xl,
    ...theme.shadows.md,
    alignSelf: 'center',
  },
  additionalContent: {
    marginTop: theme.spacing['3xl'],
    marginBottom: theme.spacing['4xl'],
    alignItems: 'center' as const,
  },
  extraSpacing: {
    height: 200, // Extra space for more scrolling
  },
  discoverText: {
    fontSize: theme.typography.base,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
    marginTop: theme.spacing.lg,
  },
});
