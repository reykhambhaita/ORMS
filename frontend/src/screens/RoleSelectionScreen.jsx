// src/screens/RoleSelectionScreen.jsx
import { RussoOne_400Regular, useFonts } from '@expo-google-fonts/russo-one';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import authService from './authService';

const RoleSelectionScreen = ({ navigation, route }) => {
  const [fontsLoaded] = useFonts({
    RussoOne_400Regular,
  });

  // Get user data from previous screen
  const { email, username, password } = route.params;

  const [role, setRole] = useState('user');
  const [mechanicName, setMechanicName] = useState('');
  const [mechanicPhone, setMechanicPhone] = useState('');
  const [loading, setLoading] = useState(false);

  if (!fontsLoaded) {
    return null;
  }

  const handleSignup = async () => {
    // Validate mechanic fields if role is mechanic
    if (role === 'mechanic') {
      if (!mechanicName || !mechanicPhone) {
        Alert.alert('Error', 'Please provide your name and phone number');
        return;
      }
      if (mechanicPhone.length < 10) {
        Alert.alert('Error', 'Please provide a valid phone number');
        return;
      }
    }

    setLoading(true);

    // Prepare mechanic data if applicable
    const mechanicData = role === 'mechanic' ? {
      name: mechanicName,
      phone: mechanicPhone,
      specialties: [],
      available: true
    } : undefined;

    const result = await authService.signup(email, username, password, role, mechanicData);
    setLoading(false);

    if (result.success) {
      console.log('Signup successful:', result.user);
      navigation.replace('Main');
    } else {
      Alert.alert('Signup Failed', result.error);
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
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Select Role</Text>
          </View>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <View style={styles.formContent}>
            {/* Role Selection */}
            <View style={styles.roleContainer}>
              <Text style={styles.roleLabel}>I AM A:</Text>
              <View style={styles.roleButtons}>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    role === 'user' && styles.roleButtonActive,
                  ]}
                  onPress={() => setRole('user')}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.roleButtonText,
                      role === 'user' && styles.roleButtonTextActive,
                    ]}
                  >
                    User
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    role === 'mechanic' && styles.roleButtonActive,
                  ]}
                  onPress={() => setRole('mechanic')}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.roleButtonText,
                      role === 'mechanic' && styles.roleButtonTextActive,
                    ]}
                  >
                    Mechanic
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Mechanic-specific fields */}
            {role === 'mechanic' && (
              <View style={styles.mechanicFields}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>FULL NAME</Text>
                  <TextInput
                    placeholder="John Doe"
                    placeholderTextColor="#999"
                    value={mechanicName}
                    onChangeText={setMechanicName}
                    editable={!loading}
                    style={styles.inputField}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>PHONE NUMBER</Text>
                  <TextInput
                    placeholder="(555) 123-4567"
                    placeholderTextColor="#999"
                    value={mechanicPhone}
                    onChangeText={setMechanicPhone}
                    keyboardType="phone-pad"
                    editable={!loading}
                    style={styles.inputField}
                  />
                </View>

                <Text style={styles.helperText}>
                  📍 Your location will be set when you start the app
                </Text>
              </View>
            )}

            {/* Sign Up Button */}
            <TouchableOpacity
              onPress={handleSignup}
              disabled={loading}
              style={styles.signupButton}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.signupButtonText}>sign up</Text>
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
        </View>
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
  },
  logoText: {
    fontSize: 44,
    fontFamily: 'RussoOne_400Regular',
    letterSpacing: -0.5,
    color: '#111111',
    alignSelf: 'center',
  },
  formSection: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 60,
  },
  formContent: {
    flex: 1,
  },
  roleContainer: {
    marginBottom: 32,
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#555',
    textTransform: 'uppercase',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  roleButtons: {
    flexDirection: 'column',
    gap: 12,
  },
  roleButton: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleButtonActive: {
    borderColor: '#111111',
    backgroundColor: '#f8f9fa',
  },
  roleButtonText: {
    fontSize: 16,
    color: '#888888',
    fontWeight: '500',
  },
  roleButtonTextActive: {
    color: '#111111',
    fontWeight: '700',
  },
  mechanicFields: {
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#555',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputField: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    fontSize: 16,
    color: '#333',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: -16,
    marginBottom: 16,
  },
  signupButton: {
    backgroundColor: '#111111',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  signupButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
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