// src/components/BackgroundAnimation.tsx
// Mobile version of your web app's BackgroundAnimation
// Uses React Native's Animated API for floating particles/sparkles
// Simplified version that works well with React Native

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const PARTICLE_COUNT = 20; // Reduced for better performance

export function BackgroundAnimation() {
  const particlesRef = useRef<
    Array<{
      x: Animated.Value;
      y: Animated.Value;
      opacity: Animated.Value;
      size: number;
    }>
  >([]);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const { width, height } = Dimensions.get('window');

    // Initialize particles with simpler structure
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: new Animated.Value(Math.random() * width),
      y: new Animated.Value(Math.random() * height),
      opacity: new Animated.Value(Math.random() * 0.3 + 0.2),
      size: Math.random() * 0.25 + 1,
    }));

    // Create continuous floating animations that run forever
    const animations = particlesRef.current.map((particle, index) => {
      const startX = (particle.x as any)._value;
      const startY = (particle.y as any)._value;

      // Continuous X movement (back and forth)
      const moveX = Animated.loop(
        Animated.sequence([
          Animated.timing(particle.x, {
            toValue: startX + (Math.random() - 0.5) * 300,
            duration: 5000 + Math.random() * 3000,
            useNativeDriver: false,
          }),
          Animated.timing(particle.x, {
            toValue: startX,
            duration: 5000 + Math.random() * 3000,
            useNativeDriver: false,
          }),
        ]),
        { iterations: -1 } // Infinite iterations
      );

      // Continuous Y movement (back and forth)
      const moveY = Animated.loop(
        Animated.sequence([
          Animated.timing(particle.y, {
            toValue: startY + (Math.random() - 0.5) * 300,
            duration: 6000 + Math.random() * 4000,
            useNativeDriver: false,
          }),
          Animated.timing(particle.y, {
            toValue: startY,
            duration: 6000 + Math.random() * 4000,
            useNativeDriver: false,
          }),
        ]),
        { iterations: -1 } // Infinite iterations
      );

      // Continuous fade (twinkling effect)
      const fade = Animated.loop(
        Animated.sequence([
          Animated.timing(particle.opacity, {
            toValue: 0.7,
            duration: 2000 + Math.random() * 2000,
            useNativeDriver: false,
          }),
          Animated.timing(particle.opacity, {
            toValue: 0.2,
            duration: 2000 + Math.random() * 2000,
            useNativeDriver: false,
          }),
        ]),
        { iterations: -1 } // Infinite iterations
      );

      return Animated.parallel([moveX, moveY, fade]);
    });

    // Start all animations - they will run continuously
    animationRef.current = Animated.parallel(animations);
    animationRef.current.start();

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, []);

  return (
    <View style={styles.container} pointerEvents='none'>
      {particlesRef.current.map((particle, index) => (
        <Animated.View
          key={index}
          style={[
            styles.particle,
            {
              left: particle.x,
              top: particle.y,
              width: particle.size * 4,
              height: particle.size * 4,
              borderRadius: particle.size * 2,
              opacity: particle.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  particle: {
    position: 'absolute',
    backgroundColor: 'rgba(100, 180, 180, 1)',
  },
});
