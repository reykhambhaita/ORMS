import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AuthLoadingScreen from './src/screens/AuthLoading';
import authService from './src/screens/authService';
import EditProfileScreen from './src/screens/EditProfileScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import GetStartedScreen from './src/screens/GetStartedScreen';
import LoginScreen from './src/screens/LoginScreen';
import MainScreen from './src/screens/MainScreen';
import MechanicDetailScreen from './src/screens/MechanicDetailScreen';
import OTPScreen from './src/screens/OTPScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import PermissionsScreen from './src/screens/PermissionsScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import ReviewMechanicScreen from './src/screens/ReviewMechanicScreen';
import RoleSelectionScreen from './src/screens/RoleSelectionScreen';
import SignupScreen from './src/screens/SignupScreen';
import syncManager from './src/utils/SyncManager';
import config from './tamagui.config';

const PERSISTENCE_KEY = 'NAVIGATION_STATE_V1';

const Stack = createNativeStackNavigator();

function NavigationStack({ initialRoute, initialState }) {
  const { isDark, theme } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer
        initialState={initialState}
        onStateChange={(state) =>
          AsyncStorage.setItem(PERSISTENCE_KEY, JSON.stringify(state))
        }
      >
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
            animation: 'fade',
          }}
        >
          {/* Auth Loading Screen - checks if user is logged in */}
          <Stack.Screen
            name="AuthLoading"
            component={AuthLoadingScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="GetStarted"
            component={GetStartedScreen}
            options={{ headerShown: false }}
          />

          {/* Auth Screens */}
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{
              headerShown: false,
              animation: 'fade'
            }}
          />

          <Stack.Screen
            name="Signup"
            component={SignupScreen}
            options={{
              headerShown: false,
              animation: 'fade'
            }}
          />

          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{
              headerShown: false,
              animation: 'fade'
            }}
          />

          <Stack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            options={{
              headerShown: false,
              animation: 'fade'
            }}
          />

          <Stack.Screen
            name="OTP"
            component={OTPScreen}
            options={{
              headerShown: false,
              animation: 'fade'
            }}
          />

          <Stack.Screen
            name="RoleSelection"
            component={RoleSelectionScreen}
            options={{
              headerShown: false,
              animation: 'fade'
            }}
          />

          <Stack.Screen
            name="MechanicDetail"
            component={MechanicDetailScreen}
            options={{
              headerShown: false,
              animation: 'slide_from_right'
            }}
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
          <Stack.Screen
            name="Permissions"
            component={PermissionsScreen}
            options={{
              headerShown: true,
            }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{
              headerShown: true,
              animation: 'slide_from_right'
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState('GetStarted');
  const [initialState, setInitialState] = useState();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load navigation state
        const savedStateString = await AsyncStorage.getItem(PERSISTENCE_KEY);
        const state = savedStateString ? JSON.parse(savedStateString) : undefined;
        if (state !== undefined) {
          setInitialState(state);
        }

        // Initialize SyncManager and Auth
        await syncManager.init();
        await authService.initialize();

        const authenticated = await authService.isAuthenticated();
        if (authenticated) {
          setInitialRoute('Main');
        } else {
          setInitialRoute('GetStarted');
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        setIsReady(true);
      }
    };

    initializeApp();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        syncManager.syncAllPendingChanges();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!isReady) {
    return null; // Or a very minimal splash if desired, but request asked for direct start
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={config} defaultTheme="light">
        <ThemeProvider>
          <SafeAreaProvider>
            <NavigationStack initialRoute={initialRoute} initialState={initialState} />
          </SafeAreaProvider>
        </ThemeProvider>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}