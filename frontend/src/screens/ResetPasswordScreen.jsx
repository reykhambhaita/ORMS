// src/screens/ResetPasswordScreen.jsx
import { RussoOne_400Regular, useFonts } from '@expo-google-fonts/russo-one';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import authService from './authService';

const ResetPasswordScreen = ({ navigation, route }) => {
  const [fontsLoaded] = useFonts({
    RussoOne_400Regular,
  });

  const { email, otp } = route.params;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!fontsLoaded) {
    return null;
  }

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
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

    setLoading(true);
    const result = await authService.resetPassword(email, otp, password);
    setLoading(false);

    if (result.success) {
      Alert.alert('Success', 'Password reset successful. Please login with your new password.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } else {
      Alert.alert('Error', result.error);
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

        <Animated.View
          entering={FadeInUp.duration(1000).delay(200).springify().damping(12)}
          style={styles.formSection}
        >
          <Text style={styles.instructionText}>
            Set a new password for your account.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>NEW PASSWORD</Text>
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

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
            <TextInput
              placeholder="********"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!loading}
              style={styles.inputField}
            />
          </View>

          <TouchableOpacity
            onPress={handleResetPassword}
            disabled={loading}
            style={styles.resetButton}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.resetButtonText}>reset password</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
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
    paddingHorizontal: 32,
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
    paddingHorizontal: 32,
    paddingTop: 0,
  },
  instructionText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 40,
    lineHeight: 24,
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
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    fontSize: 16,
    color: '#333',
  },
  resetButton: {
    backgroundColor: '#000000',
    height: 58,
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
  resetButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
});

export default ResetPasswordScreen;
