// src/screens/RoleSelectionScreen.jsx
import { RussoOne_400Regular, useFonts } from '@expo-google-fonts/russo-one';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import authService from './authService';

const RoleSelectionScreen = ({ navigation, route }) => {
  const [fontsLoaded] = useFonts({
    RussoOne_400Regular,
  });

  // Get user data from previous screen
  const { email, username } = route.params;

  const [role, setRole] = useState('user');
  const [loading, setLoading] = useState(false);

  if (!fontsLoaded) {
    return null;
  }

  const handleContinue = async () => {
    if (role === 'mechanic') {
      // Navigate to detailed mechanic screen
      navigation.navigate('MechanicDetail', { email, username });
      return;
    }

    setLoading(true);
    const result = await authService.updateProfile({ role: 'user' });
    setLoading(false);

    if (result.success) {
      navigation.replace('Main');
    } else {
      Alert.alert('Selection Failed', result.error);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Animated.View
            entering={FadeInDown.duration(1000).springify().damping(12)}
            style={styles.logoContainer}
          >
            <Image
              source={require('../../assets/finallogo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Form Section */}
        <Animated.View
          entering={FadeInUp.duration(1000).delay(200).springify().damping(12)}
          style={styles.formSection}
        >
          <View style={styles.formContent}>
            <Text style={styles.instructionText}>
              Select how you would like to use Orb.
            </Text>

            {/* Role Selection Avatars */}
            <View style={styles.avatarGrid}>
              <TouchableOpacity
                style={[
                  styles.avatarWrapper,
                  role !== 'user' && { opacity: 0.5 }
                ]}
                onPress={() => setRole('user')}
                activeOpacity={0.8}
              >
                <View style={[styles.avatarCircle, role === 'user' && styles.avatarCircleActive]}>
                  <Ionicons name="person" size={40} color={role === 'user' ? '#ffffff' : '#111111'} />
                </View>
                <Text style={[styles.avatarLabel, role === 'user' && styles.avatarLabelActive]}>USER</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.avatarWrapper,
                  role !== 'mechanic' && { opacity: 0.5 }
                ]}
                onPress={() => setRole('mechanic')}
                activeOpacity={0.8}
              >
                <View style={[styles.avatarCircle, role === 'mechanic' && styles.avatarCircleActive]}>
                  <Ionicons name="build" size={40} color={role === 'mechanic' ? '#ffffff' : '#111111'} />
                </View>
                <Text style={[styles.avatarLabel, role === 'mechanic' && styles.avatarLabelActive]}>MECHANIC</Text>
              </TouchableOpacity>
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              onPress={handleContinue}
              disabled={loading}
              style={styles.continueButton}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.continueButtonText}>continue</Text>
              )}
            </TouchableOpacity>
          </View>


          {/* Back to Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>
              Already have an account?{' '}
              <Text
                style={styles.loginLink}
                onPress={() => navigation.navigate('Login')}
              >
                Login
              </Text>
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerSection: {
    height: '30%',
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  logoImage: {
    width: '100%',
    height: 120,
  },
  formSection: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 32,
    paddingTop: 10,
    paddingBottom: 60,
  },
  formContent: {
    flex: 1,
  },
  instructionText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 48,
    textAlign: 'center',
    lineHeight: 24,
  },
  avatarGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 64,
  },
  avatarWrapper: {
    alignItems: 'center',
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  avatarCircleActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  avatarLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 1,
  },
  avatarLabelActive: {
    color: '#000000',
  },
  continueButton: {
    backgroundColor: '#000000',
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  loginContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  loginText: {
    fontSize: 14,
    color: '#888888',
  },
  loginLink: {
    color: '#111111',
    fontWeight: '700',
  },
});

export default RoleSelectionScreen;