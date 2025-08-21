import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import crypto from 'crypto';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// MongoDB connection (clean, no deprecated options)
mongoose.connect('mongodb://localhost:27017/roadmechanic')
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// User Location Schema (encrypted)
const userLocationSchema = new mongoose.Schema({
  userId: String,
  encryptedLat: String,
  encryptedLng: String,
  timestamp: { type: Date, default: Date.now }
});
const UserLocation = mongoose.model('UserLocation', userLocationSchema);

// Mechanic Schema (dummy data)
const mechanicSchema = new mongoose.Schema({
  name: String,
  address: String,
  lat: Number,
  lng: Number,
  rating: Number,
  services: [String],
  phone: String
});
const Mechanic = mongoose.model('Mechanic', mechanicSchema);

// Encryption setup (modern)
const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(process.env.ENCRYPTION_KEY || "supersecretkey")
  .digest(); // 32-byte key for AES-256
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text.toString(), "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text) {
  const [ivHex, encryptedText] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return parseFloat(decrypted);
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Seed dummy mechanics data
async function seedMechanics() {
  const count = await Mechanic.countDocuments();
  if (count === 0) {
    const dummyMechanics = [
      {
        name: "QuickFix Auto Repair",
        address: "123 Main St, City Center",
        lat: 23.0225,
        lng: 72.5714,
        rating: 4.5,
        services: ["Oil Change", "Brake Repair", "Engine Diagnostics"],
        phone: "+91-98765-43210"
      },
      {
        name: "24/7 Emergency Garage",
        address: "456 Highway Road, Near Mall",
        lat: 23.0300,
        lng: 72.5800,
        rating: 4.2,
        services: ["Towing", "Battery Replacement", "Tire Change"],
        phone: "+91-98765-43211"
      },
      {
        name: "Pro Mechanics Hub",
        address: "789 Industrial Area, Zone 1",
        lat: 23.0150,
        lng: 72.5650,
        rating: 4.7,
        services: ["AC Repair", "Transmission", "Body Work"],
        phone: "+91-98765-43212"
      },
      {
        name: "Roadside Heroes",
        address: "321 Service Lane, Downtown",
        lat: 23.0280,
        lng: 72.5750,
        rating: 4.3,
        services: ["Emergency Repair", "Jump Start", "Lockout Service"],
        phone: "+91-98765-43213"
      }
    ];

    await Mechanic.insertMany(dummyMechanics);
    console.log('🚗 Dummy mechanics data seeded');
  }
}

// Routes
app.post('/api/location', async (req, res) => {
  try {
    const { latitude, longitude, userId } = req.body;


    if (!latitude || !longitude || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Encrypt coordinates
    const encryptedLat = encrypt(latitude);
    const encryptedLng = encrypt(longitude);

    // Save encrypted location
    const userLocation = new UserLocation({ userId, encryptedLat, encryptedLng });
    await userLocation.save();

    // Find nearby mechanics
    const mechanics = await Mechanic.find();
    const nearbyMechanics = mechanics
      .map(mechanic => ({
        ...mechanic.toObject(),
        distance: calculateDistance(latitude, longitude, mechanic.lat, mechanic.lng)
      }))
      .filter(mechanic => mechanic.distance <= 10)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);

    res.json({
      success: true,
      message: 'Location saved successfully',
      nearbyMechanics: nearbyMechanics.map(m => ({
        id: m._id,
        name: m.name,
        address: m.address,
        rating: m.rating,
        services: m.services,
        phone: m.phone,
        distance: Math.round(m.distance * 100) / 100
      }))
    });

  } catch (error) {
    console.error('❌ Error saving location:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/mechanics/nearby/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userLocation = await UserLocation.findOne({ userId }).sort({ timestamp: -1 });

    if (!userLocation) {
      return res.status(404).json({ error: 'User location not found' });
    }

    // Decrypt coordinates
    const latitude = decrypt(userLocation.encryptedLat);
    const longitude = decrypt(userLocation.encryptedLng);

    // Find nearby mechanics
    const mechanics = await Mechanic.find();
    const nearbyMechanics = mechanics
      .map(mechanic => ({
        ...mechanic.toObject(),
        distance: calculateDistance(latitude, longitude, mechanic.lat, mechanic.lng)
      }))
      .filter(mechanic => mechanic.distance <= 10)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);

    res.json({
      nearbyMechanics: nearbyMechanics.map(m => ({
        id: m._id,
        name: m.name,
        address: m.address,
        rating: m.rating,
        services: m.services,
        phone: m.phone,
        distance: Math.round(m.distance * 100) / 100
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching nearby mechanics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Initialize server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await seedMechanics();
});

export default app;
