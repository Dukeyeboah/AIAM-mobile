// src/components/SplashScreen.tsx
// Mobile version of your web app's SplashScreen
// Key differences:
// - Uses React Native Animated API instead of CSS animations
// - Uses AsyncStorage instead of sessionStorage
// - Uses Image component from expo-image or react-native

import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Animated, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Floating logo component with gentle animation
function FloatingLogo() {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start at random position
    floatAnim.setValue(Math.random());

    const floatAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3000 + Math.random() * 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000 + Math.random() * 2000,
          useNativeDriver: true,
        }),
      ]),
      { iterations: -1 }
    );

    floatAnimation.start();
    return () => floatAnimation.stop();
  }, [floatAnim]);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -15], // Slightly more movement for splash
  });

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
      }}
    >
      <Image
        source={require('../../assets/aiam_image.png')}
        style={styles.logo}
        resizeMode='contain'
      />
    </Animated.View>
  );
}

interface SplashScreenProps {
  children: React.ReactNode;
  duration?: number;
  onComplete?: () => void;
  showCta?: boolean;
  ctaLabel?: string;
  onCtaClick?: () => void;
  persistKey?: string;
}

export function SplashScreen({
  children,
  duration = 5000,
  onComplete,
  showCta = false,
  ctaLabel = 'I AM',
  onCtaClick,
  persistKey,
}: SplashScreenProps) {
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [overlayHidden, setOverlayHidden] = useState(false);
  const hasNotifiedRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const notifyComplete = () => {
    if (hasNotifiedRef.current) {
      return;
    }
    hasNotifiedRef.current = true;
    onComplete?.();
  };

  useEffect(() => {
    const checkPersistKey = async () => {
      if (!persistKey) {
        setOverlayVisible(true);
        setOverlayHidden(false);
        return;
      }

      try {
        const hasSeenSplash = await AsyncStorage.getItem(persistKey);
        if (hasSeenSplash) {
          setOverlayVisible(false);
          setOverlayHidden(true);
          notifyComplete();
        } else {
          setOverlayVisible(true);
          setOverlayHidden(false);
        }
      } catch (error) {
        console.error('[SplashScreen] Error checking persist key:', error);
        setOverlayVisible(true);
        setOverlayHidden(false);
      }
    };

    checkPersistKey();
  }, [persistKey]);

  useEffect(() => {
    if (!overlayVisible) {
      return;
    }

    const timer = setTimeout(async () => {
      // Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setOverlayHidden(true);
        if (persistKey) {
          AsyncStorage.setItem(persistKey, 'true').catch(console.error);
        }
        notifyComplete();
        setTimeout(() => {
          setOverlayVisible(false);
        }, 400);
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, overlayVisible, persistKey, fadeAnim]);

  if (!overlayVisible) {
    return <>{children}</>;
  }

  return (
    <>
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
            pointerEvents: overlayHidden ? 'none' : 'auto',
          },
        ]}
      >
        <View style={styles.container}>
          <Animated.View
            style={[
              styles.logoContainer,
              {
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -10],
                    }),
                  },
                ],
                opacity: fadeAnim,
              },
            ]}
          >
            <FloatingLogo />
          </Animated.View>
        </View>
      </Animated.View>
      <View style={styles.content}>{children}</View>
    </>
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
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 320,
    height: 320,
  },
  content: {
    flex: 1,
    zIndex: 0,
  },
});
