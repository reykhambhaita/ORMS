// backend/index.js
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import {
  getLandmarksNearLocation,
  getNearbyMechanics,
  updateUserLocation
} from './db';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// === ROUTES ===

app.get('/', (req, res) => {
  res.send('Welcome to the ORMS backend API');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Protected routes - require authentication
app.post('/api/user/location', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const userId = req.auth.userId; // Get userId from Clerk auth
    const { location, landmarks } = req.body;

    if (!location?.latitude || !location?.longitude) {
      return res.status(400).json({ error: 'Missing location data' });
    }

    const result = await updateUserLocation(userId, location, landmarks || []);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/mechanics/nearby', ClerkExpressRequireAuth(), async (req, res) => {
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
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/landmarks', ClerkExpressRequireAuth(), async (req, res) => {
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
    res.status(500).json({ error: error.message });
  }
});

// === SERVER ===
const PORT = process.env.PORT || 3000;

if (process.argv[1] === new URL(import.meta.url).pathname) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

export default app;