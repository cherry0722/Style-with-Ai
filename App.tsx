/**
 * MyraNative — App.tsx
 * Milestone 3A: minimal navigation shell wired.
 */
import React, { useEffect } from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {enableScreens} from 'react-native-screens';
import {AuthProvider} from './src/context/AuthContext';
import {ThemeProvider} from './src/context/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';
import { initActivityTracking } from './src/services/activityTracker';
import { useSettings } from './src/store/settings';

// Explicitly register Ionicons TTF with the native font system.
// UIAppFonts handles this at launch for old architecture; loadFont() is the
// reliable path for New Architecture (Fabric) where UIAppFonts can race.
import Ionicons from 'react-native-vector-icons/Ionicons';
Ionicons.loadFont();
enableScreens();

function App() {
  const hydrateSettings = useSettings((state) => state.hydrate);

  useEffect(() => {
    hydrateSettings();
    return initActivityTracking();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NavigationContainer>
            <StatusBar barStyle="dark-content" />
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
