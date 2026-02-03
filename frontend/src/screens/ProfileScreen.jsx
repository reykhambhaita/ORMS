// src/screens/ProfileScreen.jsx
import { RussoOne_400Regular, useFonts } from '@expo-google-fonts/russo-one';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import authService from './authService';

const ProfileScreen = ({ navigation }) => {
  const { theme, themeMode, setThemeMode, isDark } = useTheme();
  const [fontsLoaded] = useFonts({
    RussoOne_400Regular,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [reviewHistory, setReviewHistory] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [editUpiId, setEditUpiId] = useState('');
  const [mechanicProfile, setMechanicProfile] = useState(null);
  const [savingUpi, setSavingUpi] = useState(false);
  const [showExpandedQR, setShowExpandedQR] = useState(false);

  const translateY = useSharedValue(800);
  const anyModalVisible = showPaymentModal || showReviewModal || showEditModal || showAppearanceModal || showUpiModal;

  useEffect(() => {
    if (anyModalVisible) {
      translateY.value = withSpring(0, {
        damping: 18,
        stiffness: 90,
      });
    } else {
      translateY.value = 800;
    }
  }, [anyModalVisible]);

  const animatedContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animateAndClose = (closeFn) => {
    translateY.value = withTiming(800, { duration: 250 }, () => {
      runOnJS(closeFn)(false);
    });
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'My Profile',
      headerStyle: {
        backgroundColor: theme.card,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        shadowColor: 'transparent',
        elevation: 0,
      },
      headerTintColor: theme.text,
      headerTitleStyle: {
        fontWeight: '600',
      },
      headerRight: null,
    });
  }, [navigation, theme]);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    setLoading(true);

    try {
      const userResult = await authService.getCurrentUser();
      if (userResult.success) {
        setUser(userResult.user);
        setEditUsername(userResult.user?.username || '');
        setEditEmail(userResult.user?.email || '');

        if (userResult.mechanicProfile) {
          setMechanicProfile(userResult.mechanicProfile);
          setEditUpiId(userResult.mechanicProfile.upiId || '');
        }
      }

      const paymentsResult = await authService.getPaymentHistory();
      if (paymentsResult.success) {
        setPaymentHistory(paymentsResult.data || []);
      }

      const reviewsResult = await authService.getMyReviews();
      if (reviewsResult.success) {
        setReviewHistory(reviewsResult.data || []);
      }
    } catch (error) {
      console.error('Load profile error:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadProfileData();
  };

  const handleEditProfile = () => {
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!editUsername.trim() || !editEmail.trim()) {
      Alert.alert('Error', 'Username and email are required');
      return;
    }

    try {
      const result = await authService.updateProfile({
        username: editUsername,
        email: editEmail,
      });

      if (result.success) {
        setUser({ ...user, username: editUsername, email: editEmail });
        setShowEditModal(false);
        Alert.alert('Success', 'Profile updated successfully');
      } else {
        Alert.alert('Error', result.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Update profile error:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleAvatarEdit = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please grant permission to access your photo library.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5, // Compress to reduce size
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
      // Convert image to base64
      const response = await fetch(imageUri);
      const blob = await response.blob();

      const reader = new FileReader();
      reader.readAsDataURL(blob);

      reader.onloadend = async () => {
        const base64data = reader.result;

        // Upload to server
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

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.logout();
              navigation.replace('Login');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const openGitHub = () => {
    Linking.openURL('https://github.com/reykhambhaita/ORMS');
  };

  if (!fontsLoaded || loading) {
    return (
      <View style={[styles(theme).loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.text} />
        <Text style={[styles(theme).loadingText, { color: theme.textSecondary }]}>Loading profile...</Text>
      </View>
    );
  }

  const dynamicStyles = { ...styles(theme), ...upiStyles(theme) };

  return (
    <View style={dynamicStyles.container}>
      <ScrollView
        contentContainerStyle={dynamicStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.text}
            colors={[theme.primary]}
          />
        }
      >
        {/* User Profile Card */}
        <View style={dynamicStyles.profileCard}>
          <View style={dynamicStyles.avatarContainer}>
            <View style={dynamicStyles.avatar}>
              {user?.avatar ? (
                <Image
                  source={{ uri: user.avatar }}
                  style={dynamicStyles.avatarImage}
                />
              ) : (
                <Ionicons name="person" size={32} color={theme.text} />
              )}
            </View>
            <TouchableOpacity
              style={dynamicStyles.editAvatarButton}
              onPress={handleAvatarEdit}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={theme.text} />
              ) : (
                <Ionicons name="camera" size={16} color={theme.text} />
              )}
            </TouchableOpacity>
          </View>

          <Text style={dynamicStyles.emailText}>{user?.email || 'N/A'}</Text>
          <Text style={dynamicStyles.usernameText}>{user?.username || 'Username'}</Text>

          <TouchableOpacity style={dynamicStyles.editButton} onPress={handleEditProfile}>
            <Text style={dynamicStyles.editButtonText}>edit info</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Options */}
        <View style={dynamicStyles.menuContainer}>
          <TouchableOpacity
            style={dynamicStyles.menuItem}
            onPress={() => setShowAppearanceModal(true)}
          >
            <Text style={dynamicStyles.menuItemText}>Appearance</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 13, color: theme.textSecondary }}>
                {themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={dynamicStyles.menuItem}
            onPress={() => setShowPaymentModal(true)}
          >
            <Text style={dynamicStyles.menuItemText}>Payment History</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={dynamicStyles.menuItem}
            onPress={() => setShowReviewModal(true)}
          >
            <Text style={dynamicStyles.menuItemText}>Review History</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          {user?.role === 'mechanic' && (
            <TouchableOpacity
              style={dynamicStyles.menuItem}
              onPress={() => setShowUpiModal(true)}
            >
              <Text style={dynamicStyles.menuItemText}>Manage UPI ID</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {mechanicProfile?.upiId ? (
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                ) : (
                  <Ionicons name="warning" size={18} color="#f59e0b" />
                )}
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={dynamicStyles.menuItem}
            onPress={() => Alert.alert('App Permissions', 'Manage app permissions here.')}
          >
            <Text style={dynamicStyles.menuItemText}>App Permissions</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[dynamicStyles.menuItem, dynamicStyles.menuItemLast]}
            onPress={() => Alert.alert('About', 'ORMS - On-Road Mechanic Service\nVersion 1.0.0')}
          >
            <Text style={dynamicStyles.menuItemText}>About</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* GitHub Repository Card */}
        <TouchableOpacity style={dynamicStyles.repoCard} onPress={openGitHub}>
          <Text style={dynamicStyles.repoTitle}>Check out the app repository here.</Text>
          <View style={dynamicStyles.repoInfo}>
            <Ionicons name="logo-github" size={32} color={theme.text} />
            <Text style={dynamicStyles.repoLink}>reykhambhaita/ORMS</Text>
          </View>
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity
          style={dynamicStyles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={dynamicStyles.logoutButtonText}>logout</Text>
        </TouchableOpacity>

        {/* Copyright Footer */}
        <View style={dynamicStyles.copyrightContainer}>
          <Text style={dynamicStyles.copyrightText}>© 2024 ORMS. All rights reserved.</Text>
          <Text style={dynamicStyles.copyrightSubtext}>On-Road Mechanic Service</Text>
        </View>

        <View style={dynamicStyles.bottomPadding} />
      </ScrollView>

      {/* Appearance Modal */}
      <Modal
        visible={showAppearanceModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => animateAndClose(setShowAppearanceModal)}
      >
        <TouchableOpacity
          style={dynamicStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => animateAndClose(setShowAppearanceModal)}
        >
          <Animated.View style={[dynamicStyles.modalContent, animatedContentStyle]}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Appearance</Text>
              <TouchableOpacity onPress={() => setShowAppearanceModal(false)}>
                <Ionicons name="close" size={28} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 24, gap: 12 }}>
              {['light', 'dark', 'system'].map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    dynamicStyles.themeOption,
                    themeMode === mode && dynamicStyles.themeOptionSelected
                  ]}
                  onPress={() => {
                    setThemeMode(mode);
                    setShowAppearanceModal(false);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Ionicons
                      name={
                        mode === 'light' ? 'sunny' :
                          mode === 'dark' ? 'moon' : 'settings'
                      }
                      size={20}
                      color={themeMode === mode ? theme.primaryText : theme.text}
                    />
                    <Text style={[
                      dynamicStyles.themeOptionText,
                      themeMode === mode && dynamicStyles.themeOptionTextSelected
                    ]}>
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      {mode === 'system' && ' Default'}
                    </Text>
                  </View>
                  {themeMode === mode && (
                    <Ionicons name="checkmark-circle" size={24} color={theme.primaryText} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Payment History Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => animateAndClose(setShowPaymentModal)}
      >
        <TouchableOpacity
          style={dynamicStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => animateAndClose(setShowPaymentModal)}
        >
          <Animated.View style={[dynamicStyles.modalContent, animatedContentStyle]}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Payment History</Text>
              <TouchableOpacity onPress={() => animateAndClose(setShowPaymentModal)}>
                <Ionicons name="close" size={28} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={dynamicStyles.modalScrollView}>
              {paymentHistory.length === 0 ? (
                <View style={dynamicStyles.emptyState}>
                  <Ionicons name="card-outline" size={48} color={theme.textTertiary} />
                  <Text style={dynamicStyles.emptyText}>No payment history</Text>
                </View>
              ) : (
                paymentHistory.map((payment, index) => (
                  <View key={payment.id || index} style={dynamicStyles.historyCard}>
                    <View style={dynamicStyles.historyHeader}>
                      <Text style={dynamicStyles.historyTitle}>{payment.mechanicName}</Text>
                      <View style={[
                        dynamicStyles.statusBadge,
                        payment.status === 'completed' ? dynamicStyles.statusCompletedBadge : dynamicStyles.statusPendingBadge
                      ]}>
                        <Text style={[
                          dynamicStyles.historyStatus,
                          payment.status === 'completed' ? dynamicStyles.statusCompleted : dynamicStyles.statusPending
                        ]}>
                          {payment.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={dynamicStyles.historyAmount}>${payment.amount.toFixed(2)}</Text>
                    <Text style={dynamicStyles.historyDescription}>{payment.description}</Text>
                    <Text style={dynamicStyles.historyDate}>{formatDate(payment.createdAt)}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Review History Modal */}
      <Modal
        visible={showReviewModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => animateAndClose(setShowReviewModal)}
      >
        <TouchableOpacity
          style={dynamicStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => animateAndClose(setShowReviewModal)}
        >
          <Animated.View style={[dynamicStyles.modalContent, animatedContentStyle]}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Review History</Text>
              <TouchableOpacity onPress={() => animateAndClose(setShowReviewModal)}>
                <Ionicons name="close" size={28} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={dynamicStyles.modalScrollView}>
              {reviewHistory.length === 0 ? (
                <View style={dynamicStyles.emptyState}>
                  <Ionicons name="star-outline" size={48} color={theme.textTertiary} />
                  <Text style={dynamicStyles.emptyText}>No reviews submitted</Text>
                </View>
              ) : (
                reviewHistory.map((review, index) => (
                  <View key={review.id || index} style={dynamicStyles.historyCard}>
                    <View style={dynamicStyles.historyHeader}>
                      <Text style={dynamicStyles.historyTitle}>{review.mechanicName}</Text>
                      <View style={dynamicStyles.ratingBadge}>
                        <Ionicons name="star" size={14} color="#fbbf24" />
                        <Text style={dynamicStyles.ratingText}>{review.rating}/5</Text>
                      </View>
                    </View>
                    {review.comment && (
                      <Text style={dynamicStyles.reviewComment}>"{review.comment}"</Text>
                    )}
                    <Text style={dynamicStyles.historyDate}>{formatDate(review.createdAt)}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => animateAndClose(setShowEditModal)}
      >
        <TouchableOpacity
          style={dynamicStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => animateAndClose(setShowEditModal)}
        >
          <Animated.View style={[dynamicStyles.modalContent, animatedContentStyle]}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => animateAndClose(setShowEditModal)}>
                <Ionicons name="close" size={28} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={dynamicStyles.editForm}>
              <View style={dynamicStyles.inputContainer}>
                <Text style={dynamicStyles.inputLabel}>Username</Text>
                <TextInput
                  style={dynamicStyles.input}
                  value={editUsername}
                  onChangeText={setEditUsername}
                  placeholder="Enter username"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={dynamicStyles.inputContainer}>
                <Text style={dynamicStyles.inputLabel}>Email</Text>
                <TextInput
                  style={dynamicStyles.input}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="Enter email"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={dynamicStyles.saveButton}
                onPress={handleSaveProfile}
              >
                <Text style={dynamicStyles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* UPI Modal */}
      <Modal
        visible={showUpiModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => animateAndClose(setShowUpiModal)}
      >
        <TouchableOpacity
          style={dynamicStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => animateAndClose(setShowUpiModal)}
        >
          <Animated.View style={[dynamicStyles.modalContent, animatedContentStyle]}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>UPI Details</Text>
              <TouchableOpacity onPress={() => animateAndClose(setShowUpiModal)}>
                <Ionicons name="close" size={28} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={dynamicStyles.modalScrollView}>
              <View style={dynamicStyles.upiInfoContainer}>
                {mechanicProfile?.upiQrCode ? (
                  <TouchableOpacity
                    style={dynamicStyles.qrContainer}
                    onPress={() => setShowExpandedQR(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={dynamicStyles.qrHeading}>Your Payment QR</Text>
                    <Image
                      source={{ uri: mechanicProfile.upiQrCode }}
                      style={dynamicStyles.qrImage}
                    />
                    <Text style={dynamicStyles.upiIdText}>{mechanicProfile.upiId}</Text>
                    <Text style={dynamicStyles.tapToExpandText}>Tap to expand for user to scan</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={dynamicStyles.upiPlaceholder}>
                    <Ionicons name="qr-code-outline" size={64} color={theme.textTertiary} />
                    <Text style={dynamicStyles.upiPlaceholderText}>No UPI ID set up yet</Text>
                  </View>
                )}

                <View style={dynamicStyles.upiForm}>
                  <Text style={dynamicStyles.inputLabel}>UPI ID</Text>
                  <TextInput
                    style={dynamicStyles.input}
                    value={editUpiId}
                    onChangeText={setEditUpiId}
                    placeholder="username@bank"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                  />
                  <Text style={dynamicStyles.upiHelpText}>
                    This ID will be used to generate a QR code for customers to pay you directly via UPI.
                  </Text>

                  <TouchableOpacity
                    style={[dynamicStyles.saveButton, savingUpi && { opacity: 0.7 }]}
                    onPress={async () => {
                      setSavingUpi(true);
                      try {
                        const result = await authService.updateMechanicUPI(editUpiId);
                        if (result.success) {
                          setMechanicProfile({
                            ...mechanicProfile,
                            upiId: result.data.upiId,
                            upiQrCode: result.data.upiQrCode
                          });
                          Alert.alert('Success', 'UPI details updated successfully');
                        } else {
                          Alert.alert('Error', result.error || 'Failed to update UPI');
                        }
                      } catch (error) {
                        Alert.alert('Error', 'Failed to update UPI');
                      } finally {
                        setSavingUpi(false);
                      }
                    }}
                    disabled={savingUpi}
                  >
                    {savingUpi ? (
                      <ActivityIndicator color={theme.primaryText} />
                    ) : (
                      <Text style={dynamicStyles.saveButtonText}>Save Details</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Expanded QR Modal */}
      <Modal
        visible={showExpandedQR}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowExpandedQR(false)}
      >
        <TouchableOpacity
          style={dynamicStyles.expandedQrOverlay}
          activeOpacity={1}
          onPress={() => setShowExpandedQR(false)}
        >
          <View style={dynamicStyles.expandedQrContent}>
            <Text style={dynamicStyles.expandedQrTitle}>Payment QR Code</Text>
            <View style={dynamicStyles.largeQrContainer}>
              <Image
                source={{ uri: mechanicProfile?.upiQrCode }}
                style={dynamicStyles.largeQr}
              />
            </View>
            <Text style={dynamicStyles.expandedQrHint}>Ask the user to scan this QR code using their UPI app</Text>
            <TouchableOpacity
              style={dynamicStyles.closeExpandedButton}
              onPress={() => setShowExpandedQR(false)}
            >
              <Text style={dynamicStyles.closeExpandedText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  profileCard: {
    backgroundColor: theme.card,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 4,
    borderWidth: 1,
    borderColor: theme.border,
  },
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.inputBg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.card,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  emailText: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  usernameText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 24,
  },
  editButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  editButtonText: {
    color: theme.primaryText,
    fontSize: 13,
    fontWeight: '600',
  },
  menuContainer: {
    backgroundColor: theme.card,
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 15,
    color: theme.text,
  },
  repoCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  repoTitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  repoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  repoLink: {
    fontSize: 15,
    color: theme.text,
    fontWeight: '600',
  },
  copyrightContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  copyrightText: {
    fontSize: 12,
    color: theme.textTertiary,
    marginBottom: 1,
  },
  copyrightSubtext: {
    fontSize: 11,
    color: theme.textTertiary,
    opacity: 0.8,
  },
  bottomPadding: {
    height: 120,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.modalOverlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.text,
  },
  modalScrollView: {
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: theme.textTertiary,
    marginTop: 12,
  },
  historyCard: {
    backgroundColor: theme.inputBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusCompletedBadge: {
    backgroundColor: theme.statusCompleted,
  },
  statusPendingBadge: {
    backgroundColor: theme.statusPending,
  },
  historyStatus: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusCompleted: {
    color: theme.statusCompletedText,
  },
  statusPending: {
    color: theme.statusPendingText,
  },
  historyAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 6,
  },
  historyDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 6,
  },
  historyDate: {
    fontSize: 12,
    color: theme.textTertiary,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  reviewComment: {
    fontSize: 14,
    color: theme.textSecondary,
    fontStyle: 'italic',
    marginBottom: 8,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: theme.primary,
  },
  editForm: {
    padding: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.inputBg,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
  },
  saveButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    color: theme.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: theme.primary,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 20,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  logoutButtonText: {
    color: theme.primaryText,
    fontSize: 16,
    fontWeight: '600',
  },
  themeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.inputBg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  themeOptionSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  themeOptionText: {
    fontSize: 16,
    color: theme.text,
    fontWeight: '500',
  },
  themeOptionTextSelected: {
    color: theme.primaryText,
    fontWeight: '700',
  }
});

export default ProfileScreen;
/* UPI Additional Styles */
const upiStyles = (theme) => ({
  upiInfoContainer: { paddingBottom: 40 },
  qrContainer: { alignItems: 'center', padding: 24, backgroundColor: '#ffffff', borderRadius: 24, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  qrHeading: { fontSize: 14, fontWeight: '700', color: '#111111', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
  qrImage: { width: 240, height: 240, marginBottom: 16 },
  upiIdText: { fontSize: 16, fontWeight: '600', color: '#111111', backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  upiPlaceholder: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, backgroundColor: theme.inputBg, borderRadius: 20, borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed', marginBottom: 24 },
  upiPlaceholderText: { fontSize: 14, color: theme.textTertiary, marginTop: 12 },
  upiForm: { marginTop: 8 },
  upiHelpText: { fontSize: 12, color: theme.textSecondary, marginTop: 8, marginBottom: 20, lineHeight: 18 },
  tapToExpandText: { fontSize: 10, color: '#888', marginTop: 12, fontWeight: '500' },
  expandedQrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  expandedQrContent: { backgroundColor: '#fff', borderRadius: 24, padding: 30, alignItems: 'center', width: '100%' },
  expandedQrTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 20, fontFamily: 'RussoOne_400Regular' },
  largeQrContainer: { padding: 15, backgroundColor: '#fff', borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
  largeQr: { width: 250, height: 250 },
  expandedQrHint: { fontSize: 12, color: '#888', marginTop: 20, textAlign: 'center' },
  closeExpandedButton: { marginTop: 30, paddingVertical: 12, paddingHorizontal: 40, backgroundColor: '#111', borderRadius: 12 },
  closeExpandedText: { color: '#fff', fontWeight: '600' },
});
