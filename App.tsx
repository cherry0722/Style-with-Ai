/**
 * MyraNative — App.tsx
 * Milestone 3A: minimal navigation shell wired.
 */

import React from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {enableScreens} from 'react-native-screens';
import {AuthProvider} from './src/context/AuthContext';
import {ThemeProvider} from './src/context/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';

// Explicitly register Ionicons TTF with the native font system.
// UIAppFonts handles this at launch for old architecture; loadFont() is the
// reliable path for New Architecture (Fabric) where UIAppFonts can race.
import Ionicons from 'react-native-vector-icons/Ionicons';
Ionicons.loadFont();

enableScreens();

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
