/**
 * Avatar tab — placeholder for v2.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AvatarScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Avatar coming in v2</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FEFCFB',
  },
  text: {
    fontSize: 18,
    color: '#8A857F',
  },
});
