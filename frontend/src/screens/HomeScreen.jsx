// src/screens/HomeScreen.jsx
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LandmarkManager from '../components/landmarks/LandmarkManager';
import MultiModalLocationTracker from '../components/location/MultiModalLocationTracker';
import OfflineMapView from '../components/map/OfflineMapView';
import MechanicFinder from '../components/mechanics/MechanicFinder';
import authService from '../screens/authService';

const HomeScreen = ({ navigation }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [landmarks, setLandmarks] = useState([]);
  const [mechanics, setMechanics] = useState([]);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            const result = await authService.logout();
            if (result.success) {
              navigation.replace('Login');
            } else {
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  const handleLocationUpdate = (location) => {
    setCurrentLocation(location);
  };

  const handleLandmarksUpdate = (landmarkList) => {
    setLandmarks(landmarkList);
  };

  const handleMechanicsUpdate = (mechanicList) => {
    setMechanics(mechanicList);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <MultiModalLocationTracker
          onLocationUpdate={handleLocationUpdate}
          onLandmarksUpdate={handleLandmarksUpdate}
          onMechanicsUpdate={handleMechanicsUpdate}
        />

        <OfflineMapView
          currentLocation={currentLocation}
          landmarks={landmarks}
          mechanics={mechanics}
        />

        <MechanicFinder
          currentLocation={currentLocation}
          onMechanicsUpdate={handleMechanicsUpdate}
        />

        <LandmarkManager
          currentLocation={currentLocation}
          onLandmarksUpdate={handleLandmarksUpdate}
        />
      </ScrollView>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
      >
        <Text style={styles.logoutButtonText}>🔒 Logout</Text>
      </TouchableOpacity>
    </View>
  );  fi
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  logoutButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;