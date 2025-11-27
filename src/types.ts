export type GarmentCategory =
  | "top"
  | "bottom"
  | "dress"
  | "outerwear"
  | "shoes"
  | "accessory";

export type ColorName =
  | "black"
  | "white"
  | "gray"
  | "blue"
  | "green"
  | "red"
  | "yellow"
  | "beige"
  | "brown"
  | "pink"
  | "purple";

export interface Garment {
  id: string;           // maps from backend _id
  uri?: string;         // local file:// path (optional, for immediate preview)
  imageUrl?: string;    // backend URL (optional, but preferred for rendering)
  category: GarmentCategory;
  colors: ColorName[];
  brand?: string;
  notes?: string;
  isFavorite?: boolean; // favorite status from backend
  tags?: string[];      // tags from backend
}

export type OutfitContext = "date-night" | "casual" | "formal" | "work" | "party";

export interface OutfitTemplate {
  id: string;
  context: OutfitContext;
  recipe: GarmentCategory[]; // e.g., ["top","bottom","shoes","accessory"]
  preferredColors?: Partial<Record<GarmentCategory, ColorName[]>>;
}

export interface OutfitSuggestion {
  id: string;
  items: Garment[];
  score: number;
  context: OutfitContext;
}

/** Profile / Auth */
export type Pronouns = "she/her" | "he/him" | "they/them" | "prefer-not-to-say";
export type BodyType =
  | "skinny"
  | "fit"
  | "muscular"
  | "bulk"
  | "pear"
  | "hourglass"
  | "rectangle";

export interface UserProfile {
  preferredName?: string;
  pronouns?: Pronouns;
  heightCm?: number;
  weightLb?: number;
  bodyType?: BodyType;
  privacyConsent?: boolean;
}

export interface UserAuth {
  id?: string;
  email?: string;
  username?: string; // derived from email/name, for greeting
  phone?: string; // lowercase primitive
  image?: string;
  // optional fields referenced in UI:
  displayName?: string;
  profile?: {
    preferredName?: string;
  };
  token?: string;
}

/** Weather & Location */
export interface WeatherData {
  temperature: number;
  feelsLike: number;
  minTemp: number;
  maxTemp: number;
  condition: string;
  conditionIcon: string;
  humidity: number;
  windSpeed: number;
  description: string;
  outfitTip: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  timezone: string;
}

/** Calendar & Events */
export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO date string
  time?: string; // HH:MM format
  type: 'interview' | 'party' | 'date' | 'work' | 'casual' | 'formal' | 'other';
  outfitContext?: OutfitContext;
  notes?: string;
}

/** Notifications */
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'outfit' | 'weather' | 'event' | 'reminder' | 'system';
  read: boolean;
  createdAt: string; // ISO timestamp
  data?: Record<string, any>;
}

/** App Settings */
export interface AppSettings {
  temperatureUnit: 'celsius' | 'fahrenheit';
  notificationsEnabled: boolean;
  locationPermissionGranted: boolean;
  lastWeatherUpdate?: string;
  preferredLocation?: string;
}
