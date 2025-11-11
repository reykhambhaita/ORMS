// backend/controllers/landmarkController.js
import { createLandmark, getNearbyLandmarks } from '../db.js';

/**
 * Create a new landmark
 * POST /api/landmarks
 * Body: { name, description, category, latitude, longitude }
 */
export const createLandmarkHandler = async (req, res) => {
  try {
    const { name, description, category, latitude, longitude } = req.body;

    // Validation
    if (!name || !latitude || !longitude) {
      return res.status(400).json({
        error: 'Name, latitude, and longitude are required'
      });
    }

    // Validate coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        error: 'Invalid coordinates'
      });
    }

    // Validate category if provided
    const validCategories = ['restaurant', 'gas_station', 'hospital', 'parking', 'landmark', 'shop', 'other'];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }

    // Create landmark
    const landmark = await createLandmark(req.userId, {
      name,
      description,
      category: category || 'other',
      latitude,
      longitude
    });

    res.status(201).json({
      success: true,
      data: {
        id: landmark._id,
        name: landmark.name,
        description: landmark.description,
        category: landmark.category,
        location: {
          latitude: landmark.location.coordinates[1],
          longitude: landmark.location.coordinates[0]
        },
        verified: landmark.verified,
        createdAt: landmark.createdAt
      }
    });
  } catch (error) {
    console.error('Create landmark error:', error);
    res.status(500).json({ error: 'Failed to create landmark' });
  }
};

/**
 * Get landmarks near a location
 * GET /api/landmarks/nearby?lat=23.0225&lng=70.77&radius=5000&category=restaurant
 */
export const getNearbyLandmarksHandler = async (req, res) => {
  try {
    const { lat, lng, radius, category } = req.query;

    // Validation
    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Latitude and longitude are required'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        error: 'Invalid coordinates'
      });
    }

    const searchRadius = radius ? parseInt(radius) : 5000; // Default 5km
    const landmarks = await getNearbyLandmarks(
      latitude,
      longitude,
      searchRadius,
      category || null
    );

    // Transform response to more readable format
    const transformedLandmarks = landmarks.map(landmark => ({
      id: landmark._id,
      name: landmark.name,
      description: landmark.description,
      category: landmark.category,
      location: {
        latitude: landmark.location.coordinates[1],
        longitude: landmark.location.coordinates[0]
      },
      verified: landmark.verified,
      createdBy: landmark.userId?.username || 'Unknown',
      createdAt: landmark.createdAt
    }));

    res.json({
      success: true,
      count: transformedLandmarks.length,
      data: transformedLandmarks
    });
  } catch (error) {
    console.error('Get nearby landmarks error:', error);
    res.status(500).json({ error: 'Failed to get landmarks' });
  }
};