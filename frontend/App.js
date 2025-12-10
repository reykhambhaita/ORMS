// App.js
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { TamaguiProvider } from 'tamagui';
import AuthLoadingScreen from './src/screens/AuthLoading';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ReviewMechanicScreen from './src/screens/ReviewMechanicScreen';
import RoleSelectionScreen from './src/screens/RoleSelectionScreen';
import SignupScreen from './src/screens/SignupScreen';
import authService from './src/screens/authService';
import syncManager from './src/utils/SyncManager';
import config from './tamagui.config';

const Stack = createNativeStackNavigator();

export default function App() {
  const [userName, setUserName] = useState('Welcome');

  useEffect(() => {
    // Initialize SyncManager and fetch user data
    const initializeApp = async () => {
      try {
        // Wait for SyncManager to initialize (ensures network status is known)
        await syncManager.init();
        console.log('✅ SyncManager initialized');

        // Fetch user data
        const result = await authService.getCurrentUser();
        if (result.success && result.user) {
          setUserName(result.user.username || 'Welcome');
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    initializeApp();
  }, []);

  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="AuthLoading"
          screenOptions={{
            headerShown: false,
          }}
        >
          {/* Auth Loading Screen - checks if user is logged in */}
          <Stack.Screen
            name="AuthLoading"
            component={AuthLoadingScreen}
            options={{ headerShown: false }}
          />

          {/* Auth Screens */}
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="Signup"
            component={SignupScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="RoleSelection"
            component={RoleSelectionScreen}
            options={{ headerShown: false }}
          />

          {/* Main App Screens */}
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{
              headerShown: true,
              headerStyle: {
                backgroundColor: '#001f3f',
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            }}
          />

          <Stack.Screen
            name="ReviewMechanic"
            component={ReviewMechanicScreen}
            options={{
              headerShown: true,
              title: 'Rate Mechanic',
              headerStyle: {
                backgroundColor: '#001f3f',
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            }}
          />

          {/* Payment Screen */}
          <Stack.Screen
            name="Payment"
            component={PaymentScreen}
            options={{
              headerShown: true,
              title: 'Make Payment',
              headerStyle: {
                backgroundColor: '#001f3f',
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            }}
          />

          {/* Profile Screen */}
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{
              headerShown: true,
              title: 'My Profile',
              headerStyle: {
                backgroundColor: '#001f3f',
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </TamaguiProvider>
  );
}