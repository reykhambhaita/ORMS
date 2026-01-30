// src/screens/LoginScreen.jsx
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
  View
} from 'react-native';
import authService from './authService';
const LoginScreen = ({ navigation }) => {
  const [fontsLoaded] = useFonts({
    RussoOne_400Regular,
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!fontsLoaded) {
    return null; // or a loading spinner
  }

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    const result = await authService.login(email, password);
    setLoading(false);

    if (result.success) {
      Alert.alert('Success', 'Logged in successfully!');
      navigation.replace('Main');
    } else {
      Alert.alert('Login Failed', result.error);
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
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>rexGO</Text>
          </View>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <View style={styles.formContent}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>EMAIL</Text>
              <TextInput
                placeholder="user@example.com"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
                style={styles.inputField}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <TextInput
                placeholder="********"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
                style={styles.inputField}
              />
            </View>

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={styles.loginButton}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>login</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Forgot Password Link */}
          <View style={styles.forgotPasswordContainer}>
            <TouchableOpacity>
              <Text style={styles.forgotPasswordText}>FORGOT PASSWORD?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign Up Link */}
          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>
              Don't have an account yet?{' '}
              <Text
                style={styles.signupLink}
                onPress={() => navigation.navigate('Signup')}
              >
                Sign Up
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 56,
    fontFamily: 'RussoOne_400Regular',
    letterSpacing: 2,
    color: '#000000',
    alignSelf: 'center',
  },
  formSection: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 32,
  },
  formContent: {
    flex: 1,
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
  loginButton: {
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
  loginButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  forgotPasswordText: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  signupContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  signupText: {
    fontSize: 14,
    color: '#6b7280',
  },
  signupLink: {
    color: '#111111',
    fontWeight: '700',
  },
});

export default LoginScreen;