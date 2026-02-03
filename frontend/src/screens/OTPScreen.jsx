// src/screens/OTPScreen.jsx
import { RussoOne_400Regular, useFonts } from '@expo-google-fonts/russo-one';
import { useEffect, useState } from 'react';
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

const OTPScreen = ({ navigation, route }) => {
  const [fontsLoaded] = useFonts({
    RussoOne_400Regular,
  });

  const { email } = route.params;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(60);

  useEffect(() => {
    let interval = null;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timer]);

  if (!fontsLoaded) {
    return null;
  }

  const handleVerify = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Please enter a 6-digit OTP');
      return;
    }

    setLoading(true);
    const result = await authService.verifyOTP(email, otp);
    setLoading(false);

    if (result.success) {
      Alert.alert('Success', 'Email verified successfully!');
      // Navigate to role selection
      navigation.replace('RoleSelection', {
        email: email,
        // Passing these just in case, though verifyOTP stores user data in authService
        username: result.user.username,
      });
    } else {
      Alert.alert('Verification Failed', result.error);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;

    setResending(true);
    const result = await authService.resendOTP(email);
    setResending(false);

    if (result.success) {
      Alert.alert('Success', 'A new OTP has been sent to your email');
      setTimer(60);
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
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Verify Email</Text>
          </View>
        </View>

        <View style={styles.formSection}>
          <View style={styles.formContent}>
            <Text style={styles.instructionText}>
              We've sent a 6-digit verification code to:
            </Text>
            <Text style={styles.emailText}>{email}</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>OTP CODE</Text>
              <TextInput
                placeholder="000000"
                placeholderTextColor="#999"
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.inputField}
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              onPress={handleVerify}
              style={styles.verifyButton}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.verifyButtonText}>verify</Text>
              )}
            </TouchableOpacity>

            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>
                Didn't receive the code?{' '}
              </Text>
              <TouchableOpacity onPress={handleResend} disabled={timer > 0 || resending}>
                <Text style={[styles.resendLink, timer > 0 && styles.resendLinkDisabled]}>
                  {resending ? 'Sending...' : timer > 0 ? `Resend In ${timer}s` : 'Resend OTP'}
                </Text>
              </TouchableOpacity>
            </View>
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
    textAlign: 'center',
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
  instructionText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#555',
    textTransform: 'uppercase',
    marginBottom: 16,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  inputField: {
    width: '100%',
    paddingVertical: 12,
    fontSize: 32,
    color: '#111111',
    textAlign: 'center',
    letterSpacing: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#111111',
  },
  verifyButton: {
    backgroundColor: '#111111',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  verifyButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  resendText: {
    fontSize: 14,
    color: '#6b7280',
  },
  resendLink: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '700',
  },
  resendLinkDisabled: {
    color: '#9ca3af',
  },
});

export default OTPScreen;
