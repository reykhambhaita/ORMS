// src/utils/database.js
import * as SQLite from 'expo-sqlite';

/**
 * Centralized database manager to prevent conflicts
 * when multiple components access the same database
 */
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
        timestamp INTEGER NOT NULL,
        synced INTEGER DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_mechanics_location ON mechanics(latitude, longitude);
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
}

// Export a singleton instance
const dbManager = new DatabaseManager();
export default dbManager;
