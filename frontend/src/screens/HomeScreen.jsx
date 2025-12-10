// src/screens/HomeScreen.jsx
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LandmarkManager from '../components/landmarks/LandmarkManager';
import LocationHeaderModal from '../components/location/LocationHeaderModal';
import MultiModalLocationTracker from '../components/location/MultiModalLocationTracker';
import OfflineMapView from '../components/map/OfflineMapView';
import MechanicFinder from '../components/mechanics/MechanicFinder';
import authService from './authService';

const HomeScreen = ({ navigation, route }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [landmarks, setLandmarks] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [searchLocation, setSearchLocation] = useState(null);
  const [searchLocationName, setSearchLocationName] = useState(null);
  const [user, setUser] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const mechanicFinderRef = useRef(null);
  const locationTrackerRef = useRef(null);

  // Load user data for avatar
  useEffect(() => {
    const loadUser = async () => {
      const userData = await authService.getUser();
      setUser(userData);
    };
    loadUser();
  }, []);

  // Set up header with location display
  useLayoutEffect(() => {
    const locationData = locationTrackerRef.current;

    navigation.setOptions({
      headerTitle: () => (
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={styles.headerLocationButton}
        >
          <View style={styles.headerTitleWrapper}>
            <Text style={styles.headerGreeting}>
              Hello, {user?.username || 'User'}
            </Text>
            <View style={styles.headerLocationContent}>
              <Ionicons name="location" size={12} color="#fff" style={styles.locationIcon} />
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerAddressText} numberOfLines={1}>
                  {locationData?.currentLocation?.address
                    ? locationData.currentLocation.address.split(',').slice(0, 2).join(',')
                    : 'Acquiring location...'}
                </Text>
                <Ionicons name="chevron-down" size={12} color="#fff" style={styles.chevronIcon} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={styles.headerButton}
        >
          {user?.avatar ? (
            <Image
              source={{ uri: user.avatar }}
              style={styles.headerAvatar}
            />
          ) : (
            <Ionicons name="person-circle-outline" size={28} color="#fff" />
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, user, locationTrackerRef.current?.currentLocation]);

  const handleLocationUpdate = (location) => {
    console.log('ðŸ“ HomeScreen: Location updated:', location);
    setCurrentLocation(location);
    // Auto-update search location to GPS if no landmark is selected
    if (!searchLocationName) {
      console.log('ðŸ“ HomeScreen: Setting search location to GPS location');
      setSearchLocation(location);
    }
  };

  const handleLandmarksUpdate = (landmarkList) => {
    setLandmarks(landmarkList);
  };

  const handleMechanicsUpdate = (mechanicList) => {
    setMechanics(mechanicList);
  };

  const handleLandmarkClick = (landmark) => {
    const landmarkLocation = {
      latitude: landmark.latitude,
      longitude: landmark.longitude,
    };
    console.log('ðŸ›ï¸ Landmark selected:', landmark.name);
    setSearchLocation(landmarkLocation);
    setSearchLocationName(landmark.name);
  };

  const handleResetToGPS = () => {
    console.log('ðŸ§­ Resetting to GPS location');
    setSearchLocation(currentLocation);
    setSearchLocationName(null);
  };

  // Handle refresh when returning from review screen
  useEffect(() => {
    if (route?.params?.refreshMechanics && mechanicFinderRef.current) {
      console.log('ðŸ”„ Refreshing mechanics after review submission');
      mechanicFinderRef.current.refreshMechanics();
      // Clear the parameter to avoid repeated refreshes
      navigation.setParams({ refreshMechanics: false });
    }
  }, [route?.params?.refreshMechanics]);

  // Refresh user data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      const userData = await authService.getUser();
      setUser(userData);
    });

    return unsubscribe;
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <MultiModalLocationTracker
          ref={locationTrackerRef}
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
          ref={mechanicFinderRef}
          searchLocation={searchLocation}
          searchLocationName={searchLocationName}
          onResetToGPS={handleResetToGPS}
          onMechanicsUpdate={handleMechanicsUpdate}
          navigation={navigation}
        />

        <LandmarkManager
          currentLocation={currentLocation}
          onLandmarksUpdate={handleLandmarksUpdate}
          onLandmarkClick={handleLandmarkClick}
        />
      </ScrollView>

      <LocationHeaderModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        currentLocation={locationTrackerRef.current?.currentLocation}
        networkStatus={locationTrackerRef.current?.networkStatus}
        locationSources={locationTrackerRef.current?.locationSources}
        showAddressFeedback={locationTrackerRef.current?.showAddressFeedback}
        onAddressCorrect={() => {
          locationTrackerRef.current?.handleAddressCorrect();
          setModalVisible(false);
        }}
        onAddressIncorrect={() => {
          locationTrackerRef.current?.handleAddressIncorrect();
          setModalVisible(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  headerButton: {
    marginRight: 6,
  },
  headerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  headerLocationButton: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  headerTitleWrapper: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    maxWidth: 280,
  },
  headerGreeting: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  headerLocationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    marginRight: 4,
  },
  headerTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAddressText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '400',
    marginRight: 2,
    opacity: 0.9,
  },
  chevronIcon: {
    marginLeft: 10,
  },
});

export default HomeScreen;