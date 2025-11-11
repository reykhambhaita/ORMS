// backend/index.js
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import { getCurrentUser, login, signup } from './auth.js';
import { authenticateToken, optionalAuth } from './authMiddleware.js';
import {
  connectDB,
  getLandmarksNearLocation,
  getNearbyMechanics,
  getUserLocationHistory,
  updateUserLocation
} from './db.js';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    next();
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    res.status(503).json({
      error: 'Service temporarily unavailable',
      message: 'Database connection failed'
    });
  }
});
// === PUBLIC ROUTES ===

app.get('/', (req, res) => {
  res.send('Welcome to the ORMS backend API');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// === AUTH ROUTES ===

app.post('/api/auth/signup', signup);
app.post('/api/auth/login', login);
app.get('/api/auth/me', authenticateToken, getCurrentUser);

// === PROTECTED ROUTES ===

// Update user location (now automatically uses authenticated user)
app.post('/api/user/location', authenticateToken, async (req, res) => {
  try {
    const { location, landmarks } = req.body;

    if (!location?.latitude || !location?.longitude) {
      return res.status(400).json({ error: 'Missing required location fields' });
    }

    // Use req.userId from auth middleware instead of body
    const result = await updateUserLocation(req.userId, location, landmarks);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's location history
app.get('/api/user/location-history', authenticateToken, async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const history = await getUserLocationHistory(req.userId, limit);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// === PUBLIC OR OPTIONAL AUTH ROUTES ===

// Find nearby mechanics (public, but could be personalized if authenticated)
app.get('/api/mechanics/nearby', optionalAuth, async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat or lng' });
    }

    const mechanics = await getNearbyMechanics(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseInt(radius) : 5000
    );
    res.json({ success: true, data: mechanics });
  } catch (error) {
    console.error('Get mechanics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get landmarks near location (public)
app.get('/api/landmarks', async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat or lng' });
    }

    const landmarks = await getLandmarksNearLocation(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseInt(radius) : 1000
    );
    res.json({ success: true, data: landmarks });
  } catch (error) {
    console.error('Get landmarks error:', error);
    res.status(500).json({ error: error.message });
  }
});

// === SERVER ===
const PORT = process.env.PORT || 3000;

if (process.argv[1] === new URL(import.meta.url).pathname) {
  // Connect to MongoDB BEFORE starting the server
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log('✅ MongoDB connected');
        console.log(`🚀 Server running on http://localhost:${PORT}`);
      });
    })
    .catch((error) => {
      console.error('❌ Failed to connect to MongoDB:', error.message);
      console.error('Server cannot start without database connection');
      process.exit(1);
    });
}

export default app;