import mongoose from 'mongoose';


// User Location Schema (encrypted coordinates)
const userLocationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  encryptedLat: {
    type: String,
    required: true
  },
  encryptedLng: {
    type: String,
    required: true
  },
  locatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

// Mechanic Schema (Server-side)
const mechanicSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  location: {
    lat: { type: String, required: true }, // encrypted
    lng: { type: String, required: true }, // encrypted
    locatedAt: { type: Date, default: Date.now }
  },
  services: [{ type: String, trim: true, required: true }],
  ratings: [{ type: Number, min: 0, max: 5 }],
  organisation: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
  timestamp: { type: Date, default: Date.now },
  // Offline sync fields
  lastSyncVersion: { type: Number, default: 1 },
  region: { type: String, index: true }, // for regional downloads
  priority: { type: Number, default: 0 } // higher priority mechanics downloaded first
}, { timestamps: true });

// Enhanced indexes for offline sync
mechanicSchema.index({ 'location.lat': 1, 'location.lng': 1 });
mechanicSchema.index({ isActive: 1, region: 1 });
mechanicSchema.index({ lastSyncVersion: 1 });
mechanicSchema.index({ priority: -1 });

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, unique: true },
  phone: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true },
  lastLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'UserLocation' },
  // NEW: User preferences for offline data
  preferredRegions: [{ type: String }], // regions to prioritize for offline data
  offlineRadius: { type: Number, default: 50000 }, // meters, radius for offline data
  lastOfflineSync: { type: Date }
}, { timestamps: true });

// Landmark Schema (Server-side)
const landmarkSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, trim: true },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  // NEW: Offline sync fields
  region: { type: String, index: true },
  lastSyncVersion: { type: Number, default: 1 },
  priority: { type: Number, default: 0 }
}, { timestamps: true });

landmarkSchema.index({ 'location.lat': 1, 'location.lng': 1 });
landmarkSchema.index({ region: 1, category: 1 });

// Admin Schema (unchanged)
const adminSchema = new mongoose.Schema({
  role: { type: String, required: true, trim: true },
  managedRegions: [{ type: String, trim: true }],
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  landmarkCategories: [{
    category: { type: String, trim: true },
    landmarks: [landmarkSchema]
  }]
}, { timestamps: true });


// Local Mechanic Cache Schema (for offline storage)
const localMechanicSchema = {
  id: 'string', // original MongoDB _id
  username: 'string',
  phone: 'string',
  address: 'string',
  location: {
    lat: 'number', // decrypted for local matching
    lng: 'number', // decrypted for local matching
    locatedAt: 'date'
  },
  services: ['string'],
  avgRating: 'number', // calculated average
  ratingCount: 'number',
  organisation: 'string',
  isActive: 'boolean',
  region: 'string',
  priority: 'number',
  lastSyncVersion: 'number',
  downloadedAt: 'date' // when this record was cached
};

// Local Landmark Cache Schema
const localLandmarkSchema = {
  id: 'string',
  name: 'string',
  category: 'string',
  location: {
    lat: 'number',
    lng: 'number'
  },
  region: 'string',
  priority: 'number',
  lastSyncVersion: 'number',
  downloadedAt: 'date'
};

// Sync Metadata Schema (tracks what's been downloaded)
const syncMetadataSchema = {
  entityType: 'string', // 'mechanic' or 'landmark'
  region: 'string',
  lastSyncVersion: 'number',
  lastSyncTime: 'date',
  totalRecords: 'number',
  userLocation: {
    lat: 'number',
    lng: 'number',
    radius: 'number' // download radius
  }
};


class OfflineSyncService {
  constructor() {
    // Check if running in browser environment
    if (typeof window === 'undefined') {
      console.warn('OfflineSyncService is designed for browser environment only');
      return;
    }

    this.isOnline = navigator.onLine;
    this.syncInProgress = false;

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.performIncrementalSync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  // Initial download when app opens
  async initializeOfflineData(userLocation, radius = 50000) {
    if (!this.isOnline || this.syncInProgress) return;

    this.syncInProgress = true;
    console.log('🔄 Initializing offline data...');

    try {
      // Download mechanics within radius
      await this.downloadMechanics(userLocation, radius);

      // Download landmarks within radius
      await this.downloadLandmarks(userLocation, radius);

      // Update sync metadata
      await this.updateSyncMetadata('initialization', userLocation, radius);

      console.log('✅ Offline data initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize offline data:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Download mechanics for offline use
  async downloadMechanics(userLocation, radius) {
    const response = await fetch('/api/mechanics/offline-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: userLocation,
        radius: radius,
        includeInactive: false,
        decryptCoordinates: true // server decrypts for client
      })
    });

    const { mechanics, syncVersion } = await response.json();

    // Store in local storage/IndexedDB
    await this.storeLocalMechanics(mechanics);

    return mechanics.length;
  }

  // Download landmarks for offline use
  async downloadLandmarks(userLocation, radius) {
    const response = await fetch('/api/landmarks/offline-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: userLocation,
        radius: radius
      })
    });

    const { landmarks, syncVersion } = await response.json();

    // Store in local storage/IndexedDB
    await this.storeLocalLandmarks(landmarks);

    return landmarks.length;
  }

  // Store mechanics locally
  async storeLocalMechanics(mechanics) {
    const transformedMechanics = mechanics.map(m => ({
      id: m._id,
      username: m.username,
      phone: m.phone,
      address: m.address,
      location: m.location, // already decrypted by server
      services: m.services,
      avgRating: this.calculateAverage(m.ratings),
      ratingCount: m.ratings.length,
      organisation: m.organisation,
      isActive: m.isActive,
      region: m.region,
      priority: m.priority,
      lastSyncVersion: m.lastSyncVersion,
      downloadedAt: new Date().toISOString()
    }));

    localStorage.setItem('cached_mechanics', JSON.stringify(transformedMechanics));
  }

  // Store landmarks locally
  async storeLocalLandmarks(landmarks) {
    const transformedLandmarks = landmarks.map(l => ({
      id: l._id,
      name: l.name,
      category: l.category,
      location: l.location,
      region: l.region,
      priority: l.priority,
      lastSyncVersion: l.lastSyncVersion,
      downloadedAt: new Date().toISOString()
    }));

    localStorage.setItem('cached_landmarks', JSON.stringify(transformedLandmarks));
  }

  // Offline location matching
  findNearbyMechanics(userLat, userLng, maxDistance = 10000, services = []) {
    const cached = JSON.parse(localStorage.getItem('cached_mechanics') || '[]');

    return cached
      .filter(m => m.isActive)
      .map(mechanic => ({
        ...mechanic,
        distance: this.calculateDistance(userLat, userLng,
          mechanic.location.lat, mechanic.location.lng)
      }))
      .filter(m => m.distance <= maxDistance)
      .filter(m => services.length === 0 ||
        services.some(service => m.services.includes(service)))
      .sort((a, b) => a.distance - b.distance);
  }

  // Offline landmark matching
  findNearbyLandmarks(userLat, userLng, maxDistance = 5000, categories = []) {
    const cached = JSON.parse(localStorage.getItem('cached_landmarks') || '[]');

    return cached
      .map(landmark => ({
        ...landmark,
        distance: this.calculateDistance(userLat, userLng,
          landmark.location.lat, landmark.location.lng)
      }))
      .filter(l => l.distance <= maxDistance)
      .filter(l => categories.length === 0 || categories.includes(l.category))
      .sort((a, b) => a.distance - b.distance);
  }

  // Haversine distance calculation
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRad(value) {
    return value * Math.PI / 180;
  }

  calculateAverage(ratings) {
    if (!ratings || ratings.length === 0) return 0;
    return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  }

  // Incremental sync when coming back online
  async performIncrementalSync() {
    if (!this.isOnline) return;

    console.log('🔄 Performing incremental sync...');
    // Implementation for incremental updates
  }

  // Update sync metadata
  async updateSyncMetadata(type, location, radius) {
    const metadata = {
      entityType: type,
      lastSyncTime: new Date().toISOString(),
      userLocation: { lat: location.lat, lng: location.lng, radius }
    };
    localStorage.setItem('sync_metadata', JSON.stringify(metadata));
  }
}

// Initialize when app starts (only in browser)
let offlineSync;
if (typeof window !== 'undefined') {
  offlineSync = new OfflineSyncService();
}

// When app opens, download offline data (browser only)
async function initializeApp() {
  if (typeof window === 'undefined' || !offlineSync) {
    console.warn('initializeApp is for browser environment only');
    return;
  }

  // Get user's current location
  navigator.geolocation.getCurrentPosition(async (position) => {
    const userLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };

    // Download offline data for 50km radius
    await offlineSync.initializeOfflineData(userLocation, 50000);
  });
}

//Find nearby mechanics offline (browser only)
function findMechanicsOffline(userLat, userLng) {
  if (typeof window === 'undefined' || !offlineSync) {
    console.warn('findMechanicsOffline is for browser environment only');
    return [];
  }

  const nearbyMechanics = offlineSync.findNearbyMechanics(
    userLat, userLng,
    10000, // 10km radius
    ['tire_repair', 'engine_repair'] // specific services
  );

  console.log('Found offline mechanics:', nearbyMechanics);
  return nearbyMechanics;
}

// Example: Find nearby landmarks offline (browser only)
function findLandmarksOffline(userLat, userLng) {
  if (typeof window === 'undefined' || !offlineSync) {
    console.warn('findLandmarksOffline is for browser environment only');
    return [];
  }

  const nearbyLandmarks = offlineSync.findNearbyLandmarks(
    userLat, userLng,
    5000, // 5km radius
    ['gas_station', 'highway_exit'] // specific categories
  );

  console.log('Found offline landmarks:', nearbyLandmarks);
  return nearbyLandmarks;
}

// Export everything
export const UserLocation = mongoose.model('UserLocation', userLocationSchema);
export const Mechanic = mongoose.model('Mechanic', mechanicSchema);
export const User = mongoose.model('User', userSchema);
export const Admin = mongoose.model('Admin', adminSchema);
export const Landmark = mongoose.model('Landmark', landmarkSchema);

export {
  userLocationSchema,
  mechanicSchema,
  userSchema,
  adminSchema,
  landmarkSchema,
  OfflineSyncService,
  initializeApp,
  findMechanicsOffline,
  findLandmarksOffline
};