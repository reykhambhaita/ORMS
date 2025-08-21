import React from 'react';
import { StyleSheet, View } from 'react-native';
import LocationTracker from './src/components/location/LocationTracker';

export default function App() {
  return (
    <View style={styles.container}>
      <LocationTracker />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});