// src/components/map/OfflineMapView.jsx
import { Ionicons } from '@expo/vector-icons';
import * as MapLibreGL from '@maplibre/maplibre-react-native';
import { StyleSheet, Text, View } from 'react-native';

MapLibreGL.setConnected(true);

const OfflineMapView = ({ currentLocation, landmarks = [], mechanics = [] }) => {
  const centerCoordinate = currentLocation?.latitude && currentLocation?.longitude
    ? [currentLocation.longitude, currentLocation.latitude]
    : null;

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        style={styles.map}
        mapStyle={require('../../../assets/maps/streets-v4-style.json')}
        compassEnabled={true}
        logoEnabled={false}
        scaleBarEnabled={true}
      >
        <MapLibreGL.Camera
          zoomLevel={14}
          centerCoordinate={centerCoordinate || [0, 0]}
          animationMode="flyTo"
          animationDuration={1000}
        />

        <MapLibreGL.UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
        />

        {/* User Location Marker */}
        {currentLocation?.latitude && currentLocation?.longitude && (
          <MapLibreGL.PointAnnotation
            id="user-location"
            coordinate={[currentLocation.longitude, currentLocation.latitude]}
          >
            <View style={styles.userMarker}>
              <View style={styles.userMarkerInner} />
            </View>
          </MapLibreGL.PointAnnotation>
        )}

        {/* Landmark Markers with Names */}
        {landmarks.map((landmark, index) => {
          const lng = landmark.longitude || landmark.location?.longitude;
          const lat = landmark.latitude || landmark.location?.latitude;
          const name = landmark.name || 'Landmark';

          if (!lng || !lat) return null;

          return (
            <MapLibreGL.PointAnnotation
              key={`landmark-${landmark.id || landmark._id || index}`}
              id={`landmark-${landmark.id || landmark._id || index}`}
              coordinate={[lng, lat]}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.landmarkContainer}>
                <View style={styles.landmarkDot} />
                <View style={styles.labelContainer}>
                  <Text style={styles.labelText} numberOfLines={1}>
                    {name}
                  </Text>
                </View>
              </View>
            </MapLibreGL.PointAnnotation>
          );
        })}

        {/* Mechanic Markers with Names */}
        {mechanics.map((mechanic, index) => {
          const lng = mechanic.longitude || mechanic.location?.longitude;
          const lat = mechanic.latitude || mechanic.location?.latitude;
          const name = mechanic.name || 'Mechanic';

          if (!lng || !lat) return null;

          return (
            <MapLibreGL.PointAnnotation
              key={`mechanic-${mechanic.id || mechanic._id || index}`}
              id={`mechanic-${mechanic.id || mechanic._id || index}`}
              coordinate={[lng, lat]}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.mechanicContainer}>
                <View style={styles.mechanicDot}>
                  <Ionicons name="construct" size={10} color="#fff" />
                </View>
                <View style={styles.mechanicLabelContainer}>
                  <Text style={styles.mechanicLabelText} numberOfLines={1}>
                    {name}
                  </Text>
                </View>
              </View>
            </MapLibreGL.PointAnnotation>
          );
        })}
      </MapLibreGL.MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 400,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
  userMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: '#fff',
  },
  landmarkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  landmarkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#001f3f',
    borderWidth: 1.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  labelContainer: {
    marginTop: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 31, 63, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    maxWidth: 120,
  },
  labelText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#001f3f',
    textAlign: 'center',
  },
  mechanicContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mechanicDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF6B35',
    borderWidth: 1.5,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  mechanicLabelContainer: {
    marginTop: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 107, 53, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    maxWidth: 120,
  },
  mechanicLabelText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FF6B35',
    textAlign: 'center',
  },
});

export default OfflineMapView;