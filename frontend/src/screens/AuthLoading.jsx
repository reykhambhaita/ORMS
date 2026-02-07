// src/screens/AuthLoadingScreen.jsx
import { RussoOne_400Regular, useFonts } from '@expo-google-fonts/russo-one';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import authService from './authService';

const AuthLoadingScreen = ({ navigation }) => {
  const [fontsLoaded] = useFonts({
    RussoOne_400Regular,
  });

  const [statusMessage, setStatusMessage] = useState('Initializing...');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setStatusMessage('Checking authentication...');

      // Initialize auth service
      await authService.initialize();

      // Check if user is authenticated (has token)
      const isAuthenticated = await authService.isAuthenticated();

      if (isAuthenticated) {
        setStatusMessage('Verifying credentials...');

        // Verify token is still valid by fetching current user
        const result = await authService.getCurrentUser();

        if (result.success) {
          // User is authenticated (either online or offline with cached data)
          if (result.offline) {
            console.log('Offline mode: Using cached user data');
            setStatusMessage('Offline mode - Using cached data');
          } else {
            console.log('User authenticated:', result.user);
            setStatusMessage('Authentication successful!');
          }

          // Small delay to show success message
          setTimeout(() => {
            navigation.replace('Main');
          }, 100);
        } else {
          // Token is invalid or expired, go to login
          console.log('Token invalid, redirecting to login');
          setStatusMessage('Session expired');
          setTimeout(() => {
            navigation.replace('GetStarted');
          }, 100);
        }
      } else {
        // Not authenticated, go to login
        console.log('Not authenticated, redirecting to login');
        setStatusMessage('Please log in');
        setTimeout(() => {
          navigation.replace('GetStarted');
        }, 100);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setStatusMessage('Error checking authentication');

      // On error, try to use cached credentials if available
      try {
        const isAuthenticated = await authService.isAuthenticated();
        if (isAuthenticated) {
          console.log('Network error, but user has cached credentials');
          setStatusMessage('Offline mode - Using cached data');
          setTimeout(() => {
            navigation.replace('Main');
          }, 100);
          return;
        }
      } catch (cacheError) {
        console.error('Cache check error:', cacheError);
      }

      // If no cached credentials, go to login
      setTimeout(() => {
        navigation.replace('GetStarted');
      }, 100);
    }
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>Orb</Text>
      </View>

      {/* Loading Indicator */}
      <ActivityIndicator size="large" color="#111111" style={styles.loader} />

      {/* Status Message */}
      <Text style={styles.statusText}>{statusMessage}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  logoContainer: {
    marginBottom: 40,
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 48,
    fontFamily: 'RussoOne_400Regular',
    letterSpacing: 2,
    color: '#111111',
    alignSelf: 'center',
  },
  loader: {
    marginVertical: 20,
  },
  statusText: {
    fontSize: 14,
    color: '#888888',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default AuthLoadingScreen;