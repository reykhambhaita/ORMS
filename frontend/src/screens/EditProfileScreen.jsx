import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { gpsEnhancer } from '../utils/EnhancedLocationServices';
import authService from './authService';

const EditProfileScreen = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [user, setUser] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'Edit Info',
      headerStyle: {
        backgroundColor: theme.card,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      headerTintColor: theme.text,
      headerTitleStyle: {
        fontWeight: '700',
      },
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.pop()}
          style={{ padding: 8, marginLeft: -8 }}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const result = await authService.getUser();
        if (result) {
          setUser(result);
          setUsername(result.username || '');
          setEmail(result.email || '');
          setPhone(result.phone || '');
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const handleAvatarEdit = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await handleAvatarUpload(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleAvatarUpload = async (imageUri) => {
    setUploadingAvatar(true);
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();

      const reader = new FileReader();
      reader.readAsDataURL(blob);

      reader.onloadend = async () => {
        const base64data = reader.result;
        const result = await authService.uploadAvatar(base64data);

        if (result.success) {
          setUser(result.user);
          Alert.alert('Success', 'Avatar updated successfully!');
        } else {
          Alert.alert('Error', result.error || 'Failed to upload avatar');
        }
        setUploadingAvatar(false);
      };

      reader.onerror = () => {
        Alert.alert('Error', 'Failed to process image');
        setUploadingAvatar(false);
      };
    } catch (error) {
      console.error('Avatar upload error:', error);
      Alert.alert('Error', 'Failed to upload avatar');
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!username.trim() || !email.trim()) {
      Alert.alert('Error', 'Username and email are required');
      return;
    }

    setSaving(true);
    try {
      let mechanicData = null;

      // If user is a mechanic, get current location to update service point
      if (user?.role === 'mechanic') {
        console.log('🔧 [EditProfile] User is a mechanic, attempting to capture location...');

        // Always create mechanicData for mechanics with at least name and phone
        mechanicData = {
          name: username.trim(),
          phone: phone.trim()
        };

        try {
          const location = await gpsEnhancer.getHighAccuracyLocation({
            maxWaitTime: 5000, // Don't wait too long
            targetAccuracy: 20
          });

          if (location) {
            console.log('📍 [EditProfile] Captured current location for mechanic:', {
              lat: location.latitude,
              lng: location.longitude
            });
            mechanicData.latitude = location.latitude;
            mechanicData.longitude = location.longitude;
          } else {
            console.warn('⚠️ [EditProfile] Location capture returned null');
          }
        } catch (error) {
          console.error('❌ [EditProfile] Error capturing location for mechanic:', error);
          // Continue with updateProfile even if location capture fails
        }

        console.log('📦 [EditProfile] Final mechanicData to send:', JSON.stringify(mechanicData, null, 2));
      }

      const result = await authService.updateProfile({
        username: username.trim(),
        email: email.trim(),
        phone: phone.trim(),
      }, mechanicData);

      if (result.success) {
        Alert.alert('Success', 'Profile updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Update profile error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View
          entering={FadeInDown.duration(800).springify().damping(15)}
          style={styles.avatarSection}
        >
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={40} color={theme.textTertiary} />
              )}
            </View>
            <TouchableOpacity
              style={[styles.editAvatarButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={handleAvatarEdit}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={theme.text} />
              ) : (
                <Ionicons name="camera" size={18} color={theme.text} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={[styles.avatarTip, { color: theme.textSecondary }]}>
            Tap camera to change photo
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.duration(1000).delay(200).springify().damping(15)}
          style={styles.form}
        >
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Username</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="person-outline" size={20} color={theme.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter username"
                placeholderTextColor={theme.textTertiary}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Email Address</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="mail-outline" size={20} color={theme.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter email"
                placeholderTextColor={theme.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Phone Number (Optional)</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="call-outline" size={20} color={theme.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter phone number"
                placeholderTextColor={theme.textTertiary}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: isDark ? '#fff' : '#111111' }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={isDark ? '#000' : '#fff'} />
            ) : (
              <Text style={[styles.saveButtonText, { color: isDark ? '#000' : '#fff' }]}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  form: {
    gap: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarTip: {
    fontSize: 12,
    fontWeight: '500',
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default EditProfileScreen;
