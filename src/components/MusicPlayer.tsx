// src/components/MusicPlayer.tsx
// Music player component that expands/collapses in the header
// Similar to web app's music player

import React, { useState, useEffect, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

// Song names that match the app's vibe
const SONG_NAMES = [
  'Cosmic Flow',
  'Serene Mind',
  'Inner Peace',
  'Ethereal Dreams',
  'Zen Garden',
  'Meditation Waves',
  'Tranquil Space',
  'Sacred Silence',
  'Mindful Journey',
  'Harmony Within',
];

interface Song {
  name: string;
  url: string;
}

interface MusicPlayerProps {
  onStartMusic?: () => void;
  onStopMusic?: () => void;
}

export function MusicPlayer({ onStartMusic, onStopMusic }: MusicPlayerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [songs, setSongs] = useState<Song[]>([]);
  const [volume, setVolume] = useState(0.25);
  const [isMuted, setIsMuted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [songMenuOpen, setSongMenuOpen] = useState(false);
  const audioPlayer = useAudioPlayer();
  const currentSongIndexRef = useRef(0);

  // Load songs from Firebase Storage
  useEffect(() => {
    const loadSongs = async () => {
      setLoading(true);
      try {
        const musicRef = ref(storage, 'music');
        const files = await listAll(musicRef);

        if (files.items.length === 0) {
          console.log('[MusicPlayer] No songs found in Firebase Storage');
          setLoading(false);
          return;
        }

        const songPromises = files.items.map(async (item, index) => {
          try {
            const url = await getDownloadURL(item);
            return {
              name: SONG_NAMES[index] || `Track ${index + 1}`,
              url,
            };
          } catch (err) {
            console.error(
              `[MusicPlayer] Failed to get URL for ${item.name}:`,
              err
            );
            return null;
          }
        });

        const loadedSongs = (await Promise.all(songPromises)).filter(
          (song): song is Song => song !== null
        );
        setSongs(loadedSongs);
      } catch (error) {
        console.error('[MusicPlayer] Failed to load songs:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadSongs();
  }, []);

  // Update ref when currentSongIndex changes
  useEffect(() => {
    currentSongIndexRef.current = currentSongIndex;
  }, [currentSongIndex]);

  // Listen for background music events from Dashboard
  useEffect(() => {
    const startSubscription = DeviceEventEmitter.addListener(
      'start-background-music',
      () => {
        if (songs.length > 0 && !isPlaying) {
          setIsPlaying(true);
        }
      }
    );

    const stopSubscription = DeviceEventEmitter.addListener(
      'stop-background-music',
      () => {
        if (isPlaying) {
          setIsPlaying(false);
        }
      }
    );

    return () => {
      startSubscription.remove();
      stopSubscription.remove();
    };
  }, [songs.length, isPlaying]);

  // Handle audio playback
  useEffect(() => {
    if (songs.length === 0 || !songs[currentSongIndex]) return;

    const currentSong = songs[currentSongIndex];
    const playAudio = async () => {
      try {
        audioPlayer.replace(currentSong.url);
        // Wait a moment for the source to load
        await new Promise((resolve) => setTimeout(resolve, 100));
        await audioPlayer.play();
        onStartMusic?.();
      } catch (error) {
        console.error('[MusicPlayer] Playback error:', error);
        setIsPlaying(false);
      }
    };

    if (isPlaying) {
      playAudio();
    } else {
      audioPlayer.pause();
      onStopMusic?.();
    }
  }, [
    isPlaying,
    currentSongIndex,
    songs,
    audioPlayer,
    onStartMusic,
    onStopMusic,
  ]);

  // Listen for playback completion
  useEffect(() => {
    if (!audioPlayer || songs.length === 0) return;

    const checkStatus = setInterval(() => {
      if (!audioPlayer.playing && isPlaying) {
        // Song finished, play next
        const nextIndex = (currentSongIndexRef.current + 1) % songs.length;
        setCurrentSongIndex(nextIndex);
      }
    }, 500);

    return () => clearInterval(checkStatus);
  }, [audioPlayer, isPlaying, songs.length]);

  const handlePlayPause = () => {
    if (songs.length === 0) {
      return;
    }
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    if (songs.length === 0) return;
    const nextIndex = (currentSongIndex + 1) % songs.length;
    setCurrentSongIndex(nextIndex);
    setIsPlaying(true);
  };

  const handlePrevious = () => {
    if (songs.length === 0) return;
    const prevIndex = (currentSongIndex - 1 + songs.length) % songs.length;
    setCurrentSongIndex(prevIndex);
    setIsPlaying(true);
  };

  const handleSelectSong = (index: number) => {
    setCurrentSongIndex(index);
    setIsPlaying(true);
    setSongMenuOpen(false);
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (newVolume > 0) {
      setIsMuted(false);
    }
    // Note: expo-audio volume control would go here
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const currentSong = songs[currentSongIndex];

  return (
    <>
      {/* Compact button */}
      {!isExpanded && (
        <TouchableOpacity
          style={styles.compactButton}
          onPress={() => setIsExpanded(true)}
        >
          <Text style={styles.compactButtonText}>🎵</Text>
        </TouchableOpacity>
      )}

      {/* Expanded player - spans across top */}
      {isExpanded && (
        <View style={styles.expandedContainer}>
          <View style={styles.playerRow}>
            <TouchableOpacity
              style={styles.playerButton}
              onPress={handlePrevious}
              disabled={songs.length === 0}
            >
              <Text style={styles.playerButtonText}>⏮️</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playerButton}
              onPress={handlePlayPause}
              disabled={songs.length === 0}
            >
              <Text style={styles.playerButtonText}>
                {isPlaying ? '⏸️' : '▶️'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playerButton}
              onPress={handleNext}
              disabled={songs.length === 0}
            >
              <Text style={styles.playerButtonText}>⏭️</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.playerButton} onPress={toggleMute}>
              <Text style={styles.playerButtonText}>
                {isMuted || volume === 0 ? '🔇' : '🔊'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playerButton}
              onPress={() => setSongMenuOpen(true)}
            >
              <Text style={styles.playerButtonText}>☰</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playerButton}
              onPress={() => setIsExpanded(false)}
            >
              <Text style={styles.playerButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {currentSong && (
            <Text style={styles.songName} numberOfLines={1}>
              {currentSong.name}
            </Text>
          )}
        </View>
      )}

      {/* Song Selection Modal */}
      <Modal
        visible={songMenuOpen}
        transparent
        animationType='slide'
        onRequestClose={() => setSongMenuOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select a Song</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSongMenuOpen(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size='large' color='#3b82f6' />
                <Text style={styles.modalLoadingText}>Loading songs...</Text>
              </View>
            ) : songs.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>
                  No songs available.{'\n'}
                  Upload songs to Firebase Storage{'\n'}
                  <Text style={styles.modalEmptySubtext}>Folder: music/</Text>
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll}>
                {songs.map((song, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.songItem,
                      index === currentSongIndex && styles.songItemActive,
                    ]}
                    onPress={() => handleSelectSong(index)}
                  >
                    <Text
                      style={[
                        styles.songItemText,
                        index === currentSongIndex && styles.songItemTextActive,
                      ]}
                    >
                      {index === currentSongIndex && isPlaying && '🎵 '}
                      {song.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  compactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  compactButtonText: {
    fontSize: 20,
  },
  expandedContainer: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  playerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  playerButtonText: {
    fontSize: 16,
  },
  songName: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
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
    maxHeight: '70%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#6b7280',
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  modalLoadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6b7280',
  },
  modalEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalEmptySubtext: {
    fontSize: 12,
    color: '#9ca3af',
  },
  modalScroll: {
    maxHeight: 400,
  },
  songItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  songItemActive: {
    backgroundColor: '#eff6ff',
  },
  songItemText: {
    fontSize: 16,
    color: '#1f2937',
  },
  songItemTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
});
