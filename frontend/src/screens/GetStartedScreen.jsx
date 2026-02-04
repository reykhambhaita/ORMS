// src/screens/GetStartedScreen.jsx
import { RussoOne_400Regular, useFonts } from '@expo-google-fonts/russo-one';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const GetStartedScreen = ({ navigation }) => {
  const [fontsLoaded] = useFonts({
    RussoOne_400Regular,
  });

  if (!fontsLoaded) {
    return null;
  }

  const handleGetStarted = () => {
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Content Container */}
      <View style={styles.contentContainer}>
        <View style={{ flex: 1 }} />

        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Text style={styles.logoText}>Orb</Text>
          <Text style={styles.taglineText}>get mechanical help anywhere</Text>
        </View>

        {/* Button Section */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoSection: {
    marginBottom: 24,
  },
  logoText: {
    fontSize: 56,
    fontFamily: 'RussoOne_400Regular',
    color: '#ffffff',
    letterSpacing: 2,
    marginBottom: 0,
  },
  taglineText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '400',
    opacity: 0.8,
  },

  buttonContainer: {
    marginBottom: 50,
  },
  button: {
    backgroundColor: '#ffffff',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#000000',
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'System', // Or use a specific font if needed
  },
});

export default GetStartedScreen;
