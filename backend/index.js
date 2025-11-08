// backend/index.js - Alternative approach using Clerk REST API
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import {
  getLandmarksNearLocation,
  getNearbyMechanics,
  updateUserLocation
} from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// === CLERK AUTHENTICATION MIDDLEWARE (REST API Method) ===
const authenticateClerkToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No authorization header');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    if (!process.env.CLERK_SECRET_KEY) {
      console.error('❌ CLERK_SECRET_KEY not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
      // Verify token using Clerk's REST API
      const response = await fetch('https://api.clerk.com/v1/sessions/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Clerk verification failed:', response.status, errorText);
        return res.status(401).json({ error: 'Invalid token' });
      }

      const session = await response.json();
      req.userId = session.user_id;
      console.log('✅ Authenticated user:', req.userId);
      next();
    } catch (verifyError) {
      console.error('❌ Token verification error:', verifyError);
      return res.status(401).json({ error: 'Token verification failed' });
    }
  } catch (error) {
    console.error('❌ Auth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// === ROUTES ===

app.get('/', (req, res) => {
  res.json({ 
    message: 'ORMS Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      location: 'POST /api/user/location',
      mechanics: 'GET /api/mechanics/nearby',
      landmarks: 'GET /api/landmarks'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    clerkConfigured: !!process.env.CLERK_SECRET_KEY,
    mongoConfigured: !!process.env.MONGODB_URI,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Protected route - Update user location
app.post('/api/user/location', authenticateClerkToken, async (req, res) => {
  try {
    const { location, landmarks } = req.body;
    const userId = req.userId;
    
    console.log('📍 Location update:', { userId, lat: location?.latitude, lng: location?.longitude });
    
    if (!location?.latitude || !location?.longitude) {
      return res.status(400).json({ error: 'Missing location data' });
    }

    const result = await updateUserLocation(userId, location, landmarks || []);
    console.log('✅ Location saved');
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Location update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Protected route - Get nearby mechanics
app.get('/api/mechanics/nearby', authenticateClerkToken, async (req, res) => {
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
    console.error('❌ Mechanics query error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Protected route - Get nearby landmarks
app.get('/api/landmarks', authenticateClerkToken, async (req, res) => {
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
    console.error('❌ Landmarks query error:', error);
    res.status(500).json({ error: error.message });
  }
});

// === ERROR HANDLING ===
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// === SERVER ===
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔑 Clerk: ${process.env.CLERK_SECRET_KEY ? 'Configured ✅' : 'Missing ❌'}`);
  console.log(`🗄️  MongoDB: ${process.env.MONGODB_URI ? 'Configured ✅' : 'Missing ❌'}`);
});

export default app;
