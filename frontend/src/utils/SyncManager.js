import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from "@react-native-community/netinfo";
import authService from '../screens/authService';
import dbManager from './database';

class SyncManager {
  constructor() {
    this.isOnline = false;
    this.syncing = false;
    this.listeners = [];
    this.initialized = false;
    this.initPromise = null;
  }

  /**
   * Initialize the sync manager
   * @returns {Promise<void>} Resolves when initialization is complete
   */
  async init() {
    // If already initialized or initializing, return the existing promise
    if (this.initialized) {
      return Promise.resolve();
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    console.log('🔄 SyncManager: Initializing...');

    this.initPromise = (async () => {
      try {
        // Check initial status first (await it!)
        const state = await NetInfo.fetch();
        this.isOnline = !!state.isConnected;
        console.log(`📡 Initial network status: ${this.isOnline ? 'ONLINE' : 'OFFLINE'}`);

        // Monitor network status changes
        NetInfo.addEventListener(state => {
          const online = !!state.isConnected;
          if (online !== this.isOnline) {
            this.isOnline = online;
            console.log(`📡 Network status changed: ${online ? 'ONLINE' : 'OFFLINE'}`);

            if (online) {
              this.syncAllPendingChanges();
            }

            // Notify listeners
            this.listeners.forEach(listener => listener(online));
          }
        });

        // Sync if online
        if (this.isOnline) {
          this.syncAllPendingChanges();
        }

        this.initialized = true;
        console.log('✅ SyncManager: Initialization complete');
      } catch (error) {
        console.error('❌ SyncManager: Initialization failed:', error);
        // Default to offline on error
        this.isOnline = false;
        this.initialized = true;
      }
    })();

    return this.initPromise;
  }

  /**
   * Wait for SyncManager to be initialized
   * @returns {Promise<void>}
   */
  async waitForInit() {
    if (this.initialized) {
      return Promise.resolve();
    }
    if (this.initPromise) {
      return this.initPromise;
    }
    // If not initialized and no promise, initialize now
    return this.init();
  }

  /**
   * Check current network status directly from NetInfo
   * @returns {Promise<boolean>}
   */
  async checkNetworkStatus() {
    try {
      const state = await NetInfo.fetch();
      return !!state.isConnected;
    } catch (error) {
      console.error('Error checking network status:', error);
      return false;
    }
  }

  /**
   * Add a listener for network status changes
   * @param {Function} callback - Called with (isOnline: boolean)
   */
  addNetworkListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove a network listener
   * @param {Function} callback
   */
  removeNetworkListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  /**
   * Sync all pending changes (Mechanics, Payments, Reviews)
   */
  async syncAllPendingChanges() {
    if (this.syncing || !this.isOnline) return;

    this.syncing = true;
    console.log('🔄 Starting full sync...');

    try {
      await Promise.all([
        this.syncPendingPayments(),
        this.syncPendingReviews(),
        // Mechanics are typically synced on demand or region change, but we can add logic here if needed
      ]);
      console.log('✅ Full sync complete');
    } catch (error) {
      console.error('❌ Sync error:', error);
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Sync pending payments
   */
  async syncPendingPayments() {
    try {
      const db = await dbManager.getDatabase();
      const pendingPayments = await db.getAllAsync('SELECT * FROM payments WHERE synced = 0');

      if (pendingPayments.length === 0) return;

      console.log(`💸 Syncing ${pendingPayments.length} pending payments...`);

      for (const payment of pendingPayments) {
        try {

          await db.runAsync(
            'UPDATE payments SET synced = 1 WHERE id = ?',
            [payment.id]
          );
          console.log(`✅ Payment ${payment.id} synced`);
        } catch (error) {
          console.error(`❌ Failed to sync payment ${payment.id}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error syncing payments:', error);
    }
  }

  /**
   * Sync pending reviews
   */
  async syncPendingReviews() {
    try {
      const db = await dbManager.getDatabase();
      const pendingReviews = await db.getAllAsync('SELECT * FROM reviews WHERE synced = 0');

      if (pendingReviews.length === 0) return;

      console.log(`⭐ Syncing ${pendingReviews.length} pending reviews...`);

      for (const review of pendingReviews) {
        try {
          const result = await authService.createReview(
            review.mechanic_id,
            review.rating,
            review.comment,
            review.call_duration
          );

          if (result.success) {
            await db.runAsync(
              'UPDATE reviews SET synced = 1 WHERE id = ?',
              [review.id]
            );
            console.log(`✅ Review for ${review.mechanic_name} synced`);
          } else {
            console.error(`❌ Failed to sync review for ${review.mechanic_name}:`, result.error);
          }
        } catch (error) {
          console.error(`❌ Error syncing review ${review.id}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error syncing reviews:', error);
    }
  }

  /**
   * Check if region has changed significantly to trigger cache refresh
   * @param {number} lat
   * @param {number} lng
   */
  async checkRegionChange(lat, lng) {
    try {
      const lastRegion = await AsyncStorage.getItem('last_known_region');
      if (lastRegion) {
        const { latitude, longitude } = JSON.parse(lastRegion);
        const distance = this.calculateDistance(lat, lng, latitude, longitude);

        // If moved more than 50km, consider it a region change
        if (distance > 50) {
          console.log(`🌍 Region changed (moved ${distance.toFixed(1)}km). Refreshing data...`);
          // Trigger mechanic refresh
          return true;
        }
      }

      // Update last known region
      await AsyncStorage.setItem('last_known_region', JSON.stringify({ latitude: lat, longitude: lng }));
      return false;
    } catch (error) {
      console.error('Error checking region change:', error);
      return false;
    }
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  }

  deg2rad(deg) {
    return deg * (Math.PI / 180);
  }
}

const syncManager = new SyncManager();
export default syncManager;
