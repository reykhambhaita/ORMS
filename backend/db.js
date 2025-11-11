// backend/db.js
import crypto from 'crypto';
import mongoose from 'mongoose';

// --- ENCRYPTION SETUP ---
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

const encrypt = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );

  let encrypted = cipher.update(JSON.stringify(text), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
};

const decrypt = (encryptedData) => {
  if (!encryptedData) return null;

  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
};

// --- SCHEMAS ---

// User Schema
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Location History Schema (linked to User)
const locationHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  encryptedLocation: { type: String },
  landmarks: [String],
  timestamp: { type: Date, default: Date.now },
  synced: { type: Boolean, default: true }
});

locationHistorySchema.virtual('location').get(function() {
  return this.encryptedLocation ? decrypt(this.encryptedLocation) : null;
});

locationHistorySchema.set('toJSON', { virtuals: true });
locationHistorySchema.set('toObject', { virtuals: true });

// Mechanic Schema
const mechanicSchema = new mongoose.Schema({
  name: String,
  phone: String,
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number]
  },
  specialties: [String],
  rating: Number,
  available: { type: Boolean, default: true }
});

mechanicSchema.index({ location: '2dsphere' });

// --- MODELS ---
// Use mongoose.models to prevent model redefinition in serverless
const User = mongoose.models.User || mongoose.model('User', userSchema);
const LocationHistory = mongoose.models.LocationHistory || mongoose.model('LocationHistory', locationHistorySchema);
const Mechanic = mongoose.models.Mechanic || mongoose.model('Mechanic', mechanicSchema);

// --- CONNECTION ---
// Cache for serverless to reuse connections
let cachedConnection = null;

export const connectDB = async () => {
  try {
    // Return cached connection if available
    if (cachedConnection && mongoose.connection.readyState === 1) {
      console.log('✓ Using cached MongoDB connection');
      return cachedConnection;
    }

    // If currently connecting, wait for it
    if (mongoose.connection.readyState === 2) {
      console.log('⏳ Waiting for existing connection...');
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
        mongoose.connection.once('connected', () => {
          clearTimeout(timeout);
          resolve();
        });
        mongoose.connection.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      cachedConnection = mongoose.connection;
      return cachedConnection;
    }

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    console.log('🔌 Creating new MongoDB connection...');

    // Serverless-optimized connection options
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1,
      // Important for serverless: don't buffer commands
      bufferCommands: false,
    });

    console.log('✅ MongoDB connected successfully');
    cachedConnection = mongoose.connection;

    return cachedConnection;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    cachedConnection = null;
    throw error;
  }
};

// --- FUNCTIONS ---

// Updated to use authenticated userId
export const updateUserLocation = async (userId, location, landmarks = []) => {
  await connectDB();

  const encryptedLocation = encrypt({
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    timestamp: new Date()
  });

  // Save to location history
  const locationDoc = new LocationHistory({
    userId,
    encryptedLocation,
    landmarks,
    timestamp: new Date()
  });

  return await locationDoc.save();
};

export const getUserLocationHistory = async (userId, limit = 50) => {
  await connectDB();
  return await LocationHistory.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

export const getNearbyMechanics = async (lat, lng, radius = 5000) => {
  await connectDB();
  return await Mechanic.find({
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radius
      }
    },
    available: true
  }).limit(20);
};

export const getLandmarksNearLocation = async (lat, lng, radius = 1000) => {
  await connectDB();

  const allLocations = await LocationHistory.find({});
  const nearbyLocations = allLocations.filter(loc => {
    if (!loc.encryptedLocation) return false;

    const location = decrypt(loc.encryptedLocation);
    if (!location) return false;

    const latDiff = Math.abs(location.latitude - lat);
    const lngDiff = Math.abs(location.longitude - lng);

    return latDiff <= 0.01 && lngDiff <= 0.01;
  });

  const landmarks = new Set();
  nearbyLocations.forEach(loc => {
    if (loc.landmarks) {
      loc.landmarks.forEach(landmark => landmarks.add(landmark));
    }
  });

  return Array.from(landmarks);
};

export { LocationHistory, Mechanic, User };
