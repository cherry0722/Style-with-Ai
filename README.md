# MYRA - Your Personal Style Assistant

A premium React Native app that helps users manage their wardrobe, plan outfits, and get weather-based clothing recommendations.

## Features

### 🏠 Home Dashboard
- **Weather Integration**: Real-time weather data with location detection
- **Temperature Units**: Toggle between Celsius and Fahrenheit
- **Outfit Tips**: Weather-based clothing recommendations
- **Calendar Widget**: Quick view of today's events
- **Quick Actions**: Fast access to key features

### 📅 Calendar & Events
- **Event Management**: Add, edit, and delete calendar events
- **Event Types**: Interview, party, date, work, casual, formal, other
- **Outfit Context**: Events can suggest appropriate outfit styles
- **Visual Calendar**: Interactive calendar with event indicators

### 🔔 Notifications
- **Smart Notifications**: Outfit suggestions, weather alerts, event reminders
- **Badge Counts**: Unread notification indicators
- **Mark as Read**: Individual and bulk read status management
- **Notification Types**: Outfit, weather, event, reminder, system

### 👕 Wardrobe Management
- **Clothing Scanner**: Add items by taking photos
- **Categorization**: Top, bottom, dress, outerwear, shoes, accessory
- **Color Detection**: Manual color tagging system
- **Outfit Suggestions**: AI-powered outfit recommendations

### 🎨 Premium UX
- **Modern Design**: Clean, minimalist interface with premium feel
- **Smooth Animations**: 60fps interactions with React Native Reanimated
- **Haptic Feedback**: Tactile responses for key interactions
- **Accessibility**: VoiceOver/TalkBack support, dynamic type, high contrast
- **Splash Animation**: Polished Myra logo animation on app launch

## Tech Stack

- **React Native**: Cross-platform mobile development
- **Expo**: Development platform and toolchain
- **TypeScript**: Type-safe development
- **React Navigation**: Navigation library
- **Zustand**: Lightweight state management
- **Expo Location**: GPS and location services
- **Expo Notifications**: Push and local notifications
- **React Native Calendars**: Calendar component library

## Getting Started

### Prerequisites

- Node.js 18+ 
- Expo CLI
- iOS Simulator or Android Emulator (or physical device)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-wardrobe
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   EXPO_PUBLIC_WEATHER_API_KEY=your_openweathermap_api_key
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Run on device/simulator**
   ```bash
   # iOS
   npm run ios
   
   # Android
   npm run android
   
   # Web
   npm run web
   ```

## Project Structure

```
src/
├── components/          # Reusable UI components
├── context/            # React context providers
├── navigation/         # Navigation configuration
├── screens/           # Screen components
├── services/          # API services and external integrations
├── store/             # Zustand state stores
├── theme/             # Design system and styling
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

## Architecture

### State Management
- **Zustand**: Lightweight, unopinionated state management
- **Persistent Storage**: Settings and user data persist across sessions
- **Modular Stores**: Separate stores for different features (closet, calendar, notifications, settings)

### Navigation
- **Stack Navigator**: Root navigation with auth flow
- **Bottom Tabs**: Main app navigation with Home as default
- **Type Safety**: Full TypeScript support for navigation

### Services
- **Weather Service**: OpenWeatherMap API integration with caching
- **Location Service**: GPS and geocoding with permission handling
- **Notification Service**: Local notifications for reminders and alerts

## Configuration

### Weather API
1. Sign up for a free API key at [OpenWeatherMap](https://openweathermap.org/api)
2. Add your API key to the `.env` file as `EXPO_PUBLIC_WEATHER_API_KEY`

### Permissions
The app requests the following permissions:
- **Location**: For weather data and location-based features
- **Camera**: For scanning clothing items
- **Notifications**: For outfit reminders and weather alerts

## Development

### Code Style
- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting (if configured)

### Testing
```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch
```

### Building for Production

#### iOS
```bash
expo build:ios
```

#### Android
```bash
expo build:android
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@myra-app.com or join our Discord community.

---

Built with ❤️ by the Myra team
