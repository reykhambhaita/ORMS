// src/components/map/OfflineMapView.jsx
import { Ionicons } from '@expo/vector-icons';
import * as MapLibreGL from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';

MapLibreGL.setConnected(true);

const OfflineMapView = ({ currentLocation, landmarks = [], mechanics = [] }) => {
  const centerCoordinate = currentLocation?.latitude && currentLocation?.longitude
    ? [currentLocation.longitude, currentLocation.latitude]
    : [70.77, 23.0225]; // Default to Rajkot

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
          centerCoordinate={centerCoordinate}
          animationMode="flyTo"
          animationDuration={1000}
        />

        <MapLibreGL.UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
        />

        {/* User Location Marker - Larger and more visible */}
        {currentLocation?.latitude && currentLocation?.longitude && (
          <MapLibreGL.PointAnnotation
            id="user-location"
            coordinate={[currentLocation.longitude, currentLocation.latitude]}
          >
            <View style={styles.userMarker}>
              <View style={styles.userMarkerInner} />
              <View style={styles.userMarkerPulse} />
            </View>
          </MapLibreGL.PointAnnotation>
        )}

        {/* Landmark Markers - More visible */}
        {landmarks.map((landmark, index) => {
          const lng = landmark.longitude || landmark.location?.longitude;
          const lat = landmark.latitude || landmark.location?.latitude;

          if (!lng || !lat) return null;

          return (
            <MapLibreGL.PointAnnotation
              key={`landmark-${landmark.id || landmark._id || index}`}
              id={`landmark-${landmark.id || landmark._id || index}`}
              coordinate={[lng, lat]}
              title={landmark.name || 'Landmark'}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.landmarkMarker}>
                <Ionicons name="location" size={18} color="#001f3f" />
              </View>
            </MapLibreGL.PointAnnotation>
          );
        })}

        {/* Mechanic Markers - More visible with wrench icon */}
        {mechanics.map((mechanic, index) => {
          const lng = mechanic.longitude || mechanic.location?.longitude;
          const lat = mechanic.latitude || mechanic.location?.latitude;

          if (!lng || !lat) return null;

          return (
            <MapLibreGL.PointAnnotation
              key={`mechanic-${mechanic.id || mechanic._id || index}`}
              id={`mechanic-${mechanic.id || mechanic._id || index}`}
              coordinate={[lng, lat]}
              title={mechanic.name || 'Mechanic'}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.mechanicMarker}>
                <Ionicons name="construct" size={18} color="#FF6B35" />
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
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 31, 63, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  userMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#001f3f',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 2,
  },
  userMarkerPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 31, 63, 0.3)',
    zIndex: 1,
  },
  landmarkMarker: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: '#001f3f',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  mechanicMarker: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: '#FF6B35',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default OfflineMapView;
