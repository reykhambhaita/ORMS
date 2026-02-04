// src/screens/MechanicDetailScreen.jsx
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

const MechanicDetailScreen = ({ navigation, route }) => {
  const [fontsLoaded] = useFonts({
    RussoOne_400Regular,
  });

  const { email, username } = route.params;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [upiId, setUpiId] = useState('');
  const [loading, setLoading] = useState(false);

  if (!fontsLoaded) {
    return null;
  }

  const handleFinish = async () => {
    if (!name || !phone) {
      Alert.alert('Error', 'Please provide your name and phone number');
      return;
    }
    if (phone.length < 10) {
      Alert.alert('Error', 'Please provide a valid phone number');
      return;
    }

    setLoading(true);

    const mechanicData = {
      name,
      phone,
      upiId: upiId || null,
      specialties: [],
      available: true
    };

    const result = await authService.updateProfile({ role: 'mechanic', mechanicData });
    setLoading(false);

    if (result.success) {
      navigation.replace('Main');
    } else {
      Alert.alert('Registration Failed', result.error);
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
            <Text style={styles.logoText}>Mechanic{'\n'}Details</Text>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.instructionText}>
            Join our network of professional mechanics. Please provide your professional details.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>FULL NAME</Text>
            <TextInput
              placeholder="John Doe"
              placeholderTextColor="#999"
              value={name}
              onChangeText={setName}
              editable={!loading}
              style={styles.inputField}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>PHONE NUMBER</Text>
            <TextInput
              placeholder="(555) 123-4567"
              placeholderTextColor="#999"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!loading}
              style={styles.inputField}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>UPI ID (FOR PAYMENTS)</Text>
            <TextInput
              placeholder="username@bank"
              placeholderTextColor="#999"
              value={upiId}
              onChangeText={setUpiId}
              autoCapitalize="none"
              editable={!loading}
              style={styles.inputField}
            />
          </View>

          <TouchableOpacity
            onPress={handleFinish}
            disabled={loading}
            style={styles.finishButton}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.finishButtonText}>finish registration</Text>
            )}
          </TouchableOpacity>
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
    paddingHorizontal: 32,
    backgroundColor: '#ffffff',
  },
  logoContainer: {
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 44,
    fontFamily: 'RussoOne_400Regular',
    letterSpacing: -1,
    color: '#000000',
    lineHeight: 48,
  },
  formSection: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 10,
    paddingBottom: 40,
  },
  instructionText: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 32,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 28,
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
  finishButton: {
    backgroundColor: '#111111',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  finishButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default MechanicDetailScreen;
