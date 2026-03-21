/**
 * MyraNative — App.tsx
 * Milestone 2: foundation providers wired.
 * Screen content stays as FilamentSpikeScreen until navigation migration.
 */

import React from 'react';
import {StatusBar, StyleSheet} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {AuthProvider} from './src/context/AuthContext';
import {ThemeProvider} from './src/context/ThemeContext';
import {FilamentSpikeScreen} from './src/screens/FilamentSpikeScreen';

function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <SafeAreaView style={styles.root}>
            <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
            <FilamentSpikeScreen />
          </SafeAreaView>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
});

export default App;
