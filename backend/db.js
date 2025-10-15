// backend/db.js
import mongoose from 'mongoose';

// --- SCHEMAS ---
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    timestamp: Date
  },
  landmarks: [String],
  lastUpdated: { type: Date, default: Date.now }
});

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
const User = mongoose.model('User', userSchema);
const Mechanic = mongoose.model('Mechanic', mechanicSchema);

// --- CONNECTION ---
export const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(
    process.env.MONGODB_URI || 'mongodb://localhost:27017/locationtracker',
    {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  );
};

// --- FUNCTIONS ---
export const updateUserLocation = async (userId, location, landmarks = []) => {
  await connectDB();
  return await User.findOneAndUpdate(
    { userId },
    {
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: new Date()
      },
      landmarks,
      lastUpdated: new Date()
    },
    { upsert: true, new: true }
  );
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
  const users = await User.find({
    'location.latitude': { $gte: lat - 0.01, $lte: lat + 0.01 },
    'location.longitude': { $gte: lng - 0.01, $lte: lng + 0.01 }
  });

  const landmarks = new Set();
  users.forEach(user => {
    if (user.landmarks) {
      user.landmarks.forEach(landmark => landmarks.add(landmark));
    }
  });

  return Array.from(landmarks);
};

// --- EXPORT MODELS TOO ---
export { Mechanic, User };

