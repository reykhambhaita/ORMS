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
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Text style={styles.logoText}>ORMS</Text>
          <Text style={styles.subtitleText}>on road mechanic service</Text>
          <Text style={styles.taglineText}>Get Mechanical Help Anywhere.</Text>
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
    flex: 1,
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 56,
    fontFamily: 'RussoOne_400Regular',
    color: '#ffffff',
    letterSpacing: 2,
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 16,
    fontWeight: '400',
  },
  taglineText: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: '400',
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
