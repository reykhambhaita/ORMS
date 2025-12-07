// src/screens/ProfileScreen.jsx
import { RussoOne_400Regular, useFonts } from '@expo-google-fonts/russo-one';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
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
import authService from './authService';

const ProfileScreen = ({ navigation }) => {
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
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#001f3f" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {user?.avatar ? (
                <Image
                  source={{ uri: user.avatar }}
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons name="person" size={32} color="#ffffff" />
              )}
            </View>
            <TouchableOpacity
              style={styles.editAvatarButton}
              onPress={handleAvatarEdit}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#001f3f" />
              ) : (
                <Ionicons name="camera" size={16} color="#001f3f" />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.emailText}>{user?.email || 'N/A'}</Text>
          <Text style={styles.usernameText}>{user?.username || 'Username'}</Text>

          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Text style={styles.editButtonText}>edit info</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Options */}
        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Appearance', 'Appearance settings coming soon!')}
          >
            <Text style={styles.menuItemText}>Appearance</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowPaymentModal(true)}
          >
            <Text style={styles.menuItemText}>Payment History</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setShowReviewModal(true)}
          >
            <Text style={styles.menuItemText}>Review History</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('App Permissions', 'Manage app permissions here.')}
          >
            <Text style={styles.menuItemText}>App Permissions</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemLast]}
            onPress={() => Alert.alert('About', 'ORMS - On-Road Mechanic Service\nVersion 1.0.0')}
          >
            <Text style={styles.menuItemText}>About</Text>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* GitHub Repository Card */}
        <TouchableOpacity style={styles.repoCard} onPress={openGitHub}>
          <Text style={styles.repoTitle}>Check out the app repository here.</Text>
          <View style={styles.repoInfo}>
            <Ionicons name="logo-github" size={32} color="#000000" />
            <Text style={styles.repoLink}>reykhambhaita/ORMS</Text>
          </View>
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutButtonText}>logout</Text>
        </TouchableOpacity>

        {/* Copyright Footer */}
        <View style={styles.copyrightContainer}>
          <Text style={styles.copyrightText}>© 2024 ORMS. All rights reserved.</Text>
          <Text style={styles.copyrightSubtext}>On-Road Mechanic Service</Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Payment History Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment History</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <Ionicons name="close" size={28} color="#001f3f" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              {paymentHistory.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="card-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>No payment history</Text>
                </View>
              ) : (
                paymentHistory.map((payment, index) => (
                  <View key={payment.id || index} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyTitle}>{payment.mechanicName}</Text>
                      <Text style={[
                        styles.historyStatus,
                        payment.status === 'completed' ? styles.statusCompleted : styles.statusPending
                      ]}>
                        {payment.status.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.historyAmount}>${payment.amount.toFixed(2)}</Text>
                    <Text style={styles.historyDescription}>{payment.description}</Text>
                    <Text style={styles.historyDate}>{formatDate(payment.createdAt)}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Review History Modal */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review History</Text>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Ionicons name="close" size={28} color="#001f3f" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              {reviewHistory.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="star-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>No reviews submitted</Text>
                </View>
              ) : (
                reviewHistory.map((review, index) => (
                  <View key={review.id || index} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyTitle}>{review.mechanicName}</Text>
                      <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={14} color="#fbbf24" />
                        <Text style={styles.ratingText}>{review.rating}/5</Text>
                      </View>
                    </View>
                    {review.comment && (
                      <Text style={styles.reviewComment}>"{review.comment}"</Text>
                    )}
                    <Text style={styles.historyDate}>{formatDate(review.createdAt)}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={28} color="#001f3f" />
              </TouchableOpacity>
            </View>

            <View style={styles.editForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={editUsername}
                  onChangeText={setEditUsername}
                  placeholder="Enter username"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="Enter email"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveProfile}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  profileCard: {
    backgroundColor: '#001f3f',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
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
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  emailText: {
    fontSize: 15,
    color: '#ffffff',
    marginBottom: 4,
  },
  usernameText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 20,
  },
  editButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  editButtonText: {
    color: '#001f3f',
    fontSize: 13,
    fontWeight: '600',
  },
  menuContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 15,
    color: '#333',
  },
  repoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  repoTitle: {
    fontSize: 14,
    color: '#333',
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
    color: '#333',
    fontWeight: '600',
  },
  copyrightContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  copyrightText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 1,
  },
  copyrightSubtext: {
    fontSize: 11,
    color: '#bbb',
  },
  bottomPadding: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
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
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#001f3f',
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
    color: '#999',
    marginTop: 12,
  },
  historyCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 10,
    marginBottom: 12,

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
    color: '#001f3f',
    flex: 1,
  },
  historyStatus: {
    fontSize: 6,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusCompleted: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  statusPending: {
    backgroundColor: '#fcccccff',
    color: '#92400e ',
  },
  historyAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: '#001f3f',
    marginBottom: 6,
  },
  historyDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  historyDate: {
    fontSize: 12,
    color: '#999',
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
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
    paddingLeft: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#001f3f',
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
    color: '#001f3f',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  saveButton: {
    backgroundColor: '#001f3f',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#001f3f',
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;