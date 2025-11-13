// backend/controllers/landmarkController.js
import axios from 'axios';
import { createLandmark, getNearbyLandmarks, Landmark } from '../db.js';

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

/**
 * Sync OpenStreetMap places to database
 * POST /api/landmarks/sync-osm
 * Body: { latitude, longitude, radius }
 */
export const syncOpenStreetMapHandler = async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude are required'
      });
    }

    const searchRadius = radius || 5000; // Default 5km
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    // Category mapping: OpenStreetMap -> Our categories
    const categoryMapping = {
      'restaurant': 'restaurant',
      'cafe': 'restaurant',
      'fast_food': 'restaurant',
      'fuel': 'gas_station',
      'hospital': 'hospital',
      'clinic': 'hospital',
      'doctors': 'hospital',
      'pharmacy': 'hospital',
      'parking': 'parking',
      'monument': 'landmark',
      'memorial': 'landmark',
      'attraction': 'landmark',
      'viewpoint': 'landmark',
      'shop': 'shop',
      'supermarket': 'shop',
      'mall': 'shop',
      'convenience': 'shop'
    };

    // Overpass API query to get POIs
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"](around:${searchRadius},${lat},${lng});
        node["tourism"](around:${searchRadius},${lat},${lng});
        node["shop"](around:${searchRadius},${lat},${lng});
      );
      out body;
    `;

    console.log('🌍 Fetching from OpenStreetMap...');

    const response = await axios.post(
      'https://overpass-api.de/api/interpreter',
      overpassQuery,
      {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 30000
      }
    );

    const elements = response.data.elements || [];
    console.log(`📍 Found ${elements.length} places from OSM`);

    let synced = 0;
    let duplicate = 0;
    let failed = 0;

    for (const element of elements) {
      try {
        // Skip if no name
        if (!element.tags?.name) {
          failed++;
          continue;
        }

        const osmCategory = element.tags.amenity || element.tags.tourism || element.tags.shop;
        const ourCategory = categoryMapping[osmCategory] || 'other';

        // Check if landmark already exists (by name and approximate location)
        const existing = await Landmark.findOne({
          name: element.tags.name,
          'location.coordinates': {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [element.lon, element.lat]
              },
              $maxDistance: 50 // 50 meters tolerance
            }
          }
        });

        if (existing) {
          duplicate++;
          continue;
        }

        // Create new landmark
        await createLandmark(req.userId, {
          name: element.tags.name,
          description: element.tags.description || `${osmCategory || 'Place'} from OpenStreetMap`,
          category: ourCategory,
          latitude: element.lat,
          longitude: element.lon
        });

        synced++;
      } catch (error) {
        console.error(`Failed to sync place ${element.tags?.name}:`, error.message);
        failed++;
      }
    }

    console.log(`✅ Sync complete: ${synced} synced, ${duplicate} duplicates, ${failed} failed`);

    res.json({
      success: true,
      synced,
      duplicate,
      failed,
      total: elements.length
    });
  } catch (error) {
    console.error('OpenStreetMap sync error:', error);

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return res.status(504).json({
        error: 'Request to OpenStreetMap timed out. Try a smaller radius.'
      });
    }

    res.status(500).json({
      error: 'Failed to sync with OpenStreetMap',
      details: error.message
    });
  }
};