import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const LocationHeaderModal = ({
  visible,
  onClose,
  currentLocation,
  networkStatus,
  locationSources,
  showAddressFeedback,
  onAddressCorrect,
  onAddressIncorrect,
}) => {
  // Calculate active sources
  const getActiveSources = () => {
    if (!locationSources) return [];
    const now = Date.now();
    const SOURCE_TIMEOUT_MS = 10000;

    return Object.entries(locationSources)
      .filter(([_, source]) =>
        source?.timestamp > now - SOURCE_TIMEOUT_MS &&
        source.latitude !== null &&
        source.longitude !== null
      )
      .map(([name, source]) => ({
        name,
        accuracy: source.accuracy,
      }));
  };

  const activeSources = getActiveSources();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.modalContent}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>

          {/* Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 Current Location</Text>
            <Text style={styles.addressText}>
              {currentLocation?.address || 'Acquiring location...'}
            </Text>
          </View>

          {/* Address Feedback Buttons */}
          {showAddressFeedback &&
            currentLocation?.address &&
            currentLocation.address !== 'Address unavailable' && (
              <View style={styles.feedbackContainer}>
                <TouchableOpacity
                  style={styles.feedbackButton}
                  onPress={onAddressCorrect}
                >
                  <Text style={styles.feedbackButtonText}>✓ Correct</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.feedbackButton, styles.feedbackButtonIncorrect]}
                  onPress={onAddressIncorrect}
                >
                  <Text style={styles.feedbackButtonText}>✗ Not quite right</Text>
                </TouchableOpacity>
              </View>
            )}

          {/* Coordinates */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Coordinates</Text>
            <Text style={styles.coordsText}>
              Lat: {currentLocation?.latitude?.toFixed(6) || 'N/A'}
              {'\n'}
              Lng: {currentLocation?.longitude?.toFixed(6) || 'N/A'}
            </Text>
          </View>

          {/* Network Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Network Status</Text>
            <View style={styles.statusRow}>
              <View style={[
                styles.statusIndicator,
                networkStatus?.isConnected ? styles.statusOnline : styles.statusOffline
              ]} />
              <Text style={styles.statusText}>
                {networkStatus?.isConnected ? 'Online' : 'Offline'}
                {networkStatus?.type && networkStatus.type !== 'none'
                  ? ` (${networkStatus.type})`
                  : ''}
              </Text>
            </View>
          </View>

          {/* Accuracy & Resources */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Accuracy & Resources</Text>
            <Text style={styles.accuracyText}>
              Accuracy: {currentLocation?.accuracy
                ? `±${currentLocation.accuracy.toFixed(1)}m`
                : 'N/A'}
            </Text>
            {activeSources.length > 0 && (
              <View style={styles.sourcesContainer}>
                <Text style={styles.sourcesLabel}>Active Sources:</Text>
                {activeSources.map((source, index) => (
                  <View key={index} style={styles.sourceItem}>
                    <Text style={styles.sourceText}>
                      • {source.name.toUpperCase()}: ±{source.accuracy?.toFixed(1) || 'N/A'}m
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 10,
    padding: 5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    lineHeight: 22,
  },
  feedbackContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  feedbackButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#001f3f',
    alignItems: 'center',
  },
  feedbackButtonIncorrect: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  feedbackButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#001f3f',
  },
  coordsText: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#333',
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusOnline: {
    backgroundColor: '#4CAF50',
  },
  statusOffline: {
    backgroundColor: '#F44336',
  },
  statusText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  accuracyText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
  },
  sourcesContainer: {
    marginTop: 8,
  },
  sourcesLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
    fontWeight: '500',
  },
  sourceItem: {
    marginLeft: 8,
    marginBottom: 4,
  },
  sourceText: {
    fontSize: 12,
    color: '#555',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});

export default LocationHeaderModal;
