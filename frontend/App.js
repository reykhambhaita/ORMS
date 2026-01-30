import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { TamaguiProvider } from 'tamagui';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AuthLoadingScreen from './src/screens/AuthLoading';
import LoginScreen from './src/screens/LoginScreen';
import MainScreen from './src/screens/MainScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import ReviewMechanicScreen from './src/screens/ReviewMechanicScreen';
import RoleSelectionScreen from './src/screens/RoleSelectionScreen';
import SignupScreen from './src/screens/SignupScreen';
import authService from './src/screens/authService';
import syncManager from './src/utils/SyncManager';
import config from './tamagui.config';

const Stack = createNativeStackNavigator();

function NavigationStack() {
  const { isDark, theme } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="AuthLoading"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
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
            name="Main"
            component={MainScreen}
            options={{
              headerShown: true,
            }}
          />

          <Stack.Screen
            name="ReviewMechanic"
            component={ReviewMechanicScreen}
            options={{
              headerShown: true,
              title: 'Rate Mechanic',
              headerStyle: {
                backgroundColor: theme.card,
                shadowColor: theme.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              },
              headerTintColor: theme.text,
              headerTitleStyle: {
                fontWeight: '600',
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
                backgroundColor: theme.card,
                shadowColor: theme.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 3,
              },
              headerTintColor: theme.text,
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

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
    <TamaguiProvider config={config} defaultTheme="light">
      <ThemeProvider>
        <NavigationStack />
      </ThemeProvider>
    </TamaguiProvider>
  );
}