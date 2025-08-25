import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, TextInput } from 'react-native';
import * as Location from 'expo-location';

const LocationTracker = () => {
  const [loading, setLoading] = useState(false);
  const [mechanics, setMechanics] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  // Generate a valid ObjectId (24 character hex string)
  const generateObjectId = () => {
    return Math.random().toString(16).substring(2, 10) +
           Math.random().toString(16).substring(2, 10) +
           Math.random().toString(16).substring(2, 10);
  };

  const userId = '507f1f77bcf86cd799439011'; // Valid ObjectId format

  const API_BASE_URL = 'http://192.168.1.7:3000/api'; // Change this IP!

  const trackLocation = async () => {
    setLoading(true);

    try {
      // Request permission
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to find nearby mechanics');
        setLoading(false);
        return;
      }

      // Check if location services are enabled
      let locationServicesEnabled = await Location.hasServicesEnabledAsync();
      if (!locationServicesEnabled) {
        Alert.alert('Location Services Disabled', 'Please enable location services in your device settings');
        setLoading(false);
        return;
      }

      let location;
      try {
        // Try high accuracy first
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeout: 15000, // 15 second timeout
        });
      } catch (highAccuracyError) {
        console.log('High accuracy failed, trying balanced accuracy:', highAccuracyError);
        try {
          // Fallback to balanced accuracy
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeout: 10000, // 10 second timeout
          });
        } catch (balancedError) {
          console.log('Balanced accuracy failed, trying low accuracy:', balancedError);
          // Final fallback to low accuracy
          location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
            timeout: 5000, // 5 second timeout
          });
        }
      }

      const { latitude, longitude } = location.coords;
      setCurrentLocation({ latitude, longitude });

      // Send to backend
      const response = await fetch(`${API_BASE_URL}/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude,
          longitude,
          userId
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMechanics(data.nearbyMechanics);
        Alert.alert('Success', `Found ${data.nearbyMechanics.length} nearby mechanics`);
      } else {
        throw new Error(data.error);
      }

    } catch (error) {
      console.error('Error tracking location:', error);

      let errorMessage = 'Failed to track location. ';

      if (error.code === 1) {
        errorMessage += 'Location permission denied.';
      } else if (error.code === 2) {
        errorMessage += 'Location unavailable. Try:\n• Moving to an open area\n• Checking GPS is enabled\n• Restarting location services';
      } else if (error.code === 3) {
        errorMessage += 'Location request timed out. Please try again.';
      } else {
        errorMessage += 'Please check your internet connection and try again.';
      }

      Alert.alert('Location Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const useManualLocation = async () => {
    if (!manualLat || !manualLng) {
      Alert.alert('Error', 'Please enter both latitude and longitude');
      return;
    }

    const latitude = parseFloat(manualLat);
    const longitude = parseFloat(manualLng);

    if (isNaN(latitude) || isNaN(longitude)) {
      Alert.alert('Error', 'Please enter valid numbers for latitude and longitude');
      return;
    }

    setLoading(true);
    setCurrentLocation({ latitude, longitude });

    try {
      // Send to backend
      const response = await fetch(`${API_BASE_URL}/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude,
          longitude,
          userId
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMechanics(data.nearbyMechanics);
        Alert.alert('Success', `Found ${data.nearbyMechanics.length} nearby mechanics`);
      } else {
        throw new Error(data.error);
      }

    } catch (error) {
      console.error('Error with manual location:', error);
      Alert.alert('Error', 'Failed to fetch mechanics. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 50 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' }}>
        On Road Mechanic Service
      </Text>

      <TouchableOpacity
        onPress={trackLocation}
        disabled={loading}
        style={{
          backgroundColor: loading ? '#ccc' : '#007AFF',
          padding: 15,
          borderRadius: 10,
          marginBottom: 20,
        }}
      >
        <Text style={{
          color: 'white',
          textAlign: 'center',
          fontSize: 16,
          fontWeight: 'bold'
        }}>
          {loading ? 'Tracking Location...' : 'Use Current Location'}
        </Text>
      </TouchableOpacity>

      {/* Manual Location Input for Testing */}
      <View style={{ marginBottom: 20, padding: 15, backgroundColor: '#f9f9f9', borderRadius: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
          Or Enter Location Manually (for testing):
        </Text>
        <TextInput
          placeholder="Latitude (e.g., 23.0225)"
          value={manualLat}
          onChangeText={setManualLat}
          keyboardType="numeric"
          style={{
            borderWidth: 1,
            borderColor: '#ddd',
            padding: 10,
            borderRadius: 5,
            marginBottom: 10,
            backgroundColor: 'white'
          }}
        />
        <TextInput
          placeholder="Longitude (e.g., 72.5714)"
          value={manualLng}
          onChangeText={setManualLng}
          keyboardType="numeric"
          style={{
            borderWidth: 1,
            borderColor: '#ddd',
            padding: 10,
            borderRadius: 5,
            marginBottom: 10,
            backgroundColor: 'white'
          }}
        />
        <TouchableOpacity
          onPress={useManualLocation}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#ccc' : '#28a745',
            padding: 12,
            borderRadius: 8,
          }}
        >
          <Text style={{
            color: 'white',
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 'bold'
          }}>
            Use Manual Location
          </Text>
        </TouchableOpacity>
      </View>

      {currentLocation && (
        <View style={{ marginBottom: 20, padding: 10, backgroundColor: '#f0f0f0', borderRadius: 5 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold' }}>Current Location:</Text>
          <Text>Lat: {currentLocation.latitude.toFixed(6)}</Text>
          <Text>Lng: {currentLocation.longitude.toFixed(6)}</Text>
        </View>
      )}

      {mechanics.length > 0 && (
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>
            Nearby Mechanics ({mechanics.length})
          </Text>

          <ScrollView>
            {mechanics.map((mechanic) => (
              <View key={mechanic.id} style={{
                backgroundColor: 'white',
                padding: 15,
                marginBottom: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#ddd'
              }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{mechanic.username}</Text>
                <Text style={{ color: '#666', marginVertical: 5 }}>{mechanic.address}</Text>
                <Text>Distance: {mechanic.distance}m</Text>
                <Text>Rating: {mechanic.avgRating}/5 ⭐</Text>
                <Text style={{ marginTop: 5 }}>Services: {mechanic.services.join(', ')}</Text>
                <Text style={{ color: '#007AFF', marginTop: 5 }}>{mechanic.phone}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export default LocationTracker;