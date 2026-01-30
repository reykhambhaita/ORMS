// src/screens/PaymentScreen.jsx
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

const PaymentScreen = ({ route, navigation }) => {
  const [fontsLoaded] = useFonts({
    RussoOne_400Regular,
  });

  const { mechanicId, mechanicName, mechanicPhone } = route.params || {};

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  if (!fontsLoaded) {
    return null;
  }

  const handlePayment = async () => {
    const paymentAmount = parseFloat(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount');
      return;
    }

    if (!mechanicId) {
      Alert.alert('Error', 'Mechanic information is missing');
      return;
    }

    Alert.alert(
      'Confirm Payment',
      `Pay $${paymentAmount.toFixed(2)} to ${mechanicName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay',
          onPress: async () => {
            setLoading(true);

            try {
              // Create PayPal order
              const orderResult = await authService.createPayPalOrder(
                paymentAmount,
                mechanicId,
                description || `Payment to ${mechanicName}`
              );

              if (!orderResult.success) {
                throw new Error(orderResult.error || 'Failed to create payment order');
              }

              const { orderId, paymentId } = orderResult.data;

              // In a real app, you would open PayPal checkout here
              // For now, we'll simulate immediate capture
              Alert.alert(
                'PayPal Integration',
                'In a production app, PayPal checkout would open here. For testing, we\'ll simulate payment completion.',
                [
                  { text: 'Cancel', style: 'cancel', onPress: () => setLoading(false) },
                  {
                    text: 'Simulate Payment',
                    onPress: async () => {
                      try {
                        // Capture the payment
                        const captureResult = await authService.capturePayPalPayment(
                          orderId,
                          paymentId
                        );

                        setLoading(false);

                        if (captureResult.success) {
                          Alert.alert(
                            'Payment Successful',
                            `Payment of $${paymentAmount.toFixed(2)} completed!`,
                            [
                              {
                                text: 'OK',
                                onPress: () => navigation.goBack()
                              }
                            ]
                          );
                        } else {
                          Alert.alert('Payment Failed', captureResult.error || 'Payment capture failed');
                        }
                      } catch (error) {
                        setLoading(false);
                        Alert.alert('Error', error.message);
                      }
                    }
                  }
                ]
              );
            } catch (error) {
              setLoading(false);
              console.error('Payment error:', error);
              Alert.alert('Payment Error', error.message);
            }
          }
        }
      ]
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


        {/* Form Section */}
        <View style={styles.formSection}>
          <View style={styles.formContent}>
            {/* Mechanic Info */}
            <View style={styles.mechanicCard}>
              <Text style={styles.mechanicLabel}>PAYING TO</Text>
              <Text style={styles.mechanicName}>{mechanicName}</Text>
              {mechanicPhone && (
                <Text style={styles.mechanicPhone}>📞 {mechanicPhone}</Text>
              )}
            </View>

            {/* Amount Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>AMOUNT (USD)</Text>
              <View style={styles.amountInputWrapper}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor="#999"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  editable={!loading}
                />
              </View>
            </View>

            {/* Description Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>DESCRIPTION (OPTIONAL)</Text>
              <TextInput
                style={styles.descriptionInput}
                placeholder="What is this payment for?"
                placeholderTextColor="#999"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!loading}
              />
            </View>

            {/* Payment Info */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💳 This payment will be processed through PayPal securely.
              </Text>
            </View>

            {/* Pay Button */}
            <TouchableOpacity
              style={[styles.payButton, loading && styles.buttonDisabled]}
              onPress={handlePayment}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.payButtonText}>
                  pay ${amount ? parseFloat(amount).toFixed(2) : '0.00'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => navigation.goBack()}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
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

  formSection: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  formContent: {
    flex: 1,
  },
  mechanicCard: {
    backgroundColor: '#fafafa',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#111111',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  mechanicLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#555',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  mechanicName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 6,
  },
  mechanicPhone: {
    fontSize: 12,
    color: '#888888',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#555',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111111',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  descriptionInput: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    fontSize: 14,
    color: '#333',
    minHeight: 50,
  },
  infoBox: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
    borderLeftWidth: 4,
    borderLeftColor: '#e5e7eb',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  infoText: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 18,
  },
  payButton: {
    backgroundColor: '#111111',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#999',
  },
  payButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    padding: 16,
  },
  cancelButtonText: {
    fontSize: 12,
    color: '#6b7280',
  },
});

export default PaymentScreen;
