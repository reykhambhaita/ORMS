import NetInfo from "@react-native-community/netinfo";
import * as Location from "expo-location";
import { Accelerometer, Gyroscope, Magnetometer } from "expo-sensors";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import { BleManager } from "react-native-ble-plx";
import WifiManager from "react-native-wifi-reborn";
import authService from "../../screens/authService";
import dbManager from "../../utils/database";
class KalmanFilter {
  constructor(
    processNoise = 0.001,
    measurementNoise = 0.01,
    initialPosition = null
  ) {
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
    this.positionError = 100.0;
    this.velocityError = 10.0;
    this.position = initialPosition;
    this.velocity = 0;
    this.initialized = false;
  }

  update(measurement, dt = 1) {
    if (!this.initialized && measurement !== null && measurement !== 0) {
      this.position = measurement;
      this.initialized = true;
      this.positionError = this.measurementNoise;
      return this.position;
    }
    if (!this.initialized) return measurement;

    this.position += this.velocity * dt;
    this.positionError += this.velocityError * dt * dt + this.processNoise;
    const kalmanGain =
      this.positionError / (this.positionError + this.measurementNoise);
    this.position += kalmanGain * (measurement - this.position);
    this.positionError *= 1 - kalmanGain;
    return this.position;
  }

  setMeasurementNoise(noise) {
    this.measurementNoise = noise;
  }

  reset(position) {
    this.position = position;
    this.initialized = true;
    this.positionError = this.measurementNoise;
  }
}

// Physical constants
const STEP_THRESHOLD = 1.15; // m/sÃ‚Â² threshold for step detection
const STEP_DEBOUNCE_MS = 250; // Minimum time between steps
const AVERAGE_STEP_LENGTH_M = 0.762; // Average human step length (meters)
const METERS_TO_DEGREES_LAT = 1 / 111320; // Approximate meters to degrees latitude
const SOURCE_TIMEOUT_MS = 10000;
const SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// Kalman filter noise levels based on source accuracy
const NOISE_MAP = {
  gps: 0.01,
  wifi: 0.05,
  bluetooth: 0.07,
  deadReckoning: 0.1,
};

// WiFi and BLE trilateration constants
const WIFI_TX_POWER = -40; // Typical WiFi transmit power (dBm)
const BLE_TX_POWER = -59; // Typical BLE transmit power (dBm)
const PATH_LOSS_EXPONENT = 2.0; // Free space = 2.0, indoor = 2.5-4.0

const MultiModalLocationTracker = forwardRef(({ onLocationUpdate, onLandmarksUpdate, onMechanicUpdate }, ref) => {
  const [currentLocation, setCurrentLocation] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    address: null,
  });
  const [networkStatus, setNetworkStatus] = useState({
    isConnected: false,
    type: "none",
  });
  const [locationSources, setLocationSources] = useState({
    gps: null,
    wifi: null,
    bluetooth: null,
    deadReckoning: null,
  });
  const [isTracking, setIsTracking] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [user, setUser] = useState(null);
  const [initStatus, setInitStatus] = useState('Initializing...');
  const [showAddressFeedback, setShowAddressFeedback] = useState(false);
  const [addressFeedbackGiven, setAddressFeedbackGiven] = useState(false);

  const kalmanLat = useRef(new KalmanFilter(0.001, 0.01, null));
  const kalmanLng = useRef(new KalmanFilter(0.001, 0.01, null));
  const bleManager = useRef(null);
  const db = useRef(null);
  const syncTimer = useRef(null);
  const netInfoUnsubscribe = useRef(null);

  const sensorData = useRef({
    acceleration: { x: 0, y: 0, z: 0 },
    accelerationHistory: [], // For better step detection
    gyroscope: { x: 0, y: 0, z: 0 },
    magnetometer: { x: 0, y: 0, z: 0 },
    stepCount: 0,
    heading: 0,
    lastPosition: null, // Only set after real GPS fix
    lastStepTime: Date.now(),
    distanceTraveled: 0, // Track total distance
  });

  // Store WiFi and BLE beacon data with timestamps
  const wifiAccessPoints = useRef(new Map());
  const bluetoothBeacons = useRef(new Map());

  const subscriptions = useRef({
    location: null,
    accelerometer: null,
    gyroscope: null,
    magnetometer: null,
    fusion: null,
    deadReckoning: null,
    wifiScan: null,
  });

  // Cache for reverse geocoding to avoid excessive API calls
  const lastGeocodedLocation = useRef({ lat: null, lng: null, address: null });

  // ---------- Token Management ----------
  const getToken = async () => {
    try {
      return await authService.getToken();
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  };

  // ---------- Reverse Geocoding ----------
  const reverseGeocode = async (latitude, longitude) => {
    try {
      // First, check if we have a verified address for this location
      const verifiedAddress = await checkVerifiedAddress(latitude, longitude);
      if (verifiedAddress) {
        setShowAddressFeedback(false); // Don't show feedback for verified addresses
        return verifiedAddress;
      }

      // Only geocode if location has changed significantly (>50 meters)
      const lastLat = lastGeocodedLocation.current.lat;
      const lastLng = lastGeocodedLocation.current.lng;

      if (lastLat && lastLng) {
        const distance = getDistanceInMeters(lastLat, lastLng, latitude, longitude);
        if (distance < 50 && lastGeocodedLocation.current.address) {
          return lastGeocodedLocation.current.address;
        }
      }

      // Perform reverse geocoding
      const result = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (result && result.length > 0) {
        const location = result[0];
        // Build address string from available components
        const addressParts = [];

        if (location.name) addressParts.push(location.name);
        if (location.street) addressParts.push(location.street);
        if (location.city) addressParts.push(location.city);
        if (location.region) addressParts.push(location.region);
        if (location.country) addressParts.push(location.country);

        const address = addressParts.join(', ') || 'Address unavailable';

        // Cache the result
        lastGeocodedLocation.current = {
          lat: latitude,
          lng: longitude,
          address,
        };

        // Show feedback UI for newly geocoded addresses (if not already given feedback)
        if (!addressFeedbackGiven && address !== 'Address unavailable') {
          setShowAddressFeedback(true);
          // Auto-hide after 10 seconds
          setTimeout(() => {
            setShowAddressFeedback(false);
          }, 10000);
        }

        return address;
      }

      return 'Address unavailable';
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return 'Address unavailable';
    }
  };

  // ---------- Verified Address Functions ----------

  /**
   * Check if a verified address exists for nearby coordinates
   * @param {number} latitude
   * @param {number} longitude
   * @returns {Promise<string|null>} Verified address or null
   */
  const checkVerifiedAddress = async (latitude, longitude) => {
    if (!db.current) return null;

    try {
      // Search within ~50m radius
      const radiusKm = 0.05; // 50 meters
      const latDelta = radiusKm / 111.32;
      const lngDelta = radiusKm / (111.32 * Math.cos(latitude * Math.PI / 180));

      const results = await db.current.getAllAsync(
        `SELECT * FROM verified_addresses
         WHERE latitude BETWEEN ? AND ?
         AND longitude BETWEEN ? AND ?
         ORDER BY verified_count DESC, last_verified DESC
         LIMIT 1;`,
        [
          latitude - latDelta,
          latitude + latDelta,
          longitude - lngDelta,
          longitude + lngDelta
        ]
      );

      if (results && results.length > 0) {
        const verified = results[0];

        // Calculate actual distance to ensure it's within 50m
        const distance = getDistanceInMeters(
          latitude,
          longitude,
          verified.latitude,
          verified.longitude
        );

        if (distance <= 50) {
          console.log(`✅ Using verified address (${distance.toFixed(0)}m away, verified ${verified.verified_count}x)`);
          return verified.address;
        }
      }

      return null;
    } catch (error) {
      console.error('Error checking verified address:', error);
      return null;
    }
  };

  /**
   * Save a user-verified address to the cache
   * @param {number} latitude
   * @param {number} longitude
   * @param {string} address
   */
  const saveVerifiedAddress = async (latitude, longitude, address) => {
    if (!db.current || !address) return;

    try {
      const now = Date.now();

      // Check if a very similar address already exists nearby
      const existing = await db.current.getAllAsync(
        `SELECT * FROM verified_addresses
         WHERE address = ?
         AND ABS(latitude - ?) < 0.0005
         AND ABS(longitude - ?) < 0.0005
         LIMIT 1;`,
        [address, latitude, longitude]
      );

      if (existing && existing.length > 0) {
        // Increment existing verification
        await incrementVerificationCount(existing[0].id);
      } else {
        // Insert new verified address
        await db.current.runAsync(
          `INSERT INTO verified_addresses
           (latitude, longitude, address, verified_count, last_verified, created_at)
           VALUES (?, ?, ?, 1, ?, ?);`,
          [latitude, longitude, address, now, now]
        );
        console.log('✅ Saved verified address:', address);
      }
    } catch (error) {
      console.error('Error saving verified address:', error);
    }
  };

  /**
   * Increment verification count for an existing verified address
   * @param {number} id
   */
  const incrementVerificationCount = async (id) => {
    if (!db.current) return;

    try {
      const now = Date.now();
      await db.current.runAsync(
        `UPDATE verified_addresses
         SET verified_count = verified_count + 1, last_verified = ?
         WHERE id = ?;`,
        [now, id]
      );
      console.log('✅ Incremented verification count');
    } catch (error) {
      console.error('Error incrementing verification count:', error);
    }
  };

  /**
   * Handle user confirming address is correct
   */
  const handleAddressCorrect = async () => {
    if (currentLocation?.latitude && currentLocation?.longitude && currentLocation?.address) {
      await saveVerifiedAddress(
        currentLocation.latitude,
        currentLocation.longitude,
        currentLocation.address
      );
      setShowAddressFeedback(false);
      setAddressFeedbackGiven(true);
    }
  };

  /**
   * Handle user indicating address is incorrect
   */
  const handleAddressIncorrect = () => {
    setShowAddressFeedback(false);
    setAddressFeedbackGiven(true);
    // Future: Could open a dialog to let user correct the address
  };

  // Helper function to calculate distance between two coordinates
  const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // ---------- Database Functions ----------
  const initializeDatabase = async () => {
    try {
      console.log('🗄️ MultiModalLocationTracker: Getting database connection...');
      const database = await dbManager.getDatabase();
      db.current = database;

      // Create locations table (landmarks and mechanics tables are created by dbManager)
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS locations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          accuracy REAL,
          timestamp INTEGER NOT NULL,
          synced INTEGER DEFAULT 0,
          sources TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_synced ON locations(synced);
      `);

      await updateUnsyncedCount();
      console.log('✅ MultiModalLocationTracker: Database initialized');
    } catch (error) {
      console.error("Database initialization error:", error);
    }
  };

  const cacheLandmarks = async (landmarks) => {
    if (!db.current || !landmarks || landmarks.length === 0) return;
    try {
      const now = Date.now();
      for (const landmark of landmarks) {
        const id = landmark._id || landmark.id;
        const lat = landmark.location?.latitude || landmark.latitude;
        const lng = landmark.location?.longitude || landmark.longitude;

        if (!id || !lat || !lng) continue;

        // Upsert landmark
        await db.current.runAsync(
          `INSERT OR REPLACE INTO landmarks
        (id, name, description, category, latitude, longitude, timestamp, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1);`,
          [
            id,
            landmark.name,
            landmark.description || '',
            landmark.category || 'other',
            lat,
            lng,
            now
          ]
        );
      }
    } catch (error) {
      console.error("Error caching landmarks:", error);
    }
  };

  // NEW: Get cached landmarks from SQLite
  const getCachedLandmarks = async (latitude, longitude, radiusKm = 10) => {
    if (!db.current) return [];
    try {
      // Simple distance-based query (approximation)
      const latDelta = radiusKm / 111.32; // ~111.32 km per degree latitude
      const lngDelta = radiusKm / (111.32 * Math.cos(latitude * Math.PI / 180));

      const res = await db.current.getAllAsync(
        `SELECT * FROM landmarks
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

      return res || [];
    } catch (error) {
      console.error("Error getting cached landmarks:", error);
      return [];
    }
  };

  // NEW: Cache mechanics to SQLite
  const cacheMechanics = async (mechanics) => {
    if (!db.current || !mechanics || mechanics.length === 0) return;
    try {
      const now = Date.now();
      for (const mechanic of mechanics) {
        const id = mechanic._id || mechanic.id;
        const lat = mechanic.location?.latitude || mechanic.latitude;
        const lng = mechanic.location?.longitude || mechanic.longitude;

        if (!id || !lat || !lng) continue;

        await db.current.runAsync(
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
      console.error("Error caching mechanics:", error);
    }
  };

  // NEW: Get cached mechanics from SQLite
  const getCachedMechanics = async (latitude, longitude, radiusKm = 10) => {
    if (!db.current) return [];
    try {
      const latDelta = radiusKm / 111.32;
      const lngDelta = radiusKm / (111.32 * Math.cos(latitude * Math.PI / 180));

      const res = await db.current.getAllAsync(
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

      const mechanics = res || [];

      // Parse specialties JSON
      return mechanics.map(m => ({
        ...m,
        specialties: JSON.parse(m.specialties || '[]'),
        available: m.available === 1
      }));
    } catch (error) {
      console.error("Error getting cached mechanics:", error);
      return [];
    }
  };

  // NEW: Auto-sync function (every 5 minutes)
  const autoSyncData = async () => {
    if (!networkStatus.isConnected || !currentLocation?.latitude) return;

    try {
      console.log('🔄 Auto-syncing data...');

      // Sync landmarks
      const landmarkResult = await authService.getNearbyLandmarks(
        currentLocation.latitude,
        currentLocation.longitude,
        10000 // 10km radius
      );

      if (landmarkResult.success && landmarkResult.data) {
        await cacheLandmarks(landmarkResult.data);
        if (onLandmarksUpdate) {
          onLandmarksUpdate(landmarkResult.data);
        }
      }

      // Sync mechanics
      const mechanicResult = await authService.getNearbyMechanics(
        currentLocation.latitude,
        currentLocation.longitude,
        10000
      );

      if (mechanicResult.success && mechanicResult.data) {
        await cacheMechanics(mechanicResult.data);
        if (onMechanicsUpdate) {
          onMechanicsUpdate(mechanicResult.data);
        }
      }

      // Sync location history
      await syncWithBackend();

      console.log('✅ Auto-sync completed');
    } catch (error) {
      console.error('Auto-sync error:', error);
    }
  };




  const saveLocationLocally = async (location) => {
    if (!db.current || !location) return;
    try {
      const sources = JSON.stringify(locationSources || {});
      const ts = Date.now();
      await db.current.runAsync(
        "INSERT INTO locations (latitude, longitude, accuracy, timestamp, synced, sources) VALUES (?, ?, ?, ?, 0, ?);",
        [
          location.latitude,
          location.longitude,
          location.accuracy || null,
          ts,
          sources,
        ]
      );
      await updateUnsyncedCount();
    } catch (error) {
      console.error("Error saving location locally:", error);
    }
  };

  const updateUnsyncedCount = async () => {
    if (!db.current) return;
    try {
      const res = await db.current.getAllAsync(
        "SELECT COUNT(*) as c FROM locations WHERE synced = 0;"
      );
      const count = res?.[0]?.c || 0;
      setUnsyncedCount(count || 0);
    } catch (error) {
      console.error("Error counting unsynced rows:", error);
    }
  };

  const fetchUnsyncedBatch = async (limit = 50) => {
    const res = await db.current.getAllAsync(
      "SELECT * FROM locations WHERE synced = 0 ORDER BY timestamp ASC LIMIT ?;",
      [limit]
    );
    return res || [];
  };

  const markRowsSynced = async (ids = []) => {
    if (!ids.length) return;
    const placeholders = ids.map(() => "?").join(",");
    await db.current.runAsync(
      `UPDATE locations SET synced = 1 WHERE id IN (${placeholders});`,
      ids
    );
    await updateUnsyncedCount();
  };

  // ---------- Sync Logic ----------
  const syncWithBackend = async () => {
    if (!db.current || !networkStatus.isConnected) return;

    try {
      const token = await getToken();
      if (!token) {
        console.log('No auth token, skipping sync');
        return;
      }

      const rows = await fetchUnsyncedBatch(50);
      if (!rows.length) return;

      const syncedIds = [];
      for (let r of rows) {
        try {
          const body = {
            location: {
              latitude: r.latitude,
              longitude: r.longitude,
              accuracy: r.accuracy,
              timestamp: r.timestamp,
            },
            landmarks: [],
          };

          const result = await authService.authenticatedRequest(
            '/api/user/location',
            {
              method: 'POST',
              body: JSON.stringify(body),
            }
          );

          if (result.success) {
            syncedIds.push(r.id);
          }
        } catch (e) {
          console.warn('Failed to sync row', r.id, e);
        }
      }

      if (syncedIds.length) await markRowsSynced(syncedIds);
    } catch (error) {
      console.error('syncWithBackend error:', error);
    }
  };

  const startSyncTimer = () => {
    if (syncTimer.current) return;

    // Sync every 5 minutes (300000 ms)
    syncTimer.current = setInterval(() => {
      autoSyncData();
    }, 300000); // 5 minutes

    // Also do initial sync
    setTimeout(() => {
      autoSyncData();
    }, 5000); // After 5 seconds
  };
  const stopSyncTimer = () => {
    if (syncTimer.current) {
      clearInterval(syncTimer.current);
      syncTimer.current = null;
    }
  };

  // ---------- Load User ----------
  useEffect(() => {
    const loadUser = async () => {
      const userData = await authService.getUser();
      setUser(userData);
    };
    loadUser();
  }, []);

  // Reset feedback state when location changes significantly
  useEffect(() => {
    if (currentLocation?.latitude && currentLocation?.longitude) {
      setAddressFeedbackGiven(false);
    }
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  // ---------- Lifecycle ----------
  useEffect(() => {
    initializeDatabase();
    initializeLocationTracking();
    return cleanup;
  }, []);

  // ---------- Location Initialization ----------
  const initializeLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location permission is required");
        return;
      }
      setPermissionGranted(true);
      setInitStatus('Waiting for GPS fix...');

      try {
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });

        if (initialLocation?.coords) {
          const { latitude, longitude, accuracy } = initialLocation.coords;
          kalmanLat.current.reset(latitude);
          kalmanLng.current.reset(longitude);
          sensorData.current.lastPosition = { lat: latitude, lng: longitude };

          // Get initial address
          const address = await reverseGeocode(latitude, longitude);

          setCurrentLocation({
            latitude,
            longitude,
            accuracy: accuracy || 100,
            address,
          });

          setInitStatus('GPS acquired. Tracking active.');

          if (onLocationUpdate) {
            onLocationUpdate({
              latitude,
              longitude,
              accuracy: accuracy || 100,
            });
          }
        }
      } catch (e) {
        console.log("Waiting for initial GPS fix:", e);
        setInitStatus('Acquiring GPS signal...');
      }

      netInfoUnsubscribe.current = NetInfo.addEventListener((state) => {
        const previouslyDisconnected = !networkStatus.isConnected;
        const nowOnline = !!state.isConnected;
        setNetworkStatus({
          isConnected: nowOnline,
          type: state.type || "none",
        });
        if (previouslyDisconnected && nowOnline) {
          syncWithBackend();
        }
      });

      try {
        bleManager.current = new BleManager();
        await bleManager.current.state();
      } catch (error) {
        console.error("BLE init error:", error);
      }

      setIsTracking(true);
      startGPSTracking();
      startDeadReckoning();
      if (Platform.OS === "android") startWiFiScanning();
      startBluetoothScanning();
      startLocationFusion();
      startSyncTimer();
    } catch (err) {
      console.error("init error:", err);
      Alert.alert("Error", "Failed to initialize location tracking");
    }
  };

  // ---------- GPS Tracking ----------
  const startGPSTracking = async () => {
    try {
      subscriptions.current.location = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (location) => {
          if (location?.coords) {
            const gpsData = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy || 10,
              timestamp: Date.now(),
              source: "gps",
            };
            setLocationSources((prev) => ({ ...prev, gps: gpsData }));

            // Update last known position for dead reckoning
            sensorData.current.lastPosition = {
              lat: location.coords.latitude,
              lng: location.coords.longitude,
            };
          }
        }
      );
    } catch (e) {
      console.warn("GPS tracking failed, trying fallback", e);
      try {
        subscriptions.current.location = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 5,
          },
          (location) => {
            if (location?.coords) {
              setLocationSources((prev) => ({
                ...prev,
                gps: {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  accuracy: location.coords.accuracy || 50,
                  timestamp: Date.now(),
                  source: "gps",
                },
              }));

              sensorData.current.lastPosition = {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
              };
            }
          }
        );
      } catch (err) {
        console.error("GPS fallback failed", err);
      }
    }
  };

  // ---------- Dead Reckoning with Real Sensor Data ----------
  const startDeadReckoning = async () => {
    try {
      await Accelerometer.setUpdateInterval(100);
      await Gyroscope.setUpdateInterval(100);
      await Magnetometer.setUpdateInterval(100);

      subscriptions.current.accelerometer = Accelerometer.addListener(
        ({ x, y, z }) => {
          sensorData.current.acceleration = { x, y, z };

          // Calculate acceleration magnitude
          const magnitude = Math.sqrt(x * x + y * y + z * z);

          // Add to history for better step detection
          const history = sensorData.current.accelerationHistory;
          history.push({ magnitude, timestamp: Date.now() });

          // Keep only last 10 readings
          if (history.length > 10) history.shift();

          // Detect step: peak detection with debouncing
          const timeSinceLastStep = Date.now() - sensorData.current.lastStepTime;

          if (timeSinceLastStep > STEP_DEBOUNCE_MS) {
            // Check if current magnitude is a local maximum
            if (history.length >= 3) {
              const prevMag = history[history.length - 2]?.magnitude || 0;
              const nextMag = history[history.length - 1]?.magnitude || 0;

              if (magnitude > STEP_THRESHOLD &&
                magnitude > prevMag &&
                magnitude > nextMag) {
                sensorData.current.stepCount++;
                sensorData.current.lastStepTime = Date.now();
                updatePositionFromStep();
              }
            }
          }
        }
      );

      subscriptions.current.gyroscope = Gyroscope.addListener(({ x, y, z }) => {
        sensorData.current.gyroscope = { x, y, z };
      });

      subscriptions.current.magnetometer = Magnetometer.addListener(
        ({ x, y, z }) => {
          sensorData.current.magnetometer = { x, y, z };

          // Calculate heading from magnetometer (0-360 degrees)
          // Note: This is simplified; real implementation should account for
          // device tilt using accelerometer data
          let heading = Math.atan2(y, x) * (180 / Math.PI);
          if (heading < 0) heading += 360;

          sensorData.current.heading = heading;
        }
      );

      subscriptions.current.deadReckoning = setInterval(
        updatePositionFromStep,
        2000
      );
    } catch (error) {
      console.error("Sensor init error:", error);
    }
  };

  const updatePositionFromStep = () => {
    const { heading, lastPosition } = sensorData.current;

    // Only update if we have a valid last GPS position
    if (!lastPosition || lastPosition.lat === null) return;

    const headingRad = (heading * Math.PI) / 180;

    // Convert step length from meters to degrees
    const deltaLatMeters = AVERAGE_STEP_LENGTH_M * Math.cos(headingRad);
    const deltaLat = deltaLatMeters * METERS_TO_DEGREES_LAT;

    // Longitude degrees vary by latitude
    const metersToDegreesLng = 1 / (111320 * Math.cos((lastPosition.lat * Math.PI) / 180));
    const deltaLngMeters = AVERAGE_STEP_LENGTH_M * Math.sin(headingRad);
    const deltaLng = deltaLngMeters * metersToDegreesLng;

    sensorData.current.distanceTraveled += AVERAGE_STEP_LENGTH_M;

    setLocationSources((prev) => ({
      ...prev,
      deadReckoning: {
        latitude: lastPosition.lat + deltaLat,
        longitude: lastPosition.lng + deltaLng,
        accuracy: 25, // Dead reckoning accuracy degrades over time
        timestamp: Date.now(),
        source: "deadReckoning",
      },
    }));
  };

  // ---------- WiFi Scanning (Real RSSI Data) ----------
  const startWiFiScanning = async () => {
    subscriptions.current.wifiScan = setInterval(async () => {
      try {
        const wifiList = await WifiManager.loadWifiList();
        if (!wifiList?.length) return;

        const now = Date.now();

        // Store all detected access points with real RSSI values
        wifiList.forEach(ap => {
          if (ap.BSSID && ap.level) {
            // Calculate distance from RSSI using path loss formula
            // Distance (m) = 10 ^ ((TxPower - RSSI) / (10 * PathLossExponent))
            const distance = Math.pow(
              10,
              (WIFI_TX_POWER - ap.level) / (10 * PATH_LOSS_EXPONENT)
            );

            wifiAccessPoints.current.set(ap.BSSID, {
              bssid: ap.BSSID,
              ssid: ap.SSID || 'Unknown',
              rssi: ap.level,
              distance: distance,
              timestamp: now,
            });
          }
        });

        // Clean up old entries (>30s)
        for (const [bssid, data] of wifiAccessPoints.current.entries()) {
          if (now - data.timestamp > 30000) {
            wifiAccessPoints.current.delete(bssid);
          }
        }

        // Update WiFi source with strongest signal (for display purposes)
        // Note: True positioning would require trilateration with known AP locations
        if (wifiAccessPoints.current.size > 0) {
          const aps = Array.from(wifiAccessPoints.current.values());
          const strongest = aps.reduce((prev, curr) =>
            curr.rssi > prev.rssi ? curr : prev
          );

          setLocationSources((prev) => ({
            ...prev,
            wifi: {
              latitude: null, // No position without AP database
              longitude: null,
              accuracy: strongest.distance,
              rssi: strongest.rssi,
              ssid: strongest.ssid,
              timestamp: now,
              source: "wifi",
              apCount: wifiAccessPoints.current.size,
            },
          }));
        }
      } catch (e) {
        console.error("WiFi scan error:", e);
      }
    }, 5000);
  };




  // ---------- Bluetooth Scanning (Real Beacon Data) ----------
  const startBluetoothScanning = () => {
    if (!bleManager.current) return;

    try {
      bleManager.current.startDeviceScan(null, null, (error, device) => {
        if (error || !device?.rssi) return;

        // Calculate distance from RSSI
        const distance = Math.pow(
          10,
          (BLE_TX_POWER - device.rssi) / (10 * PATH_LOSS_EXPONENT)
        );

        bluetoothBeacons.current.set(device.id, {
          id: device.id,
          name: device.name || 'Unknown',
          rssi: device.rssi,
          distance: distance,
          timestamp: Date.now(),
        });

        // Clean up old beacons (>30s)
        const now = Date.now();
        for (const [id, data] of bluetoothBeacons.current.entries()) {
          if (now - data.timestamp > 30000) {
            bluetoothBeacons.current.delete(id);
          }
        }

        // Update Bluetooth source with beacon data
        // Note: True positioning requires trilateration with known beacon locations
        if (bluetoothBeacons.current.size > 0) {
          const beacons = Array.from(bluetoothBeacons.current.values());
          const closest = beacons.reduce((prev, curr) =>
            curr.distance < prev.distance ? curr : prev
          );

          setLocationSources((prev) => ({
            ...prev,
            bluetooth: {
              latitude: null, // No position without beacon database
              longitude: null,
              accuracy: closest.distance,
              rssi: closest.rssi,
              deviceName: closest.name,
              timestamp: now,
              source: "bluetooth",
              beaconCount: bluetoothBeacons.current.size,
            },
          }));
        }
      });
    } catch (err) {
      console.error("BLE scan error:", err);
    }
  };

  // ---------- Location Fusion (Real Data Only) ----------
  const startLocationFusion = () => {
    subscriptions.current.fusion = setInterval(fuseLocationData, 1000);
  };

  const fuseLocationData = () => {
    // Only use sources with valid latitude/longitude coordinates
    const sources = Object.values(locationSources).filter(
      (source) =>
        source?.timestamp > Date.now() - SOURCE_TIMEOUT_MS &&
        source.latitude !== null &&
        source.longitude !== null &&
        !isNaN(source.latitude) &&
        !isNaN(source.longitude)
    );

    if (sources.length === 0) return;

    // Sort by accuracy and recency
    sources.sort((a, b) => {
      const accuracyDiff = (a.accuracy || 100) - (b.accuracy || 100);
      const timeDiff = (b.timestamp - a.timestamp) / 1000;
      return accuracyDiff + timeDiff * 10;
    });

    const primarySource = sources[0];
    const noise = NOISE_MAP[primarySource.source] || 0.05;
    kalmanLat.current.setMeasurementNoise(noise);
    kalmanLng.current.setMeasurementNoise(noise);

    let filteredLat = kalmanLat.current.update(primarySource.latitude);
    let filteredLng = kalmanLng.current.update(primarySource.longitude);

    // Weighted fusion if multiple sources available
    if (sources.length > 1) {
      let totalWeight = 1 / (primarySource.accuracy || 10);
      let weightedLat = filteredLat * totalWeight;
      let weightedLng = filteredLng * totalWeight;

      sources.slice(1, 3).forEach((source) => {
        const weight = 1 / ((source.accuracy || 10) * 2);
        totalWeight += weight;
        weightedLat += source.latitude * weight;
        weightedLng += source.longitude * weight;
      });

      filteredLat = weightedLat / totalWeight;
      filteredLng = weightedLng / totalWeight;
    }

    const fusedLocation = {
      latitude: filteredLat,
      longitude: filteredLng,
      accuracy:
        sources.length > 1
          ? Math.max(5, primarySource.accuracy * 0.8)
          : primarySource.accuracy,
    };

    // Get address asynchronously (don't block location update)
    reverseGeocode(filteredLat, filteredLng).then((address) => {
      setCurrentLocation((prev) => ({
        ...prev,
        address,
      }));
    });

    setCurrentLocation(fusedLocation);
    sensorData.current.lastPosition = { lat: filteredLat, lng: filteredLng };
    saveLocationLocally(fusedLocation);

    if (onLocationUpdate) {
      onLocationUpdate(fusedLocation);
    }
  };

  // ---------- Cleanup ----------
  const cleanup = () => {
    subscriptions.current.location?.remove?.();
    subscriptions.current.accelerometer?.remove?.();
    subscriptions.current.gyroscope?.remove?.();
    subscriptions.current.magnetometer?.remove?.();
    if (netInfoUnsubscribe.current) netInfoUnsubscribe.current();
    if (subscriptions.current.fusion)
      clearInterval(subscriptions.current.fusion);
    if (subscriptions.current.deadReckoning)
      clearInterval(subscriptions.current.deadReckoning);
    if (subscriptions.current.wifiScan)
      clearInterval(subscriptions.current.wifiScan);
    stopSyncTimer();
    try {
      bleManager.current?.stopDeviceScan();
    } catch (e) {
      /* ignore */
    }
  };


  // Expose state and handlers to parent via ref
  useImperativeHandle(ref, () => ({
    currentLocation,
    networkStatus,
    locationSources,
    showAddressFeedback,
    handleAddressCorrect,
    handleAddressIncorrect,
  }));

  // ---------- Render ----------
  // Headless component - no UI rendering
  return null;
});

export default MultiModalLocationTracker;