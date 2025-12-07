// src/components/mechanics/MechanicFinder.jsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import authService from '../../screens/authService.js';
import dbManager from '../../utils/database';


const MechanicFinder = forwardRef(({ searchLocation, searchLocationName, onResetToGPS, onMechanicsUpdate, navigation }, ref) => {
  const [loading, setLoading] = useState(false);
  const [mechanics, setMechanics] = useState([]);
  const [selectedMechanic, setSelectedMechanic] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    if (searchLocation?.latitude && searchLocation?.longitude) {
      loadMechanics();
    }
  }, [searchLocation?.latitude, searchLocation?.longitude]);

  const loadMechanics = async () => {
    if (!searchLocation?.latitude || !searchLocation?.longitude) return;

    setLoading(true);

    try {
      console.log('Loading mechanics from location:', {
        lat: searchLocation.latitude,
        lng: searchLocation.longitude,
        name: searchLocationName || 'GPS'
      });

      const cached = await getCachedMechanics(
        searchLocation.latitude,
        searchLocation.longitude
      );

      console.log('Cached mechanics:', cached.length);

      if (cached.length > 0) {
        const mechanicsWithDistance = cached.map(mechanic => {
          const distance = calculateDistance(
            searchLocation.latitude,
            searchLocation.longitude,
            mechanic.latitude,
            mechanic.longitude
          );

          return {
            ...mechanic,
            distanceFromUser: distance
          };
        }).filter(m => m.distanceFromUser !== null);

        mechanicsWithDistance.sort((a, b) => a.distanceFromUser - b.distanceFromUser);

        setMechanics(mechanicsWithDistance);
        if (onMechanicsUpdate) {
          onMechanicsUpdate(mechanicsWithDistance);
        }
      }

      const result = await authService.getNearbyMechanics(
        searchLocation.latitude,
        searchLocation.longitude,
        50000
      );

      console.log('Backend result:', result);

      if (result.success && result.data) {
        console.log('Found mechanics:', result.data.length);

        await cacheMechanics(result.data);

        const mechanicsWithDistance = result.data.map(mechanic => {
          const lat = mechanic.location?.latitude || mechanic.latitude;
          const lng = mechanic.location?.longitude || mechanic.longitude;

          console.log(`Mechanic "${mechanic.name}": lat=${lat}, lng=${lng}`);

          const distance = calculateDistance(
            searchLocation.latitude,
            searchLocation.longitude,
            lat,
            lng
          );

          return {
            ...mechanic,
            latitude: lat,
            longitude: lng,
            distanceFromUser: distance
          };
        }).filter(m => m.distanceFromUser !== null);

        mechanicsWithDistance.sort((a, b) => a.distanceFromUser - b.distanceFromUser);

        console.log('Sorted mechanics by distance:', mechanicsWithDistance.map(m => ({
          name: m.name,
          distance: m.distanceFromUser?.toFixed(2) + 'km'
        })));

        setMechanics(mechanicsWithDistance);
        if (onMechanicsUpdate) {
          onMechanicsUpdate(mechanicsWithDistance);
        }
      } else {
        console.log('Failed to load mechanics:', result.error);
      }
    } catch (error) {
      console.error('Load mechanics error:', error);

      const cached = await getCachedMechanics(
        searchLocation.latitude,
        searchLocation.longitude
      );

      const mechanicsWithDistance = cached.map(mechanic => ({
        ...mechanic,
        distanceFromUser: calculateDistance(
          searchLocation.latitude,
          searchLocation.longitude,
          mechanic.latitude,
          mechanic.longitude
        )
      })).filter(m => m.distanceFromUser !== null);

      mechanicsWithDistance.sort((a, b) => a.distanceFromUser - b.distanceFromUser);

      setMechanics(mechanicsWithDistance);
      if (onMechanicsUpdate) {
        onMechanicsUpdate(mechanicsWithDistance);
      }
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    refreshMechanics: async () => {
      console.log('Refreshing mechanics list...');
      if (searchLocation?.latitude && searchLocation?.longitude) {
        try {
          const db = await dbManager.getDatabase();
          await db.runAsync('DELETE FROM mechanics;');
          console.log('Cleared mechanic cache');
        } catch (error) {
          console.error('Failed to clear mechanic cache:', error);
        }
        await loadMechanics();
      }
    }
  }));

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      console.warn('Invalid coordinates for distance calculation:', { lat1, lon1, lat2, lon2 });
      return null;
    }

    if (lat1 === lat2 && lon1 === lon2) {
      console.log('Same location - distance is 0km');
      return 0;
    }

    const R = 6371;
    const toRad = (degrees) => degrees * (Math.PI / 180);

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    console.log(`Distance: ${distance.toFixed(2)}km`);
    console.log(`  From: (${lat1.toFixed(6)}, ${lon1.toFixed(6)})`);
    console.log(`  To:   (${lat2.toFixed(6)}, ${lon2.toFixed(6)})`);

    return distance;
  };

  const getCachedMechanics = async (latitude, longitude) => {
    try {
      const db = await dbManager.getDatabase();
      const latDelta = 50 / 111.32;
      const lngDelta = 50 / (111.32 * Math.cos(latitude * Math.PI / 180));

      const result = await db.getAllAsync(
        `SELECT * FROM mechanics
         WHERE latitude BETWEEN ? AND ?
         AND longitude BETWEEN ? AND ?
         ORDER BY timestamp DESC;`,
        [
          latitude - latDelta,
          latitude + latDelta,
          longitude - lngDelta,
          longitude + lngDelta
        ]
      );

      return (result || []).map(m => ({
        ...m,
        specialties: JSON.parse(m.specialties || '[]'),
        available: m.available === 1
      }));
    } catch (error) {
      console.error('Get cached mechanics error:', error);
      return [];
    }
  };

  const cacheMechanics = async (mechanics) => {
    if (!mechanics || mechanics.length === 0) return;

    try {
      const db = await dbManager.getDatabase();
      const now = Date.now();
      for (const mechanic of mechanics) {
        const id = mechanic._id || mechanic.id;
        const lat = mechanic.location?.latitude || mechanic.latitude;
        const lng = mechanic.location?.longitude || mechanic.longitude;

        if (!id || !lat || !lng) continue;

        await db.runAsync(
          `INSERT OR REPLACE INTO mechanics
          (id, name, phone, latitude, longitude, specialties, rating, available, timestamp, synced)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1);`,
          [
            id,
            mechanic.name,
            mechanic.phone || '',
            lat,
            lng,
            JSON.stringify(mechanic.specialties || []),
            mechanic.rating || 0,
            mechanic.available ? 1 : 0,
            now
          ]
        );
      }
    } catch (error) {
      console.error('Cache mechanics error:', error);
    }
  };

  const handleCallMechanic = (mechanicId, mechanicName, phone) => {
    if (!phone) {
      Alert.alert('No Phone Number', 'This mechanic has no contact number.');
      return;
    }

    Alert.alert(
      'Call Mechanic',
      `Call ${mechanicName} at ${phone}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: async () => {
            try {
              const callStartTime = new Date();
              const result = await authService.createCallLog(
                mechanicId,
                phone,
                callStartTime
              );

              if (result.success) {
                console.log('Call log created:', result.data.id);
                await AsyncStorage.setItem('current_call_log_id', result.data.id);
                await AsyncStorage.setItem('current_call_mechanic_id', mechanicId);
                await AsyncStorage.setItem('current_call_start_time', callStartTime.toISOString());
              }

              Linking.openURL(`tel:${phone}`);
            } catch (error) {
              console.error('Call log error:', error);
              Linking.openURL(`tel:${phone}`);
            }
          }
        }
      ]
    );
  };

  const handleEndCallAndReview = async (mechanicId, mechanicName) => {
    try {
      const callLogId = await AsyncStorage.getItem('current_call_log_id');
      const storedMechanicId = await AsyncStorage.getItem('current_call_mechanic_id');

      if (!callLogId || storedMechanicId !== mechanicId) {
        navigation.navigate('ReviewMechanic', { mechanicId, mechanicName });
        return;
      }

      const callEndTime = new Date();
      const result = await authService.endCallLog(callLogId, callEndTime);

      await AsyncStorage.removeItem('current_call_log_id');
      await AsyncStorage.removeItem('current_call_mechanic_id');
      await AsyncStorage.removeItem('current_call_start_time');

      navigation.navigate('ReviewMechanic', {
        mechanicId,
        mechanicName,
        callDuration: result.data?.duration || 0
      });
    } catch (error) {
      console.error('End call error:', error);
      navigation.navigate('ReviewMechanic', { mechanicId, mechanicName });
    }
  };

  const hasLocation = searchLocation?.latitude && searchLocation?.longitude;

  const openDetailModal = (mechanic) => {
    setSelectedMechanic(mechanic);
    setDetailModalVisible(true);
  };

  const closeDetailModal = () => {
    setDetailModalVisible(false);
    setSelectedMechanic(null);
  };

  return (
    <>
      <View style={styles.mechanicsContainer}>
        <View style={styles.containerHeader}>
          <Text style={styles.containerTitle}>
            {mechanics.length > 0
              ? `${mechanics.length} Mechanic${mechanics.length > 1 ? 's' : ''} nearby`
              : 'Find Mechanics'}
          </Text>
          {searchLocationName && (
            <View style={styles.searchLocationBadge}>
              <Ionicons name="location" size={12} color="#0A4D4D" />
              <Text style={styles.searchLocationText}>{searchLocationName}</Text>
            </View>
          )}
        </View>

        {loading && <ActivityIndicator size="small" color="#0A4D4D" style={styles.loader} />}

        {mechanics.length > 0 ? (
          <ScrollView
            style={styles.mechanicsScrollView}
            showsVerticalScrollIndicator={false}
          >
            {mechanics.map((mechanic, index) => (
              <TouchableOpacity
                key={mechanic.id || mechanic._id || index}
                style={styles.mechanicCard}
                onPress={() => openDetailModal(mechanic)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.mechanicName}>{mechanic.name}</Text>
                    <View style={styles.starRating}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= Math.round(mechanic.rating || 0) ? 'star' : 'star-outline'}
                          size={14}
                          color="#000000ff"
                        />
                      ))}
                      <Text style={styles.ratingValue}>
                        {(mechanic.rating || 0).toFixed(1)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceText}>
                      {mechanic.distanceFromUser != null
                        ? mechanic.distanceFromUser < 1
                          ? `${(mechanic.distanceFromUser * 1000).toFixed(0)}m`
                          : `${mechanic.distanceFromUser.toFixed(1)}km`
                        : '0km'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="construct-outline" size={48} color="#C0C0C0" />
            <Text style={styles.emptyText}>
              {!hasLocation
                ? 'Waiting for location...'
                : 'No mechanics found nearby'}
            </Text>
          </View>
        )}
      </View>

      {selectedMechanic && (
        <Modal
          visible={detailModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={closeDetailModal}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={closeDetailModal}
            />
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />

              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{selectedMechanic.name}</Text>
                  <View style={styles.modalRating}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= Math.round(selectedMechanic.rating || 0) ? 'star' : 'star-outline'}
                        size={16}
                        color="#000000ff"
                      />
                    ))}
                    <Text style={styles.modalRatingText}>
                      {(selectedMechanic.rating || 0).toFixed(1)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={closeDetailModal}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalDistance}>
                <Ionicons name="location-outline" size={18} color="#6B7280" />
                <Text style={styles.modalDistanceText}>
                  {selectedMechanic.distanceFromUser != null
                    ? selectedMechanic.distanceFromUser < 1
                      ? `${(selectedMechanic.distanceFromUser * 1000).toFixed(0)} meters away`
                      : `${selectedMechanic.distanceFromUser.toFixed(1)} km away`
                    : '0.0 km away'}
                </Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.callButton]}
                  onPress={() => {
                    closeDetailModal();
                    handleCallMechanic(
                      selectedMechanic.id || selectedMechanic._id,
                      selectedMechanic.name,
                      selectedMechanic.phone
                    );
                  }}
                >
                  <Ionicons name="call" size={20} color="#FFFFFF" />
                  <Text style={styles.callButtonText}>Call Now</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.walletButton]}
                  onPress={() => {
                    closeDetailModal();
                    navigation.navigate('Payment', {
                      mechanicId: selectedMechanic.id || selectedMechanic._id,
                      mechanicName: selectedMechanic.name,
                      mechanicPhone: selectedMechanic.phone
                    });
                  }}
                >
                  <Ionicons name="wallet-outline" size={20} color="#0A4D4D" />
                  <Text style={styles.walletButtonText}>Payment</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.reviewButton]}
                  onPress={() => {
                    closeDetailModal();
                    handleEndCallAndReview(
                      selectedMechanic.id || selectedMechanic._id,
                      selectedMechanic.name
                    );
                  }}
                >
                  <Ionicons name="star-outline" size={20} color="#6B7280" />
                  <Text style={styles.reviewButtonText}>Leave a review</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
});

const styles = StyleSheet.create({
  mechanicsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,

  },
  containerHeader: {
    marginBottom: 16,
  },
  containerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  searchLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  searchLocationText: {
    fontSize: 12,
    color: '#0A4D4D',
    fontWeight: '500',
  },
  loader: {
    marginVertical: 20,
  },
  mechanicsScrollView: {
    maxHeight: 150,
  },
  mechanicCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLeft: {
    flex: 1,
    gap: 6,
  },
  mechanicName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  starRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 6,
  },
  distanceBadge: {
    backgroundColor: '#c7dde4ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0A4D4D',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  modalRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  modalRatingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 6,
  },
  closeButton: {
    padding: 4,
  },
  modalDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 24,
  },
  modalDistanceText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  modalActions: {
    gap: 6,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  callButton: {
    backgroundColor: '#001f3f',
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  walletButton: {
    backgroundColor: '#e0ebf2ff',
    borderWidth: 1,
    borderColor: '#84b1d6ff',
  },
  walletButtonText: {
    color: '#0A4D4D',
    fontSize: 16,
    fontWeight: '600',
  },
  reviewButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reviewButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
});

MechanicFinder.displayName = 'MechanicFinder';

export default MechanicFinder;