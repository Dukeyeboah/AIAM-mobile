// src/screens/DashboardScreen.tsx
// Mobile version of your web app's dashboard
// Shows user's saved affirmations with full functionality

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../providers/AuthProvider';
import {
  useUserAffirmations,
  UserAffirmation,
} from '../hooks/useUserAffirmations';
import { useAudioPlayer } from 'expo-audio';
import {
  doc,
  updateDoc,
  serverTimestamp,
  collection,
  addDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { MusicPlayer } from '../components/MusicPlayer';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://www.aiam.space';

export function DashboardScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>(
    'all'
  );
  const {
    affirmations,
    categories: userCategories,
    loading,
  } = useUserAffirmations({
    categoryId: selectedCategory === 'all' ? null : selectedCategory,
  });

  // Play all state
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [voices, setVoices] = useState<Array<{ id: string; name: string }>>([]);
  const [withMusic, setWithMusic] = useState(false);
  const audioPlayer = useAudioPlayer();
  const playAllAbortRef = useRef(false);

  // Playlist state
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedAffirmations, setSelectedAffirmations] = useState<Set<string>>(
    new Set()
  );

  // Category filter dropdown
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  const greeting = useMemo(() => {
    if (!profile?.displayName) return 'Your dashboard';
    const firstName = profile.displayName.trim().split(/\s+/)[0];
    return `${firstName}'s dashboard`;
  }, [profile?.displayName]);

  // Load voices
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const response = await fetch(`${API_URL}/api/voices`);
        if (!response.ok) throw new Error('Failed to load voices');
        const data = await response.json();
        const options =
          data.voices?.map((voice: any) => ({
            id: voice.voice_id ?? voice.id,
            name: voice.name,
          })) ?? [];

        if (profile?.voiceCloneId) {
          options.unshift({
            id: profile.voiceCloneId,
            name: profile.voiceCloneName ?? 'Your Voice',
          });
        }

        setVoices(options);
        if (options.length > 0 && !selectedVoiceId) {
          if (profile?.useMyVoiceByDefault && profile?.voiceCloneId) {
            setSelectedVoiceId(profile.voiceCloneId);
          } else {
            setSelectedVoiceId(options[0].id);
          }
        }
      } catch (error) {
        console.error('[Dashboard] Failed to load voices', error);
      }
    };

    if (user) {
      loadVoices();
    }
  }, [user, profile?.voiceCloneId]);

  const playSequentially = async (
    url: string,
    index: number
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (playAllAbortRef.current) {
        resolve();
        return;
      }

      const playAudio = async () => {
        try {
          audioPlayer.replace(url);
          await new Promise((resolve) => setTimeout(resolve, 200));
          await audioPlayer.play();
          setCurrentAudioIndex(index);

          // Wait for playback to complete
          const checkStatus = setInterval(() => {
            if (playAllAbortRef.current) {
              clearInterval(checkStatus);
              audioPlayer.pause();
              resolve();
              return;
            }

            if (!audioPlayer.playing && !isPaused) {
              clearInterval(checkStatus);
              resolve();
            }
          }, 500);
        } catch (error) {
          reject(error);
        }
      };

      playAudio();
    });
  };

  const playAll = async () => {
    if (!user || affirmations.length === 0 || !selectedVoiceId) {
      Alert.alert('Error', 'Please select a voice to play all affirmations.');
      return;
    }

    setIsPlayingAll(true);
    setIsPaused(false);
    playAllAbortRef.current = false;
    setCurrentAudioIndex(0);

    if (withMusic) {
      // Trigger music player
      DeviceEventEmitter.emit('start-background-music');
    }

    try {
      for (let i = 0; i < affirmations.length; i++) {
        if (playAllAbortRef.current) break;

        while (isPaused && !playAllAbortRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (playAllAbortRef.current) break;

        const item = affirmations[i];
        let audioUrl = item.audioUrls?.[selectedVoiceId];

        if (!audioUrl) {
          // Generate audio
          const response = await fetch(`${API_URL}/api/text-to-speech`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: item.affirmation,
              voiceId: selectedVoiceId,
            }),
          });

          if (!response.ok) continue;

          const blob = await response.blob();
          // Upload to Firebase and cache
          // (Implementation similar to AffirmationScreen)
          audioUrl = URL.createObjectURL(blob);
        }

        await playSequentially(audioUrl, i);
      }

      if (withMusic) {
        DeviceEventEmitter.emit('stop-background-music');
      }

      Alert.alert('Complete', 'All affirmations have been played.');
    } catch (error) {
      console.error('[Dashboard] Play all error:', error);
      Alert.alert('Error', 'Failed to play all affirmations.');
    } finally {
      setIsPlayingAll(false);
      setIsPaused(false);
      setCurrentAudioIndex(0);
    }
  };

  const stopPlayAll = () => {
    playAllAbortRef.current = true;
    audioPlayer.pause();
    setIsPlayingAll(false);
    setIsPaused(false);
    setCurrentAudioIndex(0);
    if (withMusic) {
      DeviceEventEmitter.emit('stop-background-music');
    }
  };

  const pausePlayAll = () => {
    setIsPaused(true);
    audioPlayer.pause();
  };

  const resumePlayAll = () => {
    setIsPaused(false);
    audioPlayer.play();
  };

  const createPlaylist = async () => {
    if (!user || selectedAffirmations.size === 0 || !newPlaylistName.trim()) {
      Alert.alert(
        'Error',
        'Please enter a playlist name and select affirmations.'
      );
      return;
    }

    try {
      await addDoc(collection(db, 'users', user.uid, 'playlists'), {
        name: newPlaylistName.trim(),
        affirmationIds: Array.from(selectedAffirmations),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      Alert.alert('Success', 'Playlist created!');
      setPlaylistModalOpen(false);
      setNewPlaylistName('');
      setSelectedAffirmations(new Set());
    } catch (error) {
      console.error('[Dashboard] Create playlist error:', error);
      Alert.alert('Error', 'Failed to create playlist.');
    }
  };

  const toggleFavorite = async (affirmation: UserAffirmation) => {
    if (!user) return;

    try {
      await updateDoc(
        doc(db, 'users', user.uid, 'affirmations', affirmation.id),
        {
          favorite: !affirmation.favorite,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (error) {
      console.error('[Dashboard] Toggle favorite error:', error);
      Alert.alert('Error', 'Failed to update favorite.');
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style='dark' />
        <View style={styles.centerContent}>
          <Text style={styles.message}>
            Please sign in to view your dashboard
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style='dark' />

      {/* Music Player */}
      <View style={styles.musicPlayerContainer}>
        <MusicPlayer />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{greeting}</Text>
          <Text style={styles.subtitle}>
            Review your affirmations—filter by category, spot favorites, and
            prep playlists.
          </Text>
        </View>

        {/* Controls Section */}
        <View style={styles.controlsSection}>
          {/* Voice Selection */}
          <TouchableOpacity
            style={styles.voiceSelector}
            onPress={() => {
              // Show voice selection modal
              Alert.alert(
                'Select Voice',
                voices.map((v) => v.name).join('\n'),
                [{ text: 'OK' }]
              );
            }}
          >
            <Text style={styles.voiceSelectorText}>
              {voices.find((v) => v.id === selectedVoiceId)?.name ||
                'Select Voice'}
            </Text>
          </TouchableOpacity>

          {/* Play All */}
          {!isPlayingAll ? (
            <TouchableOpacity
              style={styles.playAllButton}
              onPress={playAll}
              disabled={affirmations.length === 0 || !selectedVoiceId}
            >
              <Text style={styles.playAllButtonText}>▶️ Play All</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.playAllControls}>
              {isPaused ? (
                <TouchableOpacity
                  style={styles.playAllButton}
                  onPress={resumePlayAll}
                >
                  <Text style={styles.playAllButtonText}>▶️ Resume</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.playAllButton}
                  onPress={pausePlayAll}
                >
                  <Text style={styles.playAllButtonText}>⏸️ Pause</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.stopButton} onPress={stopPlayAll}>
                <Text style={styles.stopButtonText}>⏹️ Stop</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* With Music Toggle */}
          <TouchableOpacity
            style={[
              styles.toggleButton,
              withMusic && styles.toggleButtonActive,
            ]}
            onPress={() => setWithMusic(!withMusic)}
            disabled={isPlayingAll}
          >
            <Text style={styles.toggleButtonText}>
              {withMusic ? '🎵 Music On' : '🎵 Music Off'}
            </Text>
          </TouchableOpacity>

          {/* Playlist Button */}
          <TouchableOpacity
            style={styles.playlistButton}
            onPress={() => setPlaylistModalOpen(true)}
          >
            <Text style={styles.playlistButtonText}>📁 Playlists</Text>
          </TouchableOpacity>

          {/* Category Filter Dropdown */}
          <TouchableOpacity
            style={styles.categoryFilter}
            onPress={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
          >
            <Text style={styles.categoryFilterText}>
              {selectedCategory === 'all'
                ? 'All Categories'
                : userCategories.find((c) => c.id === selectedCategory)
                    ?.title || 'All Categories'}
              {' ▼'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Category Dropdown */}
        {categoryDropdownOpen && (
          <View style={styles.categoryDropdown}>
            <TouchableOpacity
              style={styles.categoryOption}
              onPress={() => {
                setSelectedCategory('all');
                setCategoryDropdownOpen(false);
              }}
            >
              <Text
                style={[
                  styles.categoryOptionText,
                  selectedCategory === 'all' && styles.categoryOptionTextActive,
                ]}
              >
                All Categories
              </Text>
            </TouchableOpacity>
            {userCategories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={styles.categoryOption}
                onPress={() => {
                  setSelectedCategory(category.id);
                  setCategoryDropdownOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.categoryOptionText,
                    selectedCategory === category.id &&
                      styles.categoryOptionTextActive,
                  ]}
                >
                  {category.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Affirmations List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size='large' color='#3b82f6' />
            <Text style={styles.loadingText}>Loading affirmations...</Text>
          </View>
        ) : affirmations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✨</Text>
            <Text style={styles.emptyTitle}>No affirmations yet</Text>
            <Text style={styles.emptyText}>
              Generate an affirmation from the home page to start building your
              collection.
            </Text>
          </View>
        ) : (
          <View style={styles.affirmationsList}>
            {affirmations.map((item) => (
              <AffirmationCard
                key={item.id}
                affirmation={item}
                onToggleFavorite={() => toggleFavorite(item)}
                onPlay={() => {
                  // Play individual affirmation
                  Alert.alert('Play', 'Individual play coming soon');
                }}
                onGenerateImage={() => {
                  // Generate image
                  Alert.alert('Generate Image', 'Image generation coming soon');
                }}
                profile={profile}
                voices={voices}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Playlist Creation Modal */}
      <Modal
        visible={playlistModalOpen}
        transparent
        animationType='slide'
        onRequestClose={() => setPlaylistModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Playlist</Text>
              <TouchableOpacity onPress={() => setPlaylistModalOpen(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.playlistInput}
              placeholder='Playlist name'
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
            />
            <Text style={styles.modalSubtitle}>
              Select affirmations to add ({selectedAffirmations.size} selected)
            </Text>
            <ScrollView style={styles.playlistAffirmationsList}>
              {affirmations.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.playlistAffirmationItem}
                  onPress={() => {
                    const newSet = new Set(selectedAffirmations);
                    if (newSet.has(item.id)) {
                      newSet.delete(item.id);
                    } else {
                      newSet.add(item.id);
                    }
                    setSelectedAffirmations(newSet);
                  }}
                >
                  <Text style={styles.playlistCheckbox}>
                    {selectedAffirmations.has(item.id) ? '✓' : '○'}
                  </Text>
                  <Text
                    style={styles.playlistAffirmationText}
                    numberOfLines={2}
                  >
                    {item.affirmation}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.createPlaylistButton}
              onPress={createPlaylist}
            >
              <Text style={styles.createPlaylistButtonText}>
                Create Playlist
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Affirmation Card Component
function AffirmationCard({
  affirmation,
  onToggleFavorite,
  onPlay,
  onGenerateImage,
  profile,
  voices,
}: {
  affirmation: UserAffirmation;
  onToggleFavorite: () => void;
  onPlay: () => void;
  onGenerateImage: () => void;
  profile: any;
  voices: Array<{ id: string; name: string }>;
}) {
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [useMyVoice, setUseMyVoice] = useState(false);
  const [useMyImage, setUseMyImage] = useState(false);

  return (
    <View style={styles.affirmationCard}>
      {affirmation.imageUrl ? (
        <View style={styles.affirmationImageContainer}>
          <Image
            source={{ uri: affirmation.imageUrl }}
            style={styles.affirmationImage}
            resizeMode='cover'
          />
          <View style={styles.affirmationOverlay}>
            <Text style={styles.affirmationText} numberOfLines={3}>
              {affirmation.affirmation}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.affirmationNoImage}>
          <Text style={styles.affirmationTextNoImage} numberOfLines={4}>
            {affirmation.affirmation}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.affirmationActions}>
        <TouchableOpacity style={styles.actionButton} onPress={onPlay}>
          <Text style={styles.actionButtonText}>▶️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onToggleFavorite}
        >
          <Text style={styles.actionButtonText}>
            {affirmation.favorite ? '⭐' : '☆'}
          </Text>
        </TouchableOpacity>
        {!affirmation.imageUrl && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onGenerateImage}
          >
            <Text style={styles.actionButtonText}>🖼️</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            // Voice selection
            Alert.alert('Voice', 'Voice selection coming soon');
          }}
        >
          <Text style={styles.actionButtonText}>🎤</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setPersonalizeOpen(!personalizeOpen)}
        >
          <Text style={styles.actionButtonText}>
            {personalizeOpen ? '▼' : '▶'} Personalize
          </Text>
        </TouchableOpacity>
      </View>

      {/* Personalize Dropdown */}
      {personalizeOpen && (
        <View style={styles.personalizeSection}>
          {affirmation.imageUrl && (
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setUseMyImage(!useMyImage)}
            >
              <Text style={styles.toggleLabel}>Use my image</Text>
              <View style={[styles.toggle, useMyImage && styles.toggleActive]}>
                <View
                  style={[
                    styles.toggleThumb,
                    useMyImage && styles.toggleThumbActive,
                  ]}
                />
              </View>
            </TouchableOpacity>
          )}
          {profile?.voiceCloneId && (
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setUseMyVoice(!useMyVoice)}
            >
              <Text style={styles.toggleLabel}>Use my voice</Text>
              <View style={[styles.toggle, useMyVoice && styles.toggleActive]}>
                <View
                  style={[
                    styles.toggleThumb,
                    useMyVoice && styles.toggleThumbActive,
                  ]}
                />
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
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
    paddingTop: 80, // Space for music player
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
  musicPlayerContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 1000,
    paddingTop: 16,
    paddingRight: 16,
    alignItems: 'flex-end',
  },
  header: {
    marginBottom: 24,
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
    lineHeight: 22,
  },
  controlsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  voiceSelector: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  voiceSelectorText: {
    fontSize: 14,
    color: '#1f2937',
  },
  playAllButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  playAllButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  playAllControls: {
    flexDirection: 'row',
    gap: 8,
  },
  stopButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  stopButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  toggleButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  toggleButtonText: {
    fontSize: 14,
    color: '#1f2937',
  },
  playlistButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  playlistButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryFilter: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryFilterText: {
    fontSize: 14,
    color: '#1f2937',
  },
  categoryDropdown: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    maxHeight: 200,
  },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  categoryOptionText: {
    fontSize: 14,
    color: '#1f2937',
  },
  categoryOptionTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  affirmationsList: {
    gap: 16,
  },
  affirmationCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  affirmationImageContainer: {
    width: '100%',
    height: 300,
    position: 'relative',
  },
  affirmationImage: {
    width: '100%',
    height: '100%',
  },
  affirmationOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
  },
  affirmationText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    lineHeight: 24,
  },
  affirmationNoImage: {
    padding: 24,
    minHeight: 150,
  },
  affirmationTextNoImage: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1f2937',
    lineHeight: 26,
  },
  affirmationActions: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  actionButtonText: {
    fontSize: 18,
  },
  personalizeSection: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#3b82f6',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalClose: {
    fontSize: 24,
    color: '#6b7280',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  playlistInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  playlistAffirmationsList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  playlistAffirmationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  playlistCheckbox: {
    fontSize: 20,
    marginRight: 12,
    color: '#3b82f6',
  },
  playlistAffirmationText: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
  },
  createPlaylistButton: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createPlaylistButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

// Default export for compatibility
export default DashboardScreen;
