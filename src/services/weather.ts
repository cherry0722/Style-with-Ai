import * as Location from "expo-location";
import { WeatherData, LocationData, AppSettings } from "../types";

// 🆕 Add these imports:
import { sendWeatherAlert } from "./notification";
import { useNotifications } from "../store/notifications";

// OpenWeatherMap API configuration
const WEATHER_API_KEY = process.env.EXPO_PUBLIC_WEATHER_API_KEY || "demo_key";
const WEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather";

// Cache duration: 30 minutes
const CACHE_DURATION = 30 * 60 * 1000;

interface WeatherCache {
  data: WeatherData;
  location: LocationData;
  timestamp: number;
}

let weatherCache: WeatherCache | null = null;

/**
 * Get current location with proper permission handling
 */
export async function getCurrentLocation(): Promise<LocationData | null> {
  try {
    // Request permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      console.warn('Location permission denied');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    let cityName = "Current Location";
    let countryName = "Unknown";

    try {
      const geocode = (await Promise.race([
        Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Geocoding timeout")), 3000)
        ),
      ])) as any[];

      if (geocode && geocode.length > 0) {
        const address = geocode[0];
        cityName =
          address?.city ||
          address?.subregion ||
          address?.region ||
          "Current Location";
        countryName = address?.country || "Unknown";
      }
    } catch (geocodeError) {
      console.warn("Geocoding failed, using fallback:", geocodeError);
      cityName = getFallbackCityName(
        location.coords.latitude,
        location.coords.longitude
      );
    }

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      city: cityName,
      country: countryName,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  } catch (error) {
    console.error("Error getting location:", error);
    return null;
  }
}

function getFallbackCityName(lat: number, lon: number): string {
  const cities = [
    { name: "New York", lat: 40.7128, lon: -74.006 },
    { name: "London", lat: 51.5074, lon: -0.1278 },
    { name: "Tokyo", lat: 35.6762, lon: 139.6503 },
    { name: "Paris", lat: 48.8566, lon: 2.3522 },
    { name: "Sydney", lat: -33.8688, lon: 151.2093 },
    { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
    { name: "Chicago", lat: 41.8781, lon: -87.6298 },
    { name: "Mumbai", lat: 19.076, lon: 72.8777 },
    { name: "Dubai", lat: 25.2048, lon: 55.2708 },
    { name: "Singapore", lat: 1.3521, lon: 103.8198 },
  ];

  let closestCity = "Current Location";
  let minDistance = Infinity;

  for (const city of cities) {
    const distance = Math.sqrt(
      Math.pow(lat - city.lat, 2) + Math.pow(lon - city.lon, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      closestCity = city.name;
    }
  }

  return closestCity;
}

async function fetchWeatherData(
  location: LocationData,
  unit: "celsius" | "fahrenheit"
): Promise<WeatherData | null> {
  try {
    if (!WEATHER_API_KEY || WEATHER_API_KEY === "demo_key") {
      console.log("Using mock weather data - no API key provided");
      return getMockWeatherData(unit);
    }

    const units = unit === "celsius" ? "metric" : "imperial";
    const url = `${WEATHER_API_URL}?lat=${location.latitude}&lon=${location.longitude}&appid=${WEATHER_API_KEY}&units=${units}`;

    console.log("Fetching weather data from API...");
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`Weather API error: ${response.status}, using mock data`);
      return getMockWeatherData(unit);
    }

    const data = await response.json();
    console.log("Weather data fetched successfully:", data.weather[0].main);

    return {
      temperature: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      minTemp: Math.round(data.main.temp_min),
      maxTemp: Math.round(data.main.temp_max),
      condition: data.weather[0].main,
      conditionIcon: data.weather[0].icon,
      humidity: data.main.humidity,
      windSpeed: data.wind.speed,
      description: data.weather[0].description,
      outfitTip: generateOutfitTip(data.main.temp, data.weather[0].main, unit),
    };
  } catch (error) {
    console.error("Error fetching weather data:", error);
    return getMockWeatherData(unit);
  }
}

function getMockWeatherData(unit: "celsius" | "fahrenheit"): WeatherData {
  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth();

  const seasonalAdjustment =
    month >= 11 || month <= 2 ? -10 : month >= 6 && month <= 8 ? 10 : 0;
  const timeAdjustment =
    hour >= 22 || hour <= 6 ? -5 : hour >= 12 && hour <= 16 ? 5 : 0;

  const baseTemp = unit === "celsius" ? 22 : 72;
  const variation = Math.floor(Math.random() * 8) - 4;
  const temp = baseTemp + variation + seasonalAdjustment + timeAdjustment;
  const feelsLike = temp + (Math.floor(Math.random() * 3) - 1);
  const minTemp = temp - Math.floor(Math.random() * 6) - 3;
  const maxTemp = temp + Math.floor(Math.random() * 6) + 3;

  const weatherConditions = [
    { condition: "Clear", icon: "01d", description: "clear sky" },
    { condition: "Clouds", icon: "02d", description: "few clouds" },
    { condition: "Rain", icon: "10d", description: "rain" },
    { condition: "Thunderstorm", icon: "11d", description: "thunderstorm" },
    { condition: "Snow", icon: "13d", description: "snow" },
    { condition: "Mist", icon: "50d", description: "mist" },
  ];

  const selectedWeather =
    weatherConditions[Math.floor(Math.random() * weatherConditions.length)];

  const outfitTip = generateOutfitTip(temp, selectedWeather.condition, unit);

  return {
    temperature: temp,
    feelsLike,
    minTemp,
    maxTemp,
    condition: selectedWeather.condition,
    conditionIcon: selectedWeather.icon,
    humidity: 50 + Math.floor(Math.random() * 30),
    windSpeed: 1 + Math.random() * 5,
    description: selectedWeather.description,
    outfitTip,
  };
}

function generateOutfitTip(
  temperature: number,
  condition: string,
  unit: "celsius" | "fahrenheit"
): string {
  const temp = unit === "celsius" ? temperature : ((temperature - 32) * 5) / 9;

  if (condition.toLowerCase().includes("rain"))
    return "Carry an umbrella and wear waterproof shoes";
  if (temp < 5) return "Bundle up with a heavy coat and warm layers";
  if (temp < 15) return "Light jacket or sweater recommended";
  if (temp < 25) return "Perfect weather for light layers";
  if (temp < 30) return "Light, breathable fabrics work best";
  return "Stay cool with loose, light clothing";
}

/**
 * 🧠 Enhanced getWeatherData() with Notifications
 */
export async function getWeatherData(
  settings: AppSettings,
  forceRefresh = false
): Promise<{ weather: WeatherData | null; location: LocationData | null }> {
  if (
    !forceRefresh &&
    weatherCache &&
    Date.now() - weatherCache.timestamp < CACHE_DURATION
  ) {
    return {
      weather: weatherCache.data,
      location: weatherCache.location,
    };
  }

  const location = await getCurrentLocation();
  if (!location) return { weather: null, location: null };

  const weather = await fetchWeatherData(location, settings.temperatureUnit);
  if (!weather) return { weather: null, location };

  // 🧩 NEW: Send weather alert + store notification
  if (weather.condition) {
    await sendWeatherAlert(weather.condition);

    useNotifications.getState().addNotification({
      title: "🌦️ Weather Update",
      message: `Condition: ${weather.condition}, ${weather.outfitTip}`,
      type: "weather",
    });
  }

  weatherCache = {
    data: weather,
    location,
    timestamp: Date.now(),
  };

  return { weather, location };
}

/**
 * Convert temperature between units
 */
export function convertTemperature(
  temp: number,
  fromUnit: "celsius" | "fahrenheit",
  toUnit: "celsius" | "fahrenheit"
): number {
  if (fromUnit === toUnit) return temp;
  if (fromUnit === "celsius" && toUnit === "fahrenheit")
    return Math.round((temp * 9) / 5 + 32);
  return Math.round(((temp - 32) * 5) / 9);
}

export function getWeatherIconUrl(iconCode: string): string {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}
