// src/components/CategoryCard.tsx
// Mobile version of your web app's category card
// Key differences:
// - Uses TouchableOpacity instead of Card with onClick
// - Uses React Native's LinearGradient with HSL gradients converted to rgba
// - Same visual design with gradient backgrounds and icons
// - Includes floating animation (soft up/down motion) for meditative feel

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { hslToRgba } from '../utils/colorUtils';

// We'll use simple emoji icons for now, or you can install react-native-vector-icons later
const iconMap: Record<string, string> = {
  'housing-home': '🏠',
  'finance-wealth': '💰',
  'health-wellbeing': '❤️',
  'travel-adventure': '✈️',
  'relationships-love': '👥',
  'creativity-expression': '🎨',
  'career-employment': '💼',
  'education-knowledge': '📚',
  'spirituality-peace': '✨',
  'personal-growth': '📈',
  'self-confidence': '🛡️',
  'joy-happiness': '😊',
};

export interface Category {
  id: string;
  title: string;
  gradient?: {
    from: string;
    to: string;
  };
}

interface CategoryCardProps {
  category: Category;
  onPress: () => void;
  delay?: number; // Delay for staggered animation
  index?: number; // Index for alternating animation direction
}

export function CategoryCard({
  category,
  onPress,
  delay = 0,
  index = 0,
}: CategoryCardProps) {
  const icon = iconMap[category.id] || '✨';
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Convert HSL gradients to rgba for LinearGradient
  const fromColor = category.gradient?.from
    ? hslToRgba(category.gradient.from)
    : 'rgba(200, 200, 255, 0.78)';
  const toColor = category.gradient?.to
    ? hslToRgba(category.gradient.to)
    : 'rgba(255, 200, 200, 0.72)';

  // Soft floating animation (up and down motion)
  // Cards alternate direction: even index goes up first, odd index goes down first
  useEffect(() => {
    // Determine if this card should start going up or down based on index
    // Even indices (0, 2, 4...) start going up, odd indices (1, 3, 5...) start going down
    const startsUp = index % 2 === 0;
    const startValue = startsUp ? 0 : 1;
    floatAnim.setValue(startValue);

    // Each card has slightly different duration for organic movement
    const duration1 = 4000 + Math.random() * 3000; // 4-7 seconds
    const duration2 = 4000 + Math.random() * 3000; // 4-7 seconds

    const floatAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: startsUp ? 1 : 0, // Go to opposite direction
          duration: duration1,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: startsUp ? 0 : 1, // Return to start
          duration: duration2,
          useNativeDriver: true,
        }),
      ]),
      { iterations: -1 } // Infinite
    );

    // Start animation after delay for staggered effect
    const timer = setTimeout(() => {
      floatAnimation.start();
    }, delay);

    return () => {
      clearTimeout(timer);
      floatAnimation.stop();
    };
  }, [floatAnim, delay, index]);

  // Interpolate for smooth up/down movement (about 10px range)
  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          transform: [{ translateY }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[fromColor, toColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{icon}</Text>
          </View>
          <Text style={styles.title}>{category.title}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gradient: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'center',
  },
});
