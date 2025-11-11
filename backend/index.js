// backend/index.js
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import { getCurrentUser, login, signup } from './auth.js';
import { authenticateToken, optionalAuth, requireMechanic } from './authMiddleware.js';
import {
  createLandmarkHandler,
  getNearbyLandmarksHandler
} from './controllers/landmarkController.js';
import {
  createMechanicProfileHandler,
  getMechanicProfileHandler,
  getNearbyMechanicsHandler,
  updateMechanicAvailabilityHandler,
  updateMechanicLocationHandler
} from './controllers/mechanicController.js';
import {
  connectDB,
  getLandmarksNearLocation,
  getUserLocationHistory,
  updateUserLocation
} from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Database connection middleware
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
  res.json({
    message: 'ORMS Backend API',
    version: '2.0',
    endpoints: {
      auth: '/api/auth/*',
      landmarks: '/api/landmarks/*',
      mechanics: '/api/mechanics/*',
      user: '/api/user/*'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// === AUTH ROUTES ===

app.post('/api/auth/signup', signup);
app.post('/api/auth/login', login);
app.get('/api/auth/me', authenticateToken, getCurrentUser);

// === USER LOCATION ROUTES (Protected) ===

// Update user location (authenticated users)
app.post('/api/user/location', authenticateToken, async (req, res) => {
  try {
    const { location, landmarks } = req.body;

    if (!location?.latitude || !location?.longitude) {
      return res.status(400).json({ error: 'Missing required location fields' });
    }

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

// === LANDMARK ROUTES ===

// Create a new landmark (authenticated users)
app.post('/api/landmarks', authenticateToken, createLandmarkHandler);

// Get nearby landmarks (public with optional auth)
app.get('/api/landmarks/nearby', optionalAuth, getNearbyLandmarksHandler);

// Get landmarks near location (legacy endpoint - kept for compatibility)
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

// === MECHANIC ROUTES ===

// Create mechanic profile (mechanic role required)
app.post(
  '/api/mechanics/profile',
  authenticateToken,
  requireMechanic,
  createMechanicProfileHandler
);

// Get own mechanic profile
app.get(
  '/api/mechanics/profile',
  authenticateToken,
  requireMechanic,
  getMechanicProfileHandler
);

// Update mechanic location
app.patch(
  '/api/mechanics/location',
  authenticateToken,
  requireMechanic,
  updateMechanicLocationHandler
);

// Update mechanic availability
app.patch(
  '/api/mechanics/availability',
  authenticateToken,
  requireMechanic,
  updateMechanicAvailabilityHandler
);

// Get nearby mechanics (public with optional auth)
app.get('/api/mechanics/nearby', optionalAuth, getNearbyMechanicsHandler);

// === ERROR HANDLING ===

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// === SERVER STARTUP ===
const PORT = process.env.PORT || 3000;

if (process.argv[1] === new URL(import.meta.url).pathname) {
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log('✅ MongoDB connected');
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      });
    })
    .catch((error) => {
      console.error('❌ Failed to connect to MongoDB:', error.message);
      console.error('Server cannot start without database connection');
      process.exit(1);
    });
}

export default app;