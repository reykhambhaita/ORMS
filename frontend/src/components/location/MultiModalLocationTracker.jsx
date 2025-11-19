import NetInfo from "@react-native-community/netinfo";
import * as Location from "expo-location";
import { Accelerometer, Gyroscope, Magnetometer } from "expo-sensors";
import * as SQLite from "expo-sqlite";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  View
} from "react-native";
import { BleManager } from "react-native-ble-plx";
import WifiManager from "react-native-wifi-reborn";
import authService from "../../screens/authService";

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

const MultiModalLocationTracker = ({ onLocationUpdate, onLandmarksUpdate, onMechanicUpdate }) => {
  const [currentLocation, setCurrentLocation] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
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

  // ---------- Token Management ----------
  const getToken = async () => {
    try {
      return await authService.getToken();
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  };

  // ---------- Database Functions ----------
  const openDatabase = () => {
    return SQLite.openDatabase("locationtracker.db");
  };

  const execSqlAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      if (!db.current) return resolve(null);
      db.current.transaction(
        (tx) => {
          tx.executeSql(
            sql,
            params,
            (_, result) => resolve(result),
            (_, err) => {
              reject(err);
              return false;
            }
          );
        },
        (txErr) => reject(txErr)
      );
    });
  };


  const initializeDatabase = async () => {
    try {
      db.current = openDatabase();
      await execSqlAsync(`CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      timestamp INTEGER NOT NULL,
      synced INTEGER DEFAULT 0,
      sources TEXT
    );`);
      await execSqlAsync(
        "CREATE INDEX IF NOT EXISTS idx_synced ON locations(synced);"
      );

      // NEW: Initialize landmarks and mechanics tables
      await initializeLandmarksTable();
      await initializeMechanicsTable();

      await updateUnsyncedCount();
    } catch (error) {
      console.error("Database initialization error:", error);
    }
  };


  const initializeLandmarksTable = async () => {
    try {
      await execSqlAsync(`CREATE TABLE IF NOT EXISTS landmarks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      synced INTEGER DEFAULT 1
    );`);
      await execSqlAsync("CREATE INDEX IF NOT EXISTS idx_landmarks_location ON landmarks(latitude, longitude);");
    } catch (error) {
      console.error("Landmarks table initialization error:", error);
    }
  };

  const initializeMechanicsTable = async () => {
    try {
      await execSqlAsync(`CREATE TABLE IF NOT EXISTS mechanics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      specialties TEXT,
      rating REAL,
      available INTEGER,
      timestamp INTEGER NOT NULL,
      synced INTEGER DEFAULT 1
    );`);
      await execSqlAsync("CREATE INDEX IF NOT EXISTS idx_mechanics_location ON mechanics(latitude, longitude);");
    } catch (error) {
      console.error("Mechanics table initialization error:", error);
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
        await execSqlAsync(
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

      const res = await execSqlAsync(
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

      return res?.rows?._array || [];
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

        await execSqlAsync(
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

      const res = await execSqlAsync(
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

      const mechanics = res?.rows?._array || [];

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
      await execSqlAsync(
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
      const res = await execSqlAsync(
        "SELECT COUNT(*) as c FROM locations WHERE synced = 0;"
      );
      const count = res?.rows?.item
        ? res.rows.item(0).c
        : res?.rows?._array?.length || 0;
      setUnsyncedCount(count || 0);
    } catch (error) {
      console.error("Error counting unsynced rows:", error);
    }
  };

  const fetchUnsyncedBatch = async (limit = 50) => {
    const res = await execSqlAsync(
      "SELECT * FROM locations WHERE synced = 0 ORDER BY timestamp ASC LIMIT ?;",
      [limit]
    );
    return res?.rows?._array || [];
  };

  const markRowsSynced = async (ids = []) => {
    if (!ids.length) return;
    const placeholders = ids.map(() => "?").join(",");
    await execSqlAsync(
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

          setCurrentLocation({
            latitude,
            longitude,
            accuracy: accuracy || 100,
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

  // ---------- UI Helper Functions ----------
  const getActiveSourcesCount = () =>
    Object.values(locationSources).filter(
      (s) => s?.timestamp > Date.now() - SOURCE_TIMEOUT_MS
    ).length;

  const getSourceStatus = (source) =>
    source?.timestamp > Date.now() - SOURCE_TIMEOUT_MS ? "Ã¢Å“â€œ" : "Ã¢Å“â€”";

  // ---------- Render ----------
  // Replace the entire return statement (around line 250+) with this:
return (
  <View style={styles.container}>
    {(!currentLocation?.latitude || !currentLocation?.longitude) && (
      <View style={[styles.card, styles.statusCard]}>
        <Text style={styles.statusTitle}>📍 {initStatus}</Text>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    )}

    <Text style={styles.title}>📍 Current Location</Text>

    {user && (
      <View style={styles.userCard}>
        <Text style={styles.userName}>👤 {user.username}</Text>
        <Text style={styles.userRole}>Role: {user.role}</Text>
      </View>
    )}

    <View style={styles.card}>
      <Text style={styles.locationText}>
        📍 {currentLocation.address || 'Acquiring location...'}
      </Text>
      <Text style={styles.coordsText}>
        Lat: {currentLocation.latitude?.toFixed(6) || 'N/A'}, Lng: {currentLocation.longitude?.toFixed(6) || 'N/A'}
      </Text>
      <Text style={styles.accuracyText}>
        🎯 Accuracy: {currentLocation.accuracy ? `±${currentLocation.accuracy.toFixed(0)}m` : 'No fix'}
      </Text>
      <Text style={styles.networkText}>
        {networkStatus.isConnected ? '🟢 Online' : '🔴 Offline'} ({networkStatus.type})
      </Text>
    </View>
  </View>
);
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  card: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  statusCard: {
    backgroundColor: '#FFF9E6',
    borderColor: '#FFD700',
    borderWidth: 1,
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
    color: "#333",
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  userCard: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: '#666',
  },
  locationText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 6,
    fontWeight: '500',
  },
  coordsText: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#666',
    marginBottom: 6,
  },
  accuracyText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  networkText: {
    fontSize: 14,
    color: '#666',
  },
});
export default MultiModalLocationTracker;