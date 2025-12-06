// src/screens/SettingsScreen.tsx
// Settings screen with image preferences, personal reference images, and voice personalization

import React, { useState, useEffect, useRef } from 'react';
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
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { useAuth } from '../providers/AuthProvider';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import {
  AGE_OPTIONS,
  GENDER_OPTIONS,
  ETHNICITY_OPTIONS,
} from '../utils/demographics';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://www.aiam.space';

export function SettingsScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [ageRange, setAgeRange] = useState<string | undefined>(undefined);
  const [gender, setGender] = useState<string | undefined>(undefined);
  const [ethnicity, setEthnicity] = useState<string | undefined>(undefined);
  const [nationality, setNationality] = useState('');
  const [defaultAspectRatio, setDefaultAspectRatio] = useState('1:1');
  const [autoGenerateImages, setAutoGenerateImages] = useState(true);

  // Personal reference images
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);
  const [fullBodyPreview, setFullBodyPreview] = useState<string | null>(null);
  const [uploadingPortrait, setUploadingPortrait] = useState(false);
  const [uploadingFullBody, setUploadingFullBody] = useState(false);

  // Voice personalization
  const [voiceCloneId, setVoiceCloneId] = useState<string | null>(null);
  const [voiceCloneName, setVoiceCloneName] = useState<string | null>(null);
  const [useMyVoiceByDefault, setUseMyVoiceByDefault] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [hasNewVoiceFile, setHasNewVoiceFile] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const [savingSettings, setSavingSettings] = useState(false);
  const [savingAutoGenerate, setSavingAutoGenerate] = useState(false);

  // Track initial values to detect changes
  const [initialValues, setInitialValues] = useState({
    ageRange: undefined as string | undefined,
    gender: undefined as string | undefined,
    ethnicity: undefined as string | undefined,
    nationality: '',
    defaultAspectRatio: '1:1',
    portraitImageUrl: null as string | null,
    fullBodyImageUrl: null as string | null,
  });

  useEffect(() => {
    if (profile) {
      const age = profile.ageRange ?? undefined;
      const gen = profile.gender ?? undefined;
      const eth = profile.ethnicity ?? undefined;
      const nat = profile.nationality ?? '';
      const aspect = profile.defaultAspectRatio ?? '1:1';
      const portrait = profile.portraitImageUrl ?? null;
      const fullBody = profile.fullBodyImageUrl ?? null;

      setAgeRange(age);
      setGender(gen);
      setEthnicity(eth);
      setNationality(nat);
      setDefaultAspectRatio(aspect);
      setAutoGenerateImages(
        profile.autoGenerateImages === undefined
          ? true
          : Boolean(profile.autoGenerateImages)
      );
      setPortraitPreview(portrait);
      setFullBodyPreview(fullBody);
      setVoiceCloneId(profile.voiceCloneId ?? null);
      setVoiceCloneName(profile.voiceCloneName ?? null);
      setUseMyVoiceByDefault(
        typeof profile.useMyVoiceByDefault === 'boolean'
          ? profile.useMyVoiceByDefault
          : false
      );

      // Set initial values for change tracking
      setInitialValues({
        ageRange: age,
        gender: gen,
        ethnicity: eth,
        nationality: nat,
        defaultAspectRatio: aspect,
        portraitImageUrl: portrait,
        fullBodyImageUrl: fullBody,
      });
    }
  }, [profile]);

  // Check if settings have changed
  const hasSettingsChanged =
    ageRange !== initialValues.ageRange ||
    gender !== initialValues.gender ||
    ethnicity !== initialValues.ethnicity ||
    nationality !== initialValues.nationality ||
    defaultAspectRatio !== initialValues.defaultAspectRatio ||
    portraitPreview !== initialValues.portraitImageUrl ||
    fullBodyPreview !== initialValues.fullBodyImageUrl;

  if (!user || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style='dark' />
        <View style={styles.centerContent}>
          <Text style={styles.message}>Please sign in to view settings</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleImageUpload = async (
    useCamera: boolean,
    type: 'portrait' | 'fullBody'
  ) => {
    if (!user) return;

    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera permission is needed.');
          return;
        }
      } else {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Photo library permission is needed.'
          );
          return;
        }
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaType.Images,
            allowsEditing: true,
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaType.Images,
            allowsEditing: true,
            quality: 0.8,
          });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      if (type === 'portrait') {
        setUploadingPortrait(true);
      } else {
        setUploadingFullBody(true);
      }

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const extension = blob.type?.split('/')?.[1] ?? 'jpg';
      const path =
        type === 'portrait'
          ? `users/${user.uid}/profile/portrait`
          : `users/${user.uid}/profile/full-body`;
      const storageRef = ref(storage, `${path}.${extension}`);
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);

      if (type === 'portrait') {
        setPortraitPreview(downloadUrl);
        setUploadingPortrait(false);
      } else {
        setFullBodyPreview(downloadUrl);
        setUploadingFullBody(false);
      }

      Alert.alert(
        'Image uploaded',
        'Preview updated. Save settings to keep the change.'
      );
    } catch (error) {
      console.error('[SettingsScreen] Image upload error:', error);
      if (type === 'portrait') {
        setUploadingPortrait(false);
      } else {
        setUploadingFullBody(false);
      }
      Alert.alert('Upload failed', 'Please try another image.');
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;

    setSavingSettings(true);
    try {
      const userDoc = doc(db, 'users', user.uid);
      await updateDoc(userDoc, {
        ageRange: ageRange ?? null,
        gender: gender ?? null,
        ethnicity: ethnicity ?? null,
        nationality: nationality.trim() ? nationality.trim() : null,
        defaultAspectRatio: defaultAspectRatio,
        portraitImageUrl: portraitPreview ?? null,
        fullBodyImageUrl: fullBodyPreview ?? null,
        updatedAt: serverTimestamp(),
      });

      await refreshProfile();

      // Update initial values after successful save
      setInitialValues({
        ageRange: ageRange ?? undefined,
        gender: gender ?? undefined,
        ethnicity: ethnicity ?? undefined,
        nationality: nationality.trim() ? nationality.trim() : '',
        defaultAspectRatio: defaultAspectRatio,
        portraitImageUrl: portraitPreview,
        fullBodyImageUrl: fullBodyPreview,
      });

      Alert.alert('Settings saved', 'Your preferences have been updated.');
    } catch (error) {
      console.error('[SettingsScreen] Failed to save settings', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveAutoGenerate = async () => {
    if (!user) return;

    setSavingAutoGenerate(true);
    try {
      const userDoc = doc(db, 'users', user.uid);
      await updateDoc(userDoc, {
        autoGenerateImages: autoGenerateImages,
        updatedAt: serverTimestamp(),
      });

      await refreshProfile();
      // Don't show alert for auto-generate as it saves immediately
    } catch (error) {
      console.error('[SettingsScreen] Failed to save auto-generate', error);
      Alert.alert('Error', 'Failed to save preference.');
      // Revert on error
      setAutoGenerateImages(!autoGenerateImages);
    } finally {
      setSavingAutoGenerate(false);
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Microphone permission is needed.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setRecording(true);
    } catch (error) {
      console.error('[SettingsScreen] Recording error:', error);
      Alert.alert('Error', 'Failed to start recording.');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setRecording(false);
      if (uri) {
        setRecordingUri(uri);
        setHasNewVoiceFile(true);
      }
    } catch (error) {
      console.error('[SettingsScreen] Stop recording error:', error);
      Alert.alert('Error', 'Failed to stop recording.');
    }
  };

  const handleVoiceFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets[0];

      // Check file size (should be at least 30 seconds of audio)
      if (asset.size && asset.size < 30000) {
        Alert.alert(
          'Audio too short',
          'Please upload at least 30 seconds of clear speech.'
        );
        return;
      }

      if (asset.uri) {
        setRecordingUri(asset.uri);
        setHasNewVoiceFile(true);
        Alert.alert(
          'File selected',
          'Audio file ready. Click "Save Personal Voice" to upload.'
        );
      }
    } catch (error) {
      console.error('[SettingsScreen] Voice file upload error:', error);
      Alert.alert('Error', 'Failed to select audio file. Please try again.');
    }
  };

  const uploadVoiceClone = async () => {
    if (!user || !recordingUri) {
      Alert.alert('Error', 'Please record or upload a voice sample first.');
      return;
    }

    setUploadingVoice(true);
    try {
      // Read the audio file
      const response = await fetch(recordingUri);
      const blob = await response.blob();

      // Check minimum duration (30 seconds)
      if (blob.size < 30000) {
        Alert.alert(
          'Audio too short',
          'Please upload at least 30 seconds of clear speech.'
        );
        setUploadingVoice(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', blob, 'voice-sample.webm');
      formData.append(
        'name',
        profile?.displayName
          ? `${profile.displayName} - AiAm Voice`
          : 'AiAm Voice Clone'
      );

      const apiResponse = await fetch(`${API_BASE_URL}/api/voice-clone`, {
        method: 'POST',
        body: formData,
      });

      const data = await apiResponse.json();
      if (!apiResponse.ok) {
        throw new Error(
          data?.detail ?? data?.error ?? 'Failed to clone voice.'
        );
      }

      if (!data?.voiceId) {
        throw new Error('Voice clone ID was not returned.');
      }

      const userDoc = doc(db, 'users', user.uid);
      await updateDoc(userDoc, {
        voiceCloneId: data.voiceId,
        voiceCloneName: data.voiceName ?? null,
        useMyVoiceByDefault: true, // Auto-enable when voice is uploaded
        updatedAt: serverTimestamp(),
      });

      await refreshProfile();
      setVoiceCloneId(data.voiceId);
      setVoiceCloneName(data.voiceName ?? null);
      setUseMyVoiceByDefault(true);
      setRecordingUri(null);
      setHasNewVoiceFile(false);
      Alert.alert(
        'Voice cloned successfully',
        'Your affirmations can now speak in your voice.'
      );
    } catch (error) {
      console.error('[SettingsScreen] Voice cloning failed', error);
      Alert.alert(
        'Voice cloning failed',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setUploadingVoice(false);
    }
  };

  const removeVoiceClone = async () => {
    if (!user) return;

    try {
      const userDoc = doc(db, 'users', user.uid);
      await updateDoc(userDoc, {
        voiceCloneId: null,
        voiceCloneName: null,
        useMyVoiceByDefault: false,
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      setVoiceCloneId(null);
      setVoiceCloneName(null);
      setUseMyVoiceByDefault(false);
      Alert.alert(
        'Voice clone removed',
        'You can upload a new sample whenever you are ready.'
      );
    } catch (error) {
      console.error('[SettingsScreen] Failed to remove voice clone', error);
      Alert.alert('Error', 'Failed to remove voice clone.');
    }
  };

  const handleUseMyVoiceToggle = async (checked: boolean) => {
    if (!user) return;

    try {
      const userDoc = doc(db, 'users', user.uid);
      await updateDoc(userDoc, {
        useMyVoiceByDefault: checked,
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      setUseMyVoiceByDefault(checked);
      Alert.alert(
        checked
          ? 'Using your voice by default'
          : 'AI voices enabled by default',
        checked
          ? 'All affirmations will use your cloned voice.'
          : 'You can choose voices per affirmation.'
      );
    } catch (error) {
      console.error(
        '[SettingsScreen] Failed to update voice preference',
        error
      );
      Alert.alert('Error', 'Failed to update preference.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style='dark' />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Customize your AiAm experience</Text>
        </View>

        {/* Image Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Image Preferences</Text>
          <Text style={styles.sectionDescription}>
            Share a little about yourself so AiAm can better match imagery
            before you upload personal reference photos.
          </Text>

          <View style={styles.preferencesGrid}>
            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Age Range</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.optionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      !ageRange && styles.optionButtonActive,
                    ]}
                    onPress={() => setAgeRange(undefined)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        !ageRange && styles.optionTextActive,
                      ]}
                    >
                      None
                    </Text>
                  </TouchableOpacity>
                  {AGE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        ageRange === option.value && styles.optionButtonActive,
                      ]}
                      onPress={() => setAgeRange(option.value)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          ageRange === option.value && styles.optionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Sex</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.optionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      !gender && styles.optionButtonActive,
                    ]}
                    onPress={() => setGender(undefined)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        !gender && styles.optionTextActive,
                      ]}
                    >
                      None
                    </Text>
                  </TouchableOpacity>
                  {GENDER_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        gender === option.value && styles.optionButtonActive,
                      ]}
                      onPress={() => setGender(option.value)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          gender === option.value && styles.optionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Ethnicity</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.optionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      !ethnicity && styles.optionButtonActive,
                    ]}
                    onPress={() => setEthnicity(undefined)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        !ethnicity && styles.optionTextActive,
                      ]}
                    >
                      None
                    </Text>
                  </TouchableOpacity>
                  {ETHNICITY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        ethnicity === option.value && styles.optionButtonActive,
                      ]}
                      onPress={() => setEthnicity(option.value)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          ethnicity === option.value && styles.optionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Nationality</Text>
              <TextInput
                style={styles.input}
                value={nationality}
                onChangeText={setNationality}
                placeholder='e.g., United States'
                placeholderTextColor='#9ca3af'
              />
            </View>

            <View style={styles.preferenceItem}>
              <Text style={styles.preferenceLabel}>Default Aspect Ratio</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.optionsRow}>
                  {['1:1', '16:9', '9:16', '4:3', '3:4'].map((ratio) => (
                    <TouchableOpacity
                      key={ratio}
                      style={[
                        styles.optionButton,
                        defaultAspectRatio === ratio &&
                          styles.optionButtonActive,
                      ]}
                      onPress={() => setDefaultAspectRatio(ratio)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          defaultAspectRatio === ratio &&
                            styles.optionTextActive,
                        ]}
                      >
                        {ratio}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>

          {/* Auto-generate Images Toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabelContainer}>
              <Text style={styles.toggleLabel}>
                Generate images automatically
              </Text>
              <Text style={styles.toggleDescription}>
                AiAm will pair each affirmation with artwork unless you turn
                this off.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, autoGenerateImages && styles.toggleActive]}
              onPress={() => {
                const newValue = !autoGenerateImages;
                setAutoGenerateImages(newValue);
                // Save immediately for auto-generate toggle
                handleSaveAutoGenerate();
              }}
            >
              <View
                style={[
                  styles.toggleThumb,
                  autoGenerateImages && styles.toggleThumbActive,
                ]}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              (savingSettings || !hasSettingsChanged) &&
                styles.saveButtonDisabled,
            ]}
            onPress={handleSaveSettings}
            disabled={savingSettings || !hasSettingsChanged}
          >
            {savingSettings ? (
              <ActivityIndicator color='#ffffff' />
            ) : (
              <Text style={styles.saveButtonText}>Save Preferences</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Personal Reference Images */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Reference Images</Text>
          <Text style={styles.sectionDescription}>
            Upload two clear images so AiAm can reference your likeness in
            future generations. Personal image generation adds +50 aiams per
            affirmation.
          </Text>

          <View style={styles.referenceImagesRow}>
            <View style={styles.referenceImageContainer}>
              <Text style={styles.referenceImageLabel}>
                Close-up / headshot
              </Text>
              {portraitPreview ? (
                <Image
                  source={{ uri: portraitPreview }}
                  style={styles.referenceImage}
                />
              ) : (
                <View style={styles.referenceImagePlaceholder}>
                  <Text style={styles.referenceImagePlaceholderText}>
                    Upload a clear photo of your face and shoulders.
                  </Text>
                </View>
              )}
              <View style={styles.referenceImageButtons}>
                <TouchableOpacity
                  style={styles.referenceImageButton}
                  onPress={() => handleImageUpload(false, 'portrait')}
                  disabled={uploadingPortrait}
                >
                  {uploadingPortrait ? (
                    <ActivityIndicator color='#3b82f6' />
                  ) : (
                    <Text style={styles.referenceImageButtonText}>📁</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.referenceImageContainer}>
              <Text style={styles.referenceImageLabel}>
                Full-body photograph
              </Text>
              {fullBodyPreview ? (
                <Image
                  source={{ uri: fullBodyPreview }}
                  style={styles.referenceImage}
                />
              ) : (
                <View style={styles.referenceImagePlaceholder}>
                  <Text style={styles.referenceImagePlaceholderText}>
                    Upload a full-body image showing your posture and outfit
                    style.
                  </Text>
                </View>
              )}
              <View style={styles.referenceImageButtons}>
                <TouchableOpacity
                  style={styles.referenceImageButton}
                  onPress={() => handleImageUpload(false, 'fullBody')}
                  disabled={uploadingFullBody}
                >
                  {uploadingFullBody ? (
                    <ActivityIndicator color='#3b82f6' />
                  ) : (
                    <Text style={styles.referenceImageButtonText}>📁</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Voice Personalization */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice Personalization</Text>
          <Text style={styles.sectionDescription}>
            Record or upload at least 30 seconds of clear speech so AiAm can
            read your affirmations in your own voice. Voice clone playback adds
            +20 aiams per affirmation.
          </Text>

          <View style={styles.tipsBox}>
            <Text style={styles.tipsText}>
              Tips:{'\n'}• Speak naturally with steady pacing and minimal
              background noise.{'\n'}• Reading 3–4 affirmation statements aloud
              usually hits the 30-second minimum.{'\n'}• You can upload multiple
              samples over time to improve accuracy.
            </Text>
          </View>

          <View style={styles.voiceButtonsRow}>
            <TouchableOpacity
              style={[
                styles.voiceButton,
                recording && styles.voiceButtonRecording,
              ]}
              onPress={recording ? stopRecording : startRecording}
            >
              <Text style={styles.voiceButtonText}>
                {recording ? '⏹️ Stop' : '🎤 Record'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.voiceButton}
              onPress={handleVoiceFileUpload}
            >
              <Text style={styles.voiceButtonText}>📁 Upload</Text>
            </TouchableOpacity>
            {recordingUri && (
              <TouchableOpacity
                style={styles.voiceButton}
                onPress={() => {
                  setRecordingUri(null);
                  setHasNewVoiceFile(false);
                }}
              >
                <Text style={styles.voiceButtonText}>🗑️ Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {recordingUri && (
            <View style={styles.audioPreview}>
              <Text style={styles.audioPreviewLabel}>Preview recording</Text>
              <Text style={styles.audioPreviewText}>
                Audio file ready ({recordingUri ? 'Recorded' : 'Uploaded'})
              </Text>
            </View>
          )}

          <View style={styles.voiceActionsRow}>
            <TouchableOpacity
              style={[
                styles.saveVoiceButton,
                (uploadingVoice || (!recordingUri && !hasNewVoiceFile)) &&
                  styles.saveVoiceButtonDisabled,
              ]}
              onPress={uploadVoiceClone}
              disabled={uploadingVoice || !recordingUri}
            >
              {uploadingVoice ? (
                <ActivityIndicator color='#ffffff' />
              ) : (
                <Text style={styles.saveVoiceButtonText}>
                  Save Personal Voice
                </Text>
              )}
            </TouchableOpacity>
            {voiceCloneId && (
              <View style={styles.voiceInfo}>
                <Text style={styles.voiceInfoText}>
                  Current: {voiceCloneName ?? voiceCloneId}
                </Text>
                <TouchableOpacity
                  style={styles.removeVoiceButton}
                  onPress={removeVoiceClone}
                >
                  <Text style={styles.removeVoiceButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {voiceCloneId && (
            <View style={styles.voiceToggleSection}>
              <View style={styles.toggleLabelContainer}>
                <Text style={styles.toggleLabel}>Use my voice by default</Text>
                <Text style={styles.toggleDescription}>
                  When enabled, all affirmations will use your cloned voice by
                  default. You can still toggle this per affirmation.
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.toggle,
                  useMyVoiceByDefault && styles.toggleActive,
                ]}
                onPress={() => handleUseMyVoiceToggle(!useMyVoiceByDefault)}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    useMyVoiceByDefault && styles.toggleThumbActive,
                  ]}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
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
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  preferencesGrid: {
    gap: 20,
    marginBottom: 24,
  },
  preferenceItem: {
    marginBottom: 16,
  },
  preferenceLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  optionButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  optionText: {
    fontSize: 14,
    color: '#6b7280',
  },
  optionTextActive: {
    color: '#ffffff',
    fontWeight: '600',
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
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 16,
  },
  toggleLabelContainer: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#d1d5db',
    justifyContent: 'center',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#3b82f6',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
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
  referenceImagesRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  referenceImageContainer: {
    flex: 1,
  },
  referenceImageLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 12,
  },
  referenceImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginBottom: 12,
  },
  referenceImagePlaceholder: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginBottom: 12,
  },
  referenceImagePlaceholderText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  referenceImageButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  referenceImageButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  referenceImageButtonText: {
    fontSize: 20,
  },
  tipsBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tipsText: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
  },
  voiceButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  voiceButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  voiceButtonRecording: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  voiceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  audioPreview: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  audioPreviewLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  audioPreviewText: {
    fontSize: 12,
    color: '#6b7280',
  },
  voiceActionsRow: {
    marginBottom: 20,
  },
  saveVoiceButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveVoiceButtonDisabled: {
    opacity: 0.6,
  },
  saveVoiceButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  voiceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  voiceInfoText: {
    fontSize: 14,
    color: '#6b7280',
  },
  removeVoiceButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removeVoiceButtonText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  voiceToggleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
});

// Default export for compatibility
export default SettingsScreen;
