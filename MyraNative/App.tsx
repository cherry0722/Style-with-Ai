/**
 * MyraNative — App.tsx
 * Milestone 1: mounts FilamentSpikeScreen only.
 * No MYRA business logic yet.
 */

import React from 'react';
import {StatusBar, StyleSheet} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {FilamentSpikeScreen} from './src/screens/FilamentSpikeScreen';

function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
        <FilamentSpikeScreen />
      </SafeAreaView>
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
