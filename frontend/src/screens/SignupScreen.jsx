// src/screens/SignupScreen.jsx
import { RussoOne_400Regular, useFonts } from '@expo-google-fonts/russo-one';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const SignupScreen = ({ navigation }) => {
  const [fontsLoaded] = useFonts({
    RussoOne_400Regular,
  });

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  if (!fontsLoaded) {
    return null;
  }

  const handleContinue = () => {
    if (!email || !username || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    // Navigate to role selection with user data
    navigation.navigate('RoleSelection', {
      email,
      username,
      password,
    });
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
            <Text style={styles.logoText}>Create Account</Text>
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
                style={styles.inputField}
              />
            </View>

            {/* Username Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>USERNAME</Text>
              <TextInput
                placeholder="username"
                placeholderTextColor="#999"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
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
                style={styles.inputField}
              />
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
              <TextInput
                placeholder="********"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                style={styles.inputField}
              />
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              onPress={handleContinue}
              style={styles.continueButton}
              activeOpacity={0.8}
            >
              <Text style={styles.continueButtonText}>continue</Text>
            </TouchableOpacity>
          </View>

          {/* Login Link */}
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
    color: '#000000',
    alignSelf: 'center',
  },
  formSection: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 60,
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
  continueButton: {
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
  continueButtonText: {
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
    color: '#111111',
    fontWeight: '700',
  },
});

export default SignupScreen;