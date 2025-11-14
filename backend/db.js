// backend/db.js
import crypto from 'crypto';
import mongoose from 'mongoose';

// --- ENCRYPTION SETUP ---
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if(!ENCRYPTION_KEY){
  console.error("ENCRYPTION_KEY is not defined in environment variables");
  process.exit(1);
}
if(buffer.from(ENCRYPTION_KEY, 'hex').length !== 32){
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

// Mechanic Schema - UPDATED with userId reference
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

mechanicSchema.index({ location: '2dsphere' });

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

// --- MODELS ---
const User = mongoose.models.User || mongoose.model('User', userSchema);
const LocationHistory = mongoose.models.LocationHistory || mongoose.model('LocationHistory', locationHistorySchema);
const Mechanic = mongoose.models.Mechanic || mongoose.model('Mechanic', mechanicSchema);
const Landmark = mongoose.models.Landmark || mongoose.model('Landmark', landmarkSchema);

// --- CONNECTION ---
let cachedConnection = null;

export const connectDB = async () => {
  try {
    if (cachedConnection && mongoose.connection.readyState === 1) {
      console.log('✓ Using cached MongoDB connection');
      return cachedConnection;
    }

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

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1,
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

// Mechanic Functions
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
  })
  .populate('userId', 'username email')
  .limit(20);
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
      coordinates: [mechanicData.longitude, mechanicData.latitude]
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
      }
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

export { Landmark, LocationHistory, Mechanic, User };
