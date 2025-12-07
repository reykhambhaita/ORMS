// src/screens/RoleSelectionScreen.jsx
import { RussoOne_400Regular, useFonts } from '@expo-google-fonts/russo-one';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
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
      navigation.replace('Home');
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
        {/* Header Section with Gradient */}
        <LinearGradient
          colors={['#003355', '#001122']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerSection}
        >
          <View style={styles.logoContainer}>
            <MaskedView
              maskElement={
                <Text style={styles.logoText}>Select Role</Text>
              }
            >
              <LinearGradient
                colors={['#ffffff', '#ffffff', '#001122', '#001122']}
                locations={[0, 0.38, 0.38, 1]}
                style={styles.logoGradient}
              />
            </MaskedView>
          </View>
        </LinearGradient>

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
                <ActivityIndicator color="#fff" />
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
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerSection: {
    height: '35%',
    minHeight: 250,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 0,
  },
  logoContainer: {
    marginBottom: -20,
    zIndex: 20,
  },
  logoText: {
    fontSize: 38,
    fontFamily: 'RussoOne_400Regular',
    letterSpacing: -1,
    marginLeft: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGradient: {
    height: 60,
    width: 280,
  },
  formSection: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -16,
    paddingHorizontal: 32,
    paddingTop: 70,
    paddingBottom: 150,
    zIndex: 10,
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
    borderColor: '#001f3f',
    backgroundColor: '#e8f0f8',
  },
  roleButtonText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  roleButtonTextActive: {
    color: '#001f3f',
    fontWeight: '600',
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
    backgroundColor: '#001f3f',
    height: 56,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
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
    color: '#6b7280',
  },
  loginLink: {
    color: '#001f3f',
    fontWeight: '600',
  },
});

export default RoleSelectionScreen;