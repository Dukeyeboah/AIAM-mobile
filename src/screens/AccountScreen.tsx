// src/screens/AccountScreen.tsx
// User account/profile screen with profile image, username, and credits

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../providers/AuthProvider';
import { updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import {
  BASE_AFFIRMATION_COST,
  PERSONAL_IMAGE_COST,
  VOICE_CLONE_COST,
} from '../utils/creditUtils';

export function AccountScreen() {
  const { user, profile, signOutUser, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [creditsDropdownOpen, setCreditsDropdownOpen] = useState(false);

  useEffect(() => {
    if (profile?.displayName) {
      setDisplayName(profile.displayName);
    }
    if (profile?.photoURL) {
      setPhotoPreview(profile.photoURL);
    }
  }, [profile?.displayName, profile?.photoURL]);

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style='dark' />
        <View style={styles.centerContent}>
          <Text style={styles.message}>
            Please sign in to view your account
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleImagePicker = async (useCamera: boolean) => {
    if (!user) return;

    try {
      // Request permissions
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Camera permission is needed to take a photo.'
          );
          return;
        }
      } else {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Photo library permission is needed to select an image.'
          );
          return;
        }
      }

      // Launch picker
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaType.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaType.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setUploadingAvatar(true);

      // Convert to blob and upload
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const extension = blob.type?.split('/')?.[1] ?? 'jpg';
      const storageRef = ref(
        storage,
        `users/${user.uid}/profile/avatar.${extension}`
      );
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);
      setPhotoPreview(downloadUrl);
      setUploadingAvatar(false);

      Alert.alert(
        'Image uploaded',
        'Preview updated. Save your profile to keep the change.'
      );
    } catch (error) {
      console.error('[AccountScreen] Image picker error:', error);
      setUploadingAvatar(false);
      Alert.alert('Upload failed', 'Please try another image.');
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !profile) {
      Alert.alert('Error', 'You need an account to update your profile.');
      return;
    }

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Please enter a display name.');
      return;
    }

    setSavingProfile(true);
    try {
      // Update Firebase Auth profile
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: trimmedName,
          photoURL: photoPreview ?? undefined,
        });
      }

      // Update Firestore profile
      const userDoc = doc(db, 'users', user.uid);
      await updateDoc(userDoc, {
        displayName: trimmedName,
        photoURL: photoPreview ?? null,
        updatedAt: serverTimestamp(),
      });

      await refreshProfile();
      Alert.alert('Profile updated', 'Your profile has been saved.');
    } catch (error) {
      console.error('[AccountScreen] Failed to save profile', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to update profile.'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('[AccountScreen] Sign out error:', error);
    }
  };

  const firstName = profile?.displayName
    ? profile.displayName.trim().split(/\s+/)[0]
    : null;
  const firstLetter =
    firstName?.charAt(0).toUpperCase() ||
    user?.email?.charAt(0).toUpperCase() ||
    '?';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style='dark' />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
          <Text style={styles.subtitle}>
            Manage your profile and view your credits
          </Text>
        </View>

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>

          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {photoPreview ? (
              <Image source={{ uri: photoPreview }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{firstLetter}</Text>
              </View>
            )}
          </View>

          {/* Image Upload Buttons */}
          <View style={styles.imageButtonsRow}>
            <TouchableOpacity
              style={styles.imageButton}
              onPress={() => handleImagePicker(false)}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator color='#3b82f6' />
              ) : (
                <>
                  <Text style={styles.imageButtonText}>📷</Text>
                  <Text style={styles.imageButtonLabel}>Gallery</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.imageButton}
              onPress={() => handleImagePicker(true)}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator color='#3b82f6' />
              ) : (
                <>
                  <Text style={styles.imageButtonText}>📸</Text>
                  <Text style={styles.imageButtonLabel}>Camera</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Display Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder='Your name'
              placeholderTextColor='#9ca3af'
            />
          </View>

          {/* Email (read-only) */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={user.email || ''}
              editable={false}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              savingProfile && styles.saveButtonDisabled,
            ]}
            onPress={handleSaveProfile}
            disabled={savingProfile}
          >
            {savingProfile ? (
              <ActivityIndicator color='#ffffff' />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Credits Section */}
        <View style={styles.section}>
          <View style={styles.creditsHeader}>
            <View>
              <Text style={styles.sectionTitle}>Aiams</Text>
              <View style={styles.creditsAmount}>
                <Text style={styles.creditsNumber}>
                  {profile?.credits ?? 0}
                </Text>
                <Text style={styles.creditsLabel}>aiams</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.addCreditsButton}
              onPress={() => {
                Alert.alert(
                  'Coming Soon',
                  'Credit purchases will be available soon!'
                );
              }}
            >
              <Text style={styles.addCreditsButtonText}>Add aiams</Text>
            </TouchableOpacity>
          </View>

          {/* Credits Dropdown */}
          <TouchableOpacity
            style={styles.dropdownHeader}
            onPress={() => setCreditsDropdownOpen(!creditsDropdownOpen)}
          >
            <Text style={styles.dropdownHeaderText}>How credits work</Text>
            <Text style={styles.dropdownChevron}>
              {creditsDropdownOpen ? '▼' : '▶'}
            </Text>
          </TouchableOpacity>

          {creditsDropdownOpen && (
            <View style={styles.dropdownContent}>
              <Text style={styles.dropdownTitle}>Base costs:</Text>
              <View style={styles.costItem}>
                <Text style={styles.costLabel}>
                  Basic affirmation (generic image, AI voice):
                </Text>
                <Text style={styles.costValue}>
                  {BASE_AFFIRMATION_COST} aiams
                </Text>
              </View>
              <View style={styles.costItem}>
                <Text style={styles.costLabel}>+ Personal image:</Text>
                <Text style={styles.costValue}>
                  +{PERSONAL_IMAGE_COST} aiams
                </Text>
              </View>
              <View style={styles.costItem}>
                <Text style={styles.costLabel}>+ Voice clone playback:</Text>
                <Text style={styles.costValue}>+{VOICE_CLONE_COST} aiams</Text>
              </View>
              <Text style={styles.costSummary}>
                Total cost ranges from {BASE_AFFIRMATION_COST} to{' '}
                {BASE_AFFIRMATION_COST + PERSONAL_IMAGE_COST + VOICE_CLONE_COST}{' '}
                aiams per affirmation, depending on features used.
              </Text>
            </View>
          )}
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '600',
    color: '#6b7280',
  },
  imageButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  imageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  imageButtonText: {
    fontSize: 20,
  },
  imageButtonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  inputDisabled: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  creditsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  creditsAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 8,
  },
  creditsNumber: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1f2937',
  },
  creditsLabel: {
    fontSize: 18,
    color: '#6b7280',
  },
  addCreditsButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addCreditsButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 16,
  },
  dropdownHeaderText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3b82f6',
  },
  dropdownChevron: {
    fontSize: 12,
    color: '#6b7280',
  },
  dropdownContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  dropdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  costItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  costLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  costValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  costSummary: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    lineHeight: 18,
  },
  signOutButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

// Default export for compatibility
export default AccountScreen;
