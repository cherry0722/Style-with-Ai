/**
 * MainPlaceholder — temporary authenticated home screen.
 * REPLACE with real Tabs navigator once expo-image-picker is swapped out.
 */
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

export default function MainPlaceholder() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.title}>MYRA</Text>
        <Text style={styles.sub}>Tabs coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#F5F0E8'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  title: {fontSize: 32, fontWeight: '900', color: '#3D3426', letterSpacing: 4},
  sub: {fontSize: 14, color: '#8C7E6A', marginTop: 8},
});
