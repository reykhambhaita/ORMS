// src/utils/database.js
import * as SQLite from 'expo-sqlite';


class DatabaseManager {
  constructor() {
    this.db = null;
    this.initPromise = null;
    this.initializing = false;
  }

  /**
   * Get or initialize the database connection
   * @returns {Promise<SQLite.SQLiteDatabase>}
   */
  async getDatabase() {
    // If already initialized, return it
    if (this.db) {
      return this.db;
    }

    // If currently initializing, wait for that to complete
    if (this.initializing && this.initPromise) {
      await this.initPromise;
      return this.db;
    }

    // Initialize the database
    this.initializing = true;
    this.initPromise = this._initializeDatabase();

    try {
      await this.initPromise;
      return this.db;
    } finally {
      this.initializing = false;
      this.initPromise = null;
    }
  }

  /**
   * Internal method to initialize the database
   * @private
   */
  async _initializeDatabase() {
    try {
      console.log('🗄️ Opening database connection...');

      // Open database using async API (most modern and stable)
      this.db = await SQLite.openDatabaseAsync('locationtracker.db');

      if (!this.db) {
        throw new Error('Failed to open database - returned null');
      }

      console.log('✅ Database connection established');

      // Create all tables
      await this._createTables();

      console.log('✅ Database fully initialized');

      return this.db;
    } catch (error) {
      console.error('💥 Database initialization failed:', error);
      this.db = null;
      throw error;
    }
  }

  /**
   * Create all required tables
   * @private
   */
  async _createTables() {
    // Locations table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy REAL,
        timestamp INTEGER NOT NULL,
        synced INTEGER DEFAULT 0,
        sources TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_synced ON locations(synced);
    `);

    // Landmarks table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS landmarks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        synced INTEGER DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_landmarks_location ON landmarks(latitude, longitude);
      CREATE INDEX IF NOT EXISTS idx_landmarks_timestamp ON landmarks(timestamp);
    `);

    // Mechanics table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS mechanics (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        specialties TEXT,
        rating REAL,
        available INTEGER,
        upiId TEXT,
        upiQrCode TEXT,
        timestamp INTEGER NOT NULL,
        synced INTEGER DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_mechanics_location ON mechanics(latitude, longitude);
    `);

    // Migration: Ensure upiId and upiQrCode columns exist for users with older versions
    try {
      const tableInfo = await this.db.getAllAsync("PRAGMA table_info(mechanics)");
      const hasUpiId = tableInfo.some(col => col.name === 'upiId');
      const hasUpiQrCode = tableInfo.some(col => col.name === 'upiQrCode');

      if (!hasUpiId) {
        console.log('🔄 Migrating: Adding upiId column to mechanics table');
        await this.db.execAsync("ALTER TABLE mechanics ADD COLUMN upiId TEXT;");
      }
      if (!hasUpiQrCode) {
        console.log('🔄 Migrating: Adding upiQrCode column to mechanics table');
        await this.db.execAsync("ALTER TABLE mechanics ADD COLUMN upiQrCode TEXT;");
      }
    } catch (migrationError) {
      console.error('⚠️ Database migration warning (mechanics table):', migrationError);
    }

    // Payments table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        mechanic_id TEXT NOT NULL,
        mechanic_name TEXT,
        amount REAL NOT NULL,
        description TEXT,
        status TEXT,
        timestamp INTEGER NOT NULL,
        synced INTEGER DEFAULT 0,
        provider_ref TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_payments_timestamp ON payments(timestamp);
      CREATE INDEX IF NOT EXISTS idx_payments_synced ON payments(synced);
    `);

    // Reviews table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        mechanic_id TEXT NOT NULL,
        mechanic_name TEXT,
        rating INTEGER NOT NULL,
        comment TEXT,
        call_duration INTEGER,
        timestamp INTEGER NOT NULL,
        synced INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_reviews_timestamp ON reviews(timestamp);
      CREATE INDEX IF NOT EXISTS idx_reviews_synced ON reviews(synced);
    `);

    // Verified addresses table for user feedback
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS verified_addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        address TEXT NOT NULL,
        verified_count INTEGER DEFAULT 1,
        last_verified INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_verified_location ON verified_addresses(latitude, longitude);
    `);

    console.log('✅ All tables created successfully');
  }

  /**
   * Close the database connection
   */
  async closeDatabase() {
    if (this.db) {
      try {
        await this.db.closeAsync();
        console.log('🔒 Database connection closed');
      } catch (error) {
        console.error('Error closing database:', error);
      } finally {
        this.db = null;
      }
    }
  }

  /**
   * Reset the database (for testing/debugging)
   */
  async resetDatabase() {
    await this.closeDatabase();
    this.db = null;
    this.initPromise = null;
    this.initializing = false;
  }

  /**
   * Save mechanic profile to local database
   * @param {Object} mechanicProfile - Mechanic profile data
   */
  async saveMechanicProfile(mechanicProfile) {
    try {
      const db = await this.getDatabase();

      await db.runAsync(
        `INSERT OR REPLACE INTO mechanics
        (id, name, phone, latitude, longitude, specialties, rating, available, upiId, upiQrCode, timestamp, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          mechanicProfile.id || 'local',
          mechanicProfile.name,
          mechanicProfile.phone,
          mechanicProfile.location?.latitude || 0,
          mechanicProfile.location?.longitude || 0,
          JSON.stringify(mechanicProfile.specialties || []),
          mechanicProfile.rating || 0,
          mechanicProfile.available ? 1 : 0,
          mechanicProfile.upiId || null,
          mechanicProfile.upiQrCode || null,
          Date.now(),
          1
        ]
      );

      console.log('✅ Mechanic profile saved to local DB');
    } catch (error) {
      console.error('Error saving mechanic profile:', error);
      throw error;
    }
  }

  /**
   * Get mechanic profile from local database
   * @param {string} mechanicId - Mechanic ID (optional, defaults to 'local')
   * @returns {Promise<Object|null>} Mechanic profile or null
   */
  async getMechanicProfile(mechanicId = 'local') {
    try {
      const db = await this.getDatabase();

      const result = await db.getFirstAsync(
        'SELECT * FROM mechanics WHERE id = ? LIMIT 1',
        [mechanicId]
      );

      if (!result) {
        return null;
      }

      return {
        id: result.id,
        name: result.name,
        phone: result.phone,
        location: {
          latitude: result.latitude,
          longitude: result.longitude
        },
        specialties: JSON.parse(result.specialties || '[]'),
        rating: result.rating,
        available: result.available === 1,
        upiId: result.upiId,
        upiQrCode: result.upiQrCode,
        timestamp: result.timestamp
      };
    } catch (error) {
      console.error('Error getting mechanic profile:', error);
      return null;
    }
  }
}

// Export a singleton instance
const dbManager = new DatabaseManager();
export default dbManager;
