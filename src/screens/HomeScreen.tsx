// src/screens/HomeScreen.tsx
// Mobile version of your web app's home page
// Key differences:
// - Uses ScrollView instead of div with grid
// - Uses FlatList or manual mapping for category cards
// - Same 12 categories from your web app with proper HSL gradients
// - Shows welcome message if user is logged in
// - White background with background animation like web app

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../providers/AuthProvider';
import { CategoryCard, Category } from '../components/CategoryCard';
import { BackgroundAnimation } from '../components/BackgroundAnimation';
import { SplashScreen } from '../components/SplashScreen';
import { AffirmationScreen } from './AffirmationScreen';
import { MusicPlayer } from '../components/MusicPlayer';

// Same categories as your web app with HSL gradients
export const categories: Category[] = [
  {
    id: 'housing-home',
    title: 'Housing & Home',
    gradient: {
      from: 'hsla(400, 100%, 86%, 0.78)',
      to: 'hsla(688, 100%, 85%, 0.72)',
    },
  },
  {
    id: 'finance-wealth',
    title: 'Finance & Wealth',
    gradient: {
      from: 'hsla(888, 68%, 82%, 0.78)',
      to: 'hsla(774, 72%, 80%, 0.72)',
    },
  },
  {
    id: 'health-wellbeing',
    title: 'Health & Wellbeing',
    gradient: {
      from: 'hsla(900, 88%, 86%, 0.78)',
      to: 'hsla(970, 70%, 95%, 0.72)',
    },
  },
  {
    id: 'travel-adventure',
    title: 'Travel & Adventure',
    gradient: {
      from: 'hsla(60, 100%, 85%, 0.78)',
      to: 'hsla(2, 100%, 83%, 0.72)',
    },
  },
  {
    id: 'relationships-love',
    title: 'Relationships & Love',
    gradient: {
      from: 'hsla(888, 88%, 86%, 0.78)',
      to: 'hsla(700, 84%, 86%, 0.72)',
    },
  },
  {
    id: 'creativity-expression',
    title: 'Creativity & Expression',
    gradient: {
      from: 'hsla(752, 82%, 86%, 0.78)',
      to: 'hsla(69, 76%, 85%, 0.72)',
    },
  },
  {
    id: 'career-employment',
    title: 'Career & Employment',
    gradient: {
      from: 'hsla(671, 84%, 86%, 0.78)',
      to: 'hsla(88, 100%, 85%, 0.72)',
    },
  },
  {
    id: 'education-knowledge',
    title: 'Education & Knowledge',
    gradient: {
      from: 'hsla(206, 88%, 86%, 0.78)',
      to: 'hsla(499, 100%, 82%, 0.72)',
    },
  },
  {
    id: 'spirituality-peace',
    title: 'Spirituality & Inner Peace',
    gradient: {
      from: 'hsla(688, 90%, 84%, 0.78)',
      to: 'hsla(180, 76%, 82%, 0.72)',
    },
  },
  {
    id: 'personal-growth',
    title: 'Personal Growth & Development',
    gradient: {
      from: 'hsla(60, 90%, 82%, 0.78)',
      to: 'hsla(180, 76%, 80%, 0.72)',
    },
  },
  {
    id: 'self-confidence',
    title: 'Self-Confidence & Empowerment',
    gradient: {
      from: 'hsla(60, 100%, 86%, 0.78)',
      to: 'hsla(340, 90%, 85%, 0.72)',
    },
  },
  {
    id: 'joy-happiness',
    title: 'Joy & Happiness',
    gradient: {
      from: 'hsla(124, 100%, 85%, 0.78)',
      to: 'hsla(340, 99%, 86%, 0.72)',
    },
  },
];

interface HomeScreenProps {
  onCategoryPress?: (category: Category) => void;
}

export function HomeScreen({ onCategoryPress }: HomeScreenProps) {
  const { user, profile, initializing } = useAuth();
  const [splashComplete, setSplashComplete] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null
  );
  const scrollY = useRef(new Animated.Value(0)).current;
  const [showCredits, setShowCredits] = useState(true);

  const firstName = profile?.displayName
    ? profile.displayName.trim().split(/\s+/)[0]
    : null;

  const showAuthCta = !initializing && !user;

  const handleCategoryPress = (category: Category) => {
    if (!user) {
      Alert.alert(
        'Create your free aiam account',
        'Sign up or log in to unlock affirmations and get 100 starter credits.'
      );
      return;
    }

    setSelectedCategory(category);
    onCategoryPress?.(category);
  };

  const handleCloseAffirmation = () => {
    setSelectedCategory(null);
  };

  return (
    <SplashScreen
      duration={5000}
      showCta={showAuthCta}
      persistKey='aiam-splash-shown'
      onComplete={() => setSplashComplete(true)}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style='dark' />
        <View style={styles.backgroundContainer}>
          <BackgroundAnimation />
        </View>

        {/* Music Player - Top Right */}
        <View style={styles.musicPlayerContainer}>
          <MusicPlayer />
        </View>

        {/* Add padding to scroll content when music player is expanded */}
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            {
              useNativeDriver: false,
              listener: (event: any) => {
                const offsetY = event.nativeEvent.contentOffset.y;
                // Hide credits when scrolling down, show when at top
                setShowCredits(offsetY < 50);
              },
            }
          )}
          scrollEventThrottle={16}
        >
          <View style={styles.header}>
            {firstName && (
              <Text style={styles.welcomeText}>Welcome back, {firstName}!</Text>
            )}
            <Text style={styles.tagline}>
              Create Your Reality, One Affirmation at a Time with the power of
              the "I Am"
            </Text>
          </View>

          <View style={styles.categoriesContainer}>
            {categories.map((category, index) => (
              <CategoryCard
                key={category.id}
                category={category}
                onPress={() => handleCategoryPress(category)}
                delay={index * 100} // Stagger animations
                index={index} // Pass index for alternating direction
              />
            ))}
          </View>
        </Animated.ScrollView>

        {/* Credits display at top-left - commented out for now */}
        {/* {user && profile && (
          <Animated.View
            style={[
              styles.creditsContainer,
              {
                opacity: showCredits ? 1 : 0,
                transform: [
                  {
                    translateY: scrollY.interpolate({
                      inputRange: [0, 100],
                      outputRange: [0, 20],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.creditsText}>
              {profile.credits} aiams
            </Text>
          </Animated.View>
        )} */}
      </SafeAreaView>

      {selectedCategory && (
        <AffirmationScreen
          category={selectedCategory}
          onClose={handleCloseAffirmation}
        />
      )}
    </SplashScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb', // bg-gray-80 equivalent (light gray/white)
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  creditsContainer: {
    position: 'absolute',
    bottom: 80, // Above navigation bar (60px height + 20px padding)
    right: 24,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  creditsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100, // Extra padding for credits and nav bar
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeText: {
    fontSize: 14,
    color: '#6b7280', // muted text color
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    color: '#374151', // dark gray text
    textAlign: 'center',
    lineHeight: 26,
  },
  categoriesContainer: {
    gap: 16,
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
});
