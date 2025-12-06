// src/screens/AffirmationScreen.tsx
// Mobile version of your web app's affirmation modal
// Full functionality: GPT affirmation, Replicate image, ElevenLabs voice, bookmark, personalization

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../providers/AuthProvider';
import { Category } from '../components/CategoryCard';
import { db, storage } from '../firebase';
import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  getDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AudioPlayer, useAudioPlayer } from 'expo-audio';

interface AffirmationScreenProps {
  category: Category | null;
  onClose: () => void;
  onSave?: () => void;
}

interface VoiceOption {
  id: string;
  name: string;
  description?: string;
}

export function AffirmationScreen({
  category,
  onClose,
  onSave,
}: AffirmationScreenProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [affirmation, setAffirmation] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [affirmationDocId, setAffirmationDocId] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);

  // Voice and personalization
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [useMyImage, setUseMyImage] = useState(false);
  const [useMyVoice, setUseMyVoice] = useState(false);
  const [autoGenerateImages, setAutoGenerateImages] = useState(
    profile?.autoGenerateImages ?? true
  );
  const [voiceDropdownOpen, setVoiceDropdownOpen] = useState(false);

  const audioPlayer = useAudioPlayer();
  const audioUrlsRef = useRef<Record<string, string>>({});

  // Get API URL - IMPORTANT: Update this with your web app's actual URL
  // You can set EXPO_PUBLIC_API_URL in a .env file or replace the default below
  // Example: 'https://your-app.vercel.app' or 'https://aiam.com'
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.aiam.space';

  const hasPersonalImages = Boolean(
    profile?.portraitImageUrl || profile?.fullBodyImageUrl
  );
  const hasPersonalVoice = Boolean(profile?.voiceCloneId);

  // Sync autoGenerateImages with profile
  useEffect(() => {
    if (profile) {
      setAutoGenerateImages(profile.autoGenerateImages ?? true);
    }
  }, [profile?.autoGenerateImages]);

  // Load voices on mount
  useEffect(() => {
    if (user && category) {
      loadVoices();
      generateAffirmation();
    }
  }, [user, category]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioPlayer.playing) {
        audioPlayer.pause();
      }
    };
  }, [audioPlayer]);

  // Close voice dropdown when clicking outside
  useEffect(() => {
    if (voiceDropdownOpen) {
      // Close dropdown after a short delay if user doesn't interact
      const timer = setTimeout(() => {
        // This will be handled by the dropdown's onPress
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [voiceDropdownOpen]);

  const loadVoices = async () => {
    setIsLoadingVoices(true);
    try {
      const response = await fetch(`${API_URL}/api/voices`);
      if (!response.ok) throw new Error('Failed to load voices');
      const data = await response.json();
      const options =
        data.voices?.map((voice: any) => ({
          id: voice.voice_id ?? voice.id,
          name: voice.name,
          description: voice.description ?? voice.labels?.description ?? '',
        })) ?? [];

      // Add cloned voice if available
      if (profile?.voiceCloneId) {
        options.unshift({
          id: profile.voiceCloneId,
          name: profile.voiceCloneName ?? 'Your Voice',
          description: 'Your personal cloned voice',
        });
      }

      setVoices(options);
      if (options.length > 0) {
        setSelectedVoice(
          profile?.useMyVoiceByDefault && profile?.voiceCloneId
            ? profile.voiceCloneId
            : options[0].id
        );
      }
    } catch (error) {
      console.error('[AffirmationScreen] Failed to load voices', error);
    } finally {
      setIsLoadingVoices(false);
    }
  };

  const generateAffirmation = async () => {
    if (!category || !user || !profile) return;

    setIsGenerating(true);
    setError(null);
    setAffirmation('');
    setGeneratedImage(null);
    setAffirmationDocId(null);

    try {
      const response = await fetch(`${API_URL}/api/generate-affirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: category.title,
          categoryId: category.id,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          errorText.includes('<')
            ? 'API endpoint not found. Please update API_URL in AffirmationScreen.tsx'
            : 'Failed to generate affirmation'
        );
      }

      const data = await response.json();
      if (!data.affirmation) {
        throw new Error('No affirmation returned');
      }

      setAffirmation(data.affirmation);

      // Save affirmation to Firestore
      const docRef = doc(
        db,
        'users',
        user.uid,
        'affirmations',
        Date.now().toString()
      );

      await setDoc(docRef, {
        affirmation: data.affirmation,
        categoryId: category.id,
        categoryTitle: category.title,
        imageUrl: null,
        favorite: false,
        audioUrls: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setAffirmationDocId(docRef.id);

      // Deduct base credits (20 - includes image)
      const baseCost = 20;
      const newCredits = profile.credits - baseCost;
      await updateDoc(doc(db, 'users', user.uid), {
        credits: newCredits,
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();

      // Auto-generate image if enabled
      if (autoGenerateImages) {
        const shouldUsePersonalImages = hasPersonalImages && !useMyImage;
        if (shouldUsePersonalImages) {
          setUseMyImage(true);
        }
        generateImage({
          silent: true,
          forceUsePersonalImages: shouldUsePersonalImages,
        });
      }
    } catch (err) {
      console.error('[AffirmationScreen] Generate error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to generate affirmation. Please try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImage = async (options?: {
    silent?: boolean;
    forceUsePersonalImages?: boolean;
  }) => {
    if (!affirmation || !category || !user || !profile) return;

    const shouldUsePersonalImages =
      options?.forceUsePersonalImages !== undefined
        ? options.forceUsePersonalImages
        : useMyImage && hasPersonalImages;

    if (shouldUsePersonalImages && profile.credits < 50) {
      if (!options?.silent) {
        Alert.alert(
          'Insufficient aiams',
          `Personal image generation requires 50 aiams. You currently have ${profile.credits} aiams.`
        );
      }
      return;
    }

    setIsGeneratingImage(true);

    try {
      const response = await fetch(`${API_URL}/api/predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affirmation,
          category: category.title,
          categoryId: category.id,
          useUserImages: shouldUsePersonalImages,
          userImages: shouldUsePersonalImages
            ? {
                portrait: profile.portraitImageUrl,
                fullBody: profile.fullBodyImageUrl,
              }
            : undefined,
          aspectRatio: profile?.defaultAspectRatio ?? '1:1',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.error ?? data?.detail ?? 'Failed to generate image'
        );
      }

      if (data.imageUrl) {
        // Persist image to Firebase Storage
        if (affirmationDocId) {
          const imageResponse = await fetch(data.imageUrl);
          const blob = await imageResponse.blob();
          const storageRef = ref(
            storage,
            `users/${user.uid}/affirmations/${affirmationDocId}/image.jpg`
          );
          await uploadBytes(storageRef, blob);
          const downloadUrl = await getDownloadURL(storageRef);

          await updateDoc(
            doc(db, 'users', user.uid, 'affirmations', affirmationDocId),
            {
              imageUrl: downloadUrl,
              updatedAt: serverTimestamp(),
            }
          );

          setGeneratedImage(downloadUrl);
        } else {
          setGeneratedImage(data.imageUrl);
        }

        // Charge extra for personal images if not auto-generated
        if (!options?.silent && shouldUsePersonalImages) {
          const newCredits = profile.credits - 50;
          await updateDoc(doc(db, 'users', user.uid), {
            credits: newCredits,
            updatedAt: serverTimestamp(),
          });
          await refreshProfile();
        }
      }
    } catch (err) {
      console.error('[AffirmationScreen] Image generation error:', err);
      if (!options?.silent) {
        Alert.alert(
          'Image generation failed',
          err instanceof Error ? err.message : 'Failed to generate image'
        );
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const speakAffirmation = async () => {
    if (!affirmation) return;

    if (isSpeaking) {
      await stopAudio();
      return;
    }

    let voiceToUse =
      useMyVoice && hasPersonalVoice ? profile?.voiceCloneId : selectedVoice;

    if (!voiceToUse) {
      Alert.alert(
        'Select a voice',
        'Please choose a voice to play the affirmation.'
      );
      return;
    }

    // Check if audio is cached
    const cachedUrl = audioUrlsRef.current[voiceToUse];
    if (cachedUrl) {
      playAudio(cachedUrl);
      return;
    }

    // Generate audio
    try {
      setIsSpeaking(true);
      const response = await fetch(`${API_URL}/api/text-to-speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: affirmation,
          voiceId: voiceToUse,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate audio');

      const blob = await response.blob();

      // Cache in Firebase if we have docId
      if (affirmationDocId && user) {
        const storageRef = ref(
          storage,
          `users/${user.uid}/affirmations/${affirmationDocId}/audio/${voiceToUse}.mp3`
        );
        await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);
        await updateDoc(
          doc(db, 'users', user.uid, 'affirmations', affirmationDocId),
          {
            [`audioUrls.${voiceToUse}`]: downloadUrl,
            updatedAt: serverTimestamp(),
          }
        );
        audioUrlsRef.current[voiceToUse] = downloadUrl;
        playAudio(downloadUrl);
      } else {
        // For React Native, we need to create a local file URI
        // For now, upload to Firebase Storage first
        if (user) {
          const tempRef = ref(
            storage,
            `users/${user.uid}/temp/audio/${Date.now()}.mp3`
          );
          await uploadBytes(tempRef, blob);
          const tempUrl = await getDownloadURL(tempRef);
          audioUrlsRef.current[voiceToUse] = tempUrl;
          playAudio(tempUrl);
        }
      }
    } catch (err) {
      console.error('[AffirmationScreen] Audio error:', err);
      Alert.alert(
        'Audio failed',
        'Unable to generate audio. Please try again.'
      );
      setIsSpeaking(false);
    }
  };

  const playAudio = async (url: string) => {
    try {
      console.log('[AffirmationScreen] Playing audio from URL:', url);

      // Stop any current playback
      if (audioPlayer.playing) {
        await audioPlayer.pause();
        await audioPlayer.seekTo(0);
      }

      // Replace the current source with new URL
      audioPlayer.replace(url);

      // Wait a moment for the source to load, then play
      await new Promise((resolve) => setTimeout(resolve, 200));
      await audioPlayer.play();
      setIsSpeaking(true);
      console.log('[AffirmationScreen] Audio playback started');
    } catch (err) {
      console.error('[AffirmationScreen] Playback error:', err);
      setIsSpeaking(false);
      Alert.alert('Playback Error', 'Unable to play audio. Please try again.');
    }
  };

  // Monitor audio playback status
  useEffect(() => {
    if (!audioPlayer || !isSpeaking) return;

    const checkStatus = setInterval(() => {
      try {
        // Check if audio finished playing
        if (!audioPlayer.playing && isSpeaking) {
          console.log('[AffirmationScreen] Audio finished playing');
          setIsSpeaking(false);
        }
      } catch (err) {
        console.error('[AffirmationScreen] Status check error:', err);
      }
    }, 500);

    return () => clearInterval(checkStatus);
  }, [audioPlayer, isSpeaking]);

  const stopAudio = async () => {
    try {
      if (audioPlayer.playing) {
        await audioPlayer.pause();
        await audioPlayer.seekTo(0);
      }
    } catch (err) {
      console.error('[AffirmationScreen] Stop audio error:', err);
    }
    setIsSpeaking(false);
  };

  const toggleFavorite = async () => {
    if (!affirmationDocId || !user || !affirmation) {
      Alert.alert('Error', 'No affirmation to save');
      return;
    }

    setIsSavingFavorite(true);
    try {
      const newFavorite = !isFavorite;

      // Update the affirmation document with favorite status
      // Also ensure image is saved if it exists
      const updateData: any = {
        favorite: newFavorite,
        updatedAt: serverTimestamp(),
      };

      // If we have a generated image, make sure it's saved
      if (generatedImage) {
        updateData.imageUrl = generatedImage;
      }

      await updateDoc(
        doc(db, 'users', user.uid, 'affirmations', affirmationDocId),
        updateData
      );

      setIsFavorite(newFavorite);

      // Refresh profile to update saved count
      await refreshProfile();

      Alert.alert(
        newFavorite ? 'Favorited!' : 'Removed from favorites',
        newFavorite
          ? 'Affirmation saved to your favorites.'
          : 'Affirmation removed from favorites.'
      );
    } catch (err) {
      console.error('[AffirmationScreen] Favorite error:', err);
      Alert.alert('Error', 'Failed to update favorite status');
    } finally {
      setIsSavingFavorite(false);
    }
  };

  if (!category) return null;

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style='dark' />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{category.title}</Text>
          <View style={styles.closeButton} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          onScrollBeginDrag={() => setVoiceDropdownOpen(false)}
        >
          {isGenerating ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size='large' color='#3b82f6' />
              <Text style={styles.loadingText}>
                Generating your affirmation...
              </Text>
            </View>
          ) : error ? (
            <View style={styles.centerContent}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={generateAffirmation}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : affirmation ? (
            <>
              {/* Affirmation Text */}
              <View style={styles.affirmationContainer}>
                <Text style={styles.affirmationText}>{affirmation}</Text>
              </View>

              {/* Generated Image */}
              {isGeneratingImage ? (
                <View style={styles.imagePlaceholder}>
                  <ActivityIndicator size='large' color='#3b82f6' />
                  <Text style={styles.imagePlaceholderText}>
                    Generating image...
                  </Text>
                </View>
              ) : generatedImage ? (
                <Image
                  source={{ uri: generatedImage }}
                  style={styles.generatedImage}
                  resizeMode='cover'
                />
              ) : null}

              {/* Action Buttons Row - Icon Only */}
              <View style={styles.actionsRow}>
                {/* Play/Stop Button */}
                <TouchableOpacity
                  style={[styles.iconButton, styles.playButton]}
                  onPress={speakAffirmation}
                  disabled={isLoadingVoices || !affirmation}
                >
                  <Text style={styles.iconButtonText}>
                    {isSpeaking ? '⏸️' : '▶️'}
                  </Text>
                </TouchableOpacity>

                {/* Favorite Button */}
                <TouchableOpacity
                  style={[styles.iconButton, styles.favoriteButton]}
                  onPress={toggleFavorite}
                  disabled={isSavingFavorite || !affirmation}
                >
                  <Text style={styles.iconButtonText}>
                    {isFavorite ? '⭐' : '☆'}
                  </Text>
                </TouchableOpacity>

                {/* Voice Selector Button */}
                <View style={styles.voiceSelectorContainer}>
                  <TouchableOpacity
                    style={[styles.iconButton, styles.voiceButton]}
                    onPress={() => setVoiceDropdownOpen(!voiceDropdownOpen)}
                    disabled={isLoadingVoices || voices.length === 0}
                  >
                    <Text style={styles.iconButtonText}>🎤</Text>
                  </TouchableOpacity>

                  {/* Voice Dropdown */}
                  {voiceDropdownOpen && (
                    <View style={styles.voiceDropdown}>
                      <ScrollView style={styles.voiceDropdownScroll}>
                        {/* My Voice Option */}
                        {hasPersonalVoice && profile?.voiceCloneId && (
                          <TouchableOpacity
                            style={[
                              styles.voiceDropdownItem,
                              useMyVoice && styles.voiceDropdownItemActive,
                            ]}
                            onPress={() => {
                              setUseMyVoice(true);
                              setVoiceDropdownOpen(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.voiceDropdownText,
                                useMyVoice && styles.voiceDropdownTextActive,
                              ]}
                            >
                              🎙️ My Voice
                            </Text>
                            {useMyVoice && (
                              <Text style={styles.checkmark}>✓</Text>
                            )}
                          </TouchableOpacity>
                        )}

                        {/* Other Voices */}
                        {voices.map((voice) => (
                          <TouchableOpacity
                            key={voice.id}
                            style={[
                              styles.voiceDropdownItem,
                              !useMyVoice &&
                                selectedVoice === voice.id &&
                                styles.voiceDropdownItemActive,
                            ]}
                            onPress={() => {
                              setSelectedVoice(voice.id);
                              setUseMyVoice(false);
                              setVoiceDropdownOpen(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.voiceDropdownText,
                                !useMyVoice &&
                                  selectedVoice === voice.id &&
                                  styles.voiceDropdownTextActive,
                              ]}
                            >
                              {voice.name}
                            </Text>
                            {!useMyVoice && selectedVoice === voice.id && (
                              <Text style={styles.checkmark}>✓</Text>
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Image Generate Button */}
                <TouchableOpacity
                  style={[
                    styles.iconButton,
                    styles.imageButton,
                    (isGeneratingImage || generatedImage) &&
                      styles.imageButtonDisabled,
                  ]}
                  onPress={() => generateImage()}
                  disabled={
                    isGeneratingImage ||
                    !affirmation ||
                    (autoGenerateImages && generatedImage !== null)
                  }
                >
                  <Text style={styles.iconButtonText}>
                    {isGeneratingImage ? '⏳' : '🖼️'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Personalization Dropdown */}
              <TouchableOpacity
                style={styles.personalizeHeader}
                onPress={() => setPersonalizeOpen(!personalizeOpen)}
              >
                <Text style={styles.personalizeHeaderText}>
                  Personalize your experience
                </Text>
                <Text style={styles.personalizeChevron}>
                  {personalizeOpen ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>

              {personalizeOpen && (
                <View style={styles.personalizeSection}>
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Use My Image</Text>
                    <TouchableOpacity
                      style={[
                        styles.toggle,
                        useMyImage && styles.toggleActive,
                        !hasPersonalImages && styles.toggleDisabled,
                      ]}
                      onPress={() =>
                        hasPersonalImages && setUseMyImage(!useMyImage)
                      }
                      disabled={!hasPersonalImages}
                    >
                      <View
                        style={[
                          styles.toggleThumb,
                          useMyImage && styles.toggleThumbActive,
                        ]}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Use My Voice</Text>
                    <TouchableOpacity
                      style={[
                        styles.toggle,
                        useMyVoice && styles.toggleActive,
                        !hasPersonalVoice && styles.toggleDisabled,
                      ]}
                      onPress={() =>
                        hasPersonalVoice && setUseMyVoice(!useMyVoice)
                      }
                      disabled={!hasPersonalVoice}
                    >
                      <View
                        style={[
                          styles.toggleThumb,
                          useMyVoice && styles.toggleThumbActive,
                        ]}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          ) : null}
        </ScrollView>

        {/* Footer Actions */}
        {affirmation && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.regenerateButton]}
              onPress={generateAffirmation}
              disabled={isGenerating}
            >
              <Text style={styles.buttonText}>🔄 Regenerate</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    zIndex: 1000,
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6b7280',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  affirmationContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    minHeight: 120,
    justifyContent: 'center',
  },
  affirmationText: {
    fontSize: 20,
    lineHeight: 32,
    color: '#1f2937',
    textAlign: 'center',
    fontWeight: '500',
  },
  imagePlaceholder: {
    height: 300,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  imagePlaceholderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  generatedImage: {
    width: '100%',
    height: 300,
    borderRadius: 16,
    marginBottom: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  playButton: {
    backgroundColor: '#dbeafe',
  },
  favoriteButton: {
    backgroundColor: '#fee2e2',
  },
  voiceButton: {
    backgroundColor: '#f3e8ff',
  },
  imageButton: {
    backgroundColor: '#fef3c7',
  },
  imageButtonDisabled: {
    opacity: 0.5,
  },
  iconButtonText: {
    fontSize: 24,
  },
  voiceSelectorContainer: {
    position: 'relative',
  },
  voiceDropdown: {
    position: 'absolute',
    top: 60,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 200,
    maxHeight: 300,
    zIndex: 1000,
  },
  voiceDropdownScroll: {
    maxHeight: 300,
  },
  voiceDropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  voiceDropdownItemActive: {
    backgroundColor: '#eff6ff',
  },
  voiceDropdownText: {
    fontSize: 14,
    color: '#1f2937',
  },
  voiceDropdownTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  personalizeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  personalizeHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  personalizeChevron: {
    fontSize: 12,
    color: '#6b7280',
  },
  personalizeSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#1f2937',
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
  toggleDisabled: {
    opacity: 0.5,
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
  generateImageButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  generateImageButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regenerateButton: {
    backgroundColor: '#f3f4f6',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
});
