// src/services/authService.js
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'https://backend-three-sepia-16.vercel.app';
const TOKEN_KEY = 'orms_auth_token';
const USER_KEY = 'orms_user_data';

class AuthService {
  constructor() {
    this.token = null;
    this.user = null;
    this.initialized = false;
  }

  // Initialize auth state from secure storage
  async initialize() {
    if (this.initialized) return;

    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userData = await SecureStore.getItemAsync(USER_KEY);

      if (token && userData) {
        this.token = token;
        this.user = JSON.parse(userData);
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      this.initialized = true;
    }
  }

  // Sign up new user
  async signup(email, username, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      // Store token and user data
      await this.storeAuthData(data.token, data.user);

      return { success: true, user: data.user };
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: error.message };
    }
  }

  // Login existing user
  async login(email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token and user data
      await this.storeAuthData(data.token, data.user);

      return { success: true, user: data.user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }

  // Logout user
  async logout() {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
      this.token = null;
      this.user = null;
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get current user from backend
  async getCurrentUser() {
    try {
      await this.initialize();

      if (!this.token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // Token is invalid or expired
        if (data.code === 'INVALID_TOKEN' || data.code === 'NO_TOKEN') {
          await this.logout();
        }
        throw new Error(data.error || 'Failed to get user');
      }

      // Update stored user data
      this.user = data.user;
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user));

      return { success: true, user: data.user };
    } catch (error) {
      console.error('Get current user error:', error);
      return { success: false, error: error.message };
    }
  }

  // Check if user is authenticated
  async isAuthenticated() {
    await this.initialize();
    return !!this.token;
  }

  // Get stored token
  async getToken() {
    await this.initialize();
    return this.token;
  }

  // Get stored user
  async getUser() {
    await this.initialize();
    return this.user;
  }

  // Store auth data securely
  async storeAuthData(token, user) {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      this.token = token;
      this.user = user;
    } catch (error) {
      console.error('Failed to store auth data:', error);
      throw error;
    }
  }

  // Make authenticated API request
  async authenticatedRequest(endpoint, options = {}) {
    try {
      await this.initialize();

      if (!this.token) {
        throw new Error('Not authenticated');
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers,
      };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      // Handle token expiration
      if (!response.ok && (data.code === 'INVALID_TOKEN' || data.code === 'NO_TOKEN')) {
        await this.logout();
        throw new Error('Session expired. Please login again.');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return { success: true, data };
    } catch (error) {
      console.error('Authenticated request error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export default new AuthService();