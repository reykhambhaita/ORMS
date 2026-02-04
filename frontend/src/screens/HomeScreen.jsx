// src/screens/HomeScreen.jsx
import { Ionicons } from '@expo/vector-icons';
import { useLayoutEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LocationHeaderModal from '../components/location/LocationHeaderModal';
import OfflineMapView from '../components/map/OfflineMapView';
import { useTheme } from '../context/ThemeContext';

const HomeScreen = ({ navigation, route, currentLocation, landmarks, mechanics, trackerRef, user }) => {
  const { theme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  // Set up header with personalized greeting
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: () => (
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={styles.headerLocationButton}
        >
          <View style={styles.headerTitleWrapper}>
            <Text style={[styles.headerGreeting, { color: theme.text }]}>
              Hello, {user?.username || 'User'}
            </Text>
            <View style={styles.headerLocationContent}>
              <Ionicons name="location" size={12} color={theme.text} style={styles.locationIcon} />
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerAddressText, { color: theme.textSecondary }]} numberOfLines={1}>
                  {currentLocation?.address
                    ? currentLocation.address.split(',').slice(0, 2).join(',')
                    : 'Acquiring location...'}
                </Text>
                <Ionicons name="chevron-down" size={12} color={theme.textSecondary} style={styles.chevronIcon} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      ),
      headerRight: null,
      headerStyle: {
        backgroundColor: theme.card,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }
    });
  }, [navigation, currentLocation, theme, user]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.mapContainer}>
        <OfflineMapView
          currentLocation={currentLocation}
          landmarks={landmarks}
          mechanics={mechanics}
          navigation={navigation}
          isFullScreen={true}
        />
      </View>

      <LocationHeaderModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        currentLocation={currentLocation}
        networkStatus={trackerRef?.current?.networkStatus}
        locationSources={trackerRef?.current?.locationSources}
        showAddressFeedback={trackerRef?.current?.showAddressFeedback}
        onAddressCorrect={() => {
          trackerRef?.current?.handleAddressCorrect();
          setModalVisible(false);
        }}
        onAddressIncorrect={() => {
          trackerRef?.current?.handleAddressIncorrect();
          setModalVisible(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
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
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 1,
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
  },
  headerAddressText: {
    fontSize: 11,
    fontWeight: '400',
    marginRight: 2,
  },
  chevronIcon: {
    marginLeft: 4,
  }
});

export default HomeScreen;