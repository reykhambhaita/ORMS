// backend/db.js
import crypto from 'crypto';
import mongoose from 'mongoose';

// --- ENCRYPTION SETUP ---
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  console.error("ENCRYPTION_KEY is not defined in environment variables");
  process.exit(1);
}
if (Buffer.from(ENCRYPTION_KEY, 'hex').length !== 32) {
  console.error("ENCRYPTION_KEY must be 32 bytes (64 hex characters) long");
  process.exit(1);
}
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

// User Schema - UPDATED with role
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
  role: {
    type: String,
    enum: ['user', 'mechanic'],
    default: 'user'
  },
  avatar: {
    type: String,
    default: null
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

locationHistorySchema.virtual('location').get(function () {
  return this.encryptedLocation ? decrypt(this.encryptedLocation) : null;
});

locationHistorySchema.set('toJSON', { virtuals: true });
locationHistorySchema.set('toObject', { virtuals: true });

// Mechanic Schema - UPDATED with userId reference and lastSeen for TTL
const mechanicSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  location: {
    type: {
      type: String,
      default: 'Point',
      enum: ['Point']
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  specialties: {
    type: [String],
    default: []
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  available: {
    type: Boolean,
    default: true
  },
  lastSeen: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Optimized compound indexes for better query performance
mechanicSchema.index({ location: '2dsphere' });
mechanicSchema.index({ location: '2dsphere', available: 1, lastSeen: -1 });

// NEW: Landmark Schema
const landmarkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['restaurant', 'gas_station', 'hospital', 'parking', 'landmark', 'shop', 'other'],
    default: 'other'
  },
  location: {
    type: {
      type: String,
      default: 'Point',
      enum: ['Point']
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  verified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

landmarkSchema.index({ location: '2dsphere' });
landmarkSchema.index({ category: 1 });




// Review Schema
const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  mechanicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mechanic',
    required: true,
    index: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    default: ''
  },
  callDuration: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

reviewSchema.index({ userId: 1, mechanicId: 1 }, { unique: true });


const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  mechanicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mechanic',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paypalOrderId: {
    type: String,
    required: true
  },
  paypalCaptureId: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  description: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  }
});


// Call Log Schema (for tracking calls for reviews)
const callLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  mechanicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Mechanic',
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  callStartTime: {
    type: Date,
    required: true
  },
  callEndTime: {
    type: Date
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  reviewed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

callLogSchema.index({ userId: 1, mechanicId: 1, reviewed: 1 });


// --- MODELS ---
const User = mongoose.models.User || mongoose.model('User', userSchema);
const LocationHistory = mongoose.models.LocationHistory || mongoose.model('LocationHistory', locationHistorySchema);
const Mechanic = mongoose.models.Mechanic || mongoose.model('Mechanic', mechanicSchema);
const Landmark = mongoose.models.Landmark || mongoose.model('Landmark', landmarkSchema);
const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
const CallLog = mongoose.models.CallLog || mongoose.model('CallLog', callLogSchema);

// --- CONNECTION ---
let cachedConnection = null;

export const connectDB = async () => {
  try {
    if (cachedConnection && mongoose.connection.readyState === 1) {
      console.log('âœ“ Using cached MongoDB connection');
      return cachedConnection;
    }

    if (mongoose.connection.readyState === 2) {
      console.log('â³ Waiting for existing connection...');
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

    console.log('Creating new MongoDB connection...');

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1,
      bufferCommands: false,
    });

    console.log('âœ… MongoDB connected successfully');
    cachedConnection = mongoose.connection;

    return cachedConnection;
  } catch (error) {
    console.error('âŒ MongoDB connection error:', error);
    cachedConnection = null;
    throw error;
  }
};

// --- FUNCTIONS ---

// Location Functions
export const updateUserLocation = async (userId, location, landmarks = []) => {
  await connectDB();

  const encryptedLocation = encrypt({
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    timestamp: new Date()
  });

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

// Mechanic Functions - OPTIMIZED with TTL filtering
export const getNearbyMechanics = async (lat, lng, radius = 5000) => {
  await connectDB();

  console.log('🔍 [getNearbyMechanics] Searching mechanics:', { lat, lng, radius });

  // Calculate TTL threshold (1 hour ago)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  try {
    // Optimized geospatial query with TTL filter
    const mechanics = await Mechanic.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radius
        }
      },
      available: true,
      lastSeen: { $gte: oneHourAgo } // Only mechanics active in last hour
    })
      .populate('userId', 'username email')
      .limit(50); // Increased limit with pagination support

    console.log(`✅ [getNearbyMechanics] Found ${mechanics.length} active mechanics`);
    return mechanics;

  } catch (error) {
    console.error('❌ [getNearbyMechanics] Geospatial query failed:', error.message);
    // Return empty array on error (no fallback that loads all mechanics)
    return [];
  }
};

export const createMechanicProfile = async (userId, mechanicData) => {
  await connectDB();

  // Check if user already has a mechanic profile
  const existingProfile = await Mechanic.findOne({ userId });
  if (existingProfile) {
    throw new Error('Mechanic profile already exists for this user');
  }

  const mechanic = new Mechanic({
    userId,
    name: mechanicData.name,
    phone: mechanicData.phone,
    location: {
      type: 'Point',
      coordinates: [
        Number(mechanicData.longitude),
        Number(mechanicData.latitude)
      ]
    },
    specialties: mechanicData.specialties || [],
    available: mechanicData.available !== undefined ? mechanicData.available : true
  });

  return await mechanic.save();
};

export const updateMechanicLocation = async (userId, latitude, longitude) => {
  await connectDB();

  return await Mechanic.findOneAndUpdate(
    { userId },
    {
      location: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      lastSeen: new Date() // Update lastSeen timestamp
    },
    { new: true }
  );
};

// Landmark Functions
export const createLandmark = async (userId, landmarkData) => {
  await connectDB();

  const landmark = new Landmark({
    userId,
    name: landmarkData.name,
    description: landmarkData.description || '',
    category: landmarkData.category || 'other',
    location: {
      type: 'Point',
      coordinates: [landmarkData.longitude, landmarkData.latitude]
    }
  });

  return await landmark.save();
};

export const getNearbyLandmarks = async (lat, lng, radius = 5000, category = null) => {
  await connectDB();

  const query = {
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radius
      }
    }
  };

  if (category) {
    query.category = category;
  }

  return await Landmark.find(query)
    .populate('userId', 'username')
    .limit(50);
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

export { CallLog, Landmark, LocationHistory, Mechanic, Payment, Review, User };

