// App.tsx
// Main entry point for the AIAM mobile app
// Key differences from web app:
// - Uses React Native components instead of HTML
// - Uses React Navigation for screen management (instead of Next.js routing)
// - Wraps everything in AuthProvider (same concept as web)
// - Shows AuthScreen or HomeScreen based on auth state

import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/providers/AuthProvider';
import { AuthScreen } from './src/screens/AuthScreen';
import { AppNavigator } from './src/navigation/AppNavigator';

// Main app content - checks auth state and shows appropriate screen
function AppContent() {
  const { user, initializing } = useAuth();

  // Show loading screen while checking auth state
  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size='large' color='#f9fafb' />
        <Text style={styles.loadingText}>Initializing AIAM Mobile...</Text>
        <StatusBar style='light' />
      </View>
    );
  }

  // Show auth screen if not logged in, navigation with tabs if logged in
  return (
    <NavigationContainer>
      <StatusBar style='light' />
      {user ? <AppNavigator /> : <AuthScreen />}
    </NavigationContainer>
  );
}

// Root component - wraps everything in providers
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#020617',
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 16,
    color: '#e5e7eb',
    marginTop: 16,
    textAlign: 'center',
  },
});
