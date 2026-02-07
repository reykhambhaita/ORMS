// src/screens/ForgotPasswordScreen.jsx
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

const ForgotPasswordScreen = ({ navigation }) => {
  const [fontsLoaded] = useFonts({
    RussoOne_400Regular,
  });

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  if (!fontsLoaded) {
    return null;
  }

  const handleSendOTP = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    const result = await authService.forgotPassword(email);
    setLoading(false);

    if (result.success) {
      navigation.navigate('OTP', { email, isForgotPassword: true });
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
            Enter your email address to reset your password.
          </Text>

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

          <TouchableOpacity
            onPress={handleSendOTP}
            disabled={loading}
            style={styles.continueButton}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.continueButtonText}>continue</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>BACK TO LOGIN</Text>
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
  continueButton: {
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
  continueButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  backButton: {
    alignItems: 'center',
    marginTop: 32,
  },
  backButtonText: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
});

export default ForgotPasswordScreen;
