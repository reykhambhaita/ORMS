// services/MechanicLocationService.js
// Background service for automatic mechanic location updates

import * as Location from 'expo-location';
import authService from '../screens/authService';
import { gpsEnhancer } from '../utils/EnhancedLocationServices';

const LOCATION_UPDATE_TASK = 'MECHANIC_LOCATION_UPDATE';
const UPDATE_INTERVAL = 45000; // 45 seconds (between 30-60 seconds)

class MechanicLocationService {
  constructor() {
    this.isRunning = false;
    this.updateInterval = null;
    this.lastUpdateTime = null;
    this.consecutiveErrors = 0;
    this.maxConsecutiveErrors = 5;
  }

  /**
   * Start the location update service
   * Only call this for mechanic users
   */
  async start() {
    try {
      // Check if user is a mechanic
      const isMechanic = await authService.isMechanic();
      if (!isMechanic) {
        console.log('⚠️ [MechanicLocationService] User is not a mechanic, skipping service start');
        return { success: false, error: 'User is not a mechanic' };
      }

      // Check if already running
      if (this.isRunning) {
        console.log('⚠️ [MechanicLocationService] Service already running');
        return { success: true, message: 'Service already running' };
      }

      // Request location permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.error('❌ [MechanicLocationService] Foreground location permission denied');
        return { success: false, error: 'Location permission denied' };
      }

      // Request background location permissions
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.warn('⚠️ [MechanicLocationService] Background location permission denied, will only update in foreground');
      }

      // Start the update interval
      this.isRunning = true;
      this.consecutiveErrors = 0;

      console.log('✅ [MechanicLocationService] Service started, update interval:', UPDATE_INTERVAL / 1000, 'seconds');

      // Perform initial update immediately
      await this.performLocationUpdate();

      // Set up recurring updates
      this.updateInterval = setInterval(async () => {
        await this.performLocationUpdate();
      }, UPDATE_INTERVAL);

      return { success: true, message: 'Service started successfully' };
    } catch (error) {
      console.error('❌ [MechanicLocationService] Failed to start service:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop the location update service
   */
  async stop() {
    try {
      if (!this.isRunning) {
        console.log('⚠️ [MechanicLocationService] Service not running');
        return { success: true, message: 'Service not running' };
      }

      // Clear the interval
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }

      this.isRunning = false;
      console.log('✅ [MechanicLocationService] Service stopped');

      return { success: true, message: 'Service stopped successfully' };
    } catch (error) {
      console.error('❌ [MechanicLocationService] Failed to stop service:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Perform a single location update
   */
  async performLocationUpdate() {
    try {
      console.log('📍 [MechanicLocationService] Performing location update...');

      // Get high accuracy location
      const location = await gpsEnhancer.getHighAccuracyLocation({
        maxWaitTime: 10000, // 10 seconds max
        targetAccuracy: 20 // 20 meters
      });

      if (!location) {
        throw new Error('Failed to get location');
      }

      console.log('📍 [MechanicLocationService] Location captured:', {
        lat: location.latitude,
        lng: location.longitude,
        accuracy: location.accuracy
      });

      // Send update to server
      const result = await authService.updateMechanicLocation(
        location.latitude,
        location.longitude
      );

      if (result.success) {
        this.lastUpdateTime = new Date();
        this.consecutiveErrors = 0;
        console.log('✅ [MechanicLocationService] Location updated successfully at', this.lastUpdateTime.toLocaleTimeString());
      } else {
        throw new Error(result.error || 'Failed to update location on server');
      }

      return { success: true, location };
    } catch (error) {
      this.consecutiveErrors++;
      console.error(`❌ [MechanicLocationService] Location update failed (${this.consecutiveErrors}/${this.maxConsecutiveErrors}):`, error.message);

      // Stop service if too many consecutive errors
      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        console.error('❌ [MechanicLocationService] Too many consecutive errors, stopping service');
        await this.stop();
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastUpdateTime: this.lastUpdateTime,
      consecutiveErrors: this.consecutiveErrors,
      updateInterval: UPDATE_INTERVAL
    };
  }

  /**
   * Check if service is running
   */
  isServiceRunning() {
    return this.isRunning;
  }
}

// Export singleton instance
export default new MechanicLocationService();
