// src/screens/AuthLoadingScreen.jsx
import { RussoOne_400Regular, useFonts } from '@expo-google-fonts/russo-one';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
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
            navigation.replace('Home');
          }, 1500);
        } else {
          // Token is invalid or expired, go to login
          console.log('Token invalid, redirecting to login');
          setStatusMessage('Session expired');
          setTimeout(() => {
            navigation.replace('Login');
          }, 1500);
        }
      } else {
        // Not authenticated, go to login
        console.log('Not authenticated, redirecting to login');
        setStatusMessage('Please log in');
        setTimeout(() => {
          navigation.replace('Login');
        }, 1500);
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
            navigation.replace('Home');
          }, 1500);
          return;
        }
      } catch (cacheError) {
        console.error('Cache check error:', cacheError);
      }

      // If no cached credentials, go to login
      setTimeout(() => {
        navigation.replace('Login');
      }, 1500);
    }
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <LinearGradient
      colors={['#003355', '#001122']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Logo with split-color effect */}
      <View style={styles.logoContainer}>
        <MaskedView
          maskElement={
            <Text style={styles.logoText}>rexGO</Text>
          }
        >
          <LinearGradient
            colors={['#ffffff', '#ffffff', '#00BFFF', '#00BFFF']}
            locations={[0, 0.50, 0.50, 1]}
            style={styles.logoGradient}
          />
        </MaskedView>
      </View>

      {/* Loading Indicator */}
      <ActivityIndicator size="large" color="#ffffff" style={styles.loader} />

      {/* Status Message */}
      <Text style={styles.statusText}>{statusMessage}</Text>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 40,
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 48,
    fontFamily: 'RussoOne_400Regular',
    letterSpacing: 1,
    alignSelf: 'center',
  },
  logoGradient: {
    height: 60,
    width: 200,
  },
  loader: {
    marginVertical: 20,
  },
  statusText: {
    fontSize: 14,
    color: '#ffffff',
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 40,
    opacity: 0.8,
  },
});

export default AuthLoadingScreen;