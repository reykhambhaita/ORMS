// src/screens/OTPScreen.jsx
import { RussoOne_400Regular, useFonts } from '@expo-google-fonts/russo-one';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import authService from './authService';

const OTPScreen = ({ navigation, route }) => {
  const [fontsLoaded] = useFonts({
    RussoOne_400Regular,
  });

  const { email, isForgotPassword } = route.params;
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
    let result;
    if (isForgotPassword) {
      result = await authService.verifyForgotPasswordOTP(email, otp);
    } else {
      result = await authService.verifyOTP(email, otp);
    }
    setLoading(false);

    if (result.success) {
      if (isForgotPassword) {
        navigation.navigate('ResetPassword', { email, otp });
      } else {
        navigation.replace('RoleSelection', {
          email: email,
          username: result.user.username,
        });
      }
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

  const renderOtpBlocks = () => {
    const blocksSource = otp.padEnd(6, ' ').split('');
    return (
      <View style={styles.otpContainer}>
        {blocksSource.map((char, index) => (
          <View key={index} style={[styles.otpBlock, char !== ' ' && styles.otpBlockFilled]}>
            <Text style={styles.otpDigit}>{char}</Text>
          </View>
        ))}
      </View>
    );
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
          <View style={styles.formContent}>
            <Text style={styles.instructionText}>
              We've sent a 6-digit verification code to:
            </Text>
            <Text style={styles.emailText}>{email}</Text>

            <TouchableOpacity activeOpacity={1} style={styles.inputWrapper}>
              {renderOtpBlocks()}
              <TextInput
                value={otp}
                onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.hiddenInput}
                autoFocus={true}
                editable={!loading}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleVerify}
              style={styles.verifyButton}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.verifyButtonText}>continue</Text>
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
  inputWrapper: {
    marginBottom: 48,
    alignItems: 'center',
    justifyContent: 'center',
    height: 70,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 0,
  },
  otpBlock: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  otpBlockFilled: {
    borderColor: '#000000',
    backgroundColor: '#ffffff',
  },
  otpDigit: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: '100%',
  },
  verifyButton: {
    backgroundColor: '#000000',
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  verifyButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 40,
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

