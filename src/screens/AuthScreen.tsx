// src/screens/AuthScreen.tsx
// This is the mobile version of your web app's auth modal
// Key differences from web:
// - Full screen instead of modal dialog
// - Uses React Native components (TextInput, TouchableOpacity, etc.)
// - Same functionality: email/password signup/login + Google sign-in

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../providers/AuthProvider';

type AuthMode = 'signup' | 'login';

interface AuthScreenProps {
  onAuthSuccess?: () => void;
}

export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const { signUpWithEmail, signInWithEmail, signInWithGoogle, authLoading } =
    useAuth();

  const [mode, setMode] = useState<AuthMode>('signup');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const title = mode === 'signup' ? 'Create your account' : 'Welcome back';
  const description =
    mode === 'signup'
      ? 'Sign up to generate personalized affirmations starting with 100 free credits.'
      : 'Log in to access your affirmations, credits, and personalized experience.';

  const handleSubmit = async () => {
    setError(null);

    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (mode === 'signup' && !firstName.trim()) {
      setError('Please enter your first name.');
      return;
    }

    try {
      if (mode === 'signup') {
        await signUpWithEmail({ email, password, firstName });
      } else {
        await signInWithEmail(email, password);
      }
      onAuthSuccess?.();
    } catch (authError) {
      const message =
        authError instanceof Error
          ? authError.message
          : 'We could not complete that action. Please try again.';
      setError(message);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      await signInWithGoogle();
      onAuthSuccess?.();
    } catch (authError) {
      const message =
        authError instanceof Error
          ? authError.message
          : 'We could not complete that action. Please try again.';
      setError(message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style='light' />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps='handled'
        >
          <View style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>

            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  mode === 'signup' && styles.modeButtonActive,
                ]}
                onPress={() => {
                  setMode('signup');
                  setError(null);
                }}
                disabled={authLoading}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === 'signup' && styles.modeButtonTextActive,
                  ]}
                >
                  I'm new
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeButton,
                  mode === 'login' && styles.modeButtonActive,
                ]}
                onPress={() => {
                  setMode('login');
                  setError(null);
                }}
                disabled={authLoading}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    mode === 'login' && styles.modeButtonTextActive,
                  ]}
                >
                  I've been here
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {mode === 'signup' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>First name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder='AiAm'
                    value={firstName}
                    onChangeText={setFirstName}
                    editable={!authLoading}
                    autoCapitalize='words'
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder='you@example.com'
                  value={email}
                  onChangeText={setEmail}
                  keyboardType='email-address'
                  autoCapitalize='none'
                  autoComplete='email'
                  editable={!authLoading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder='••••••••'
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize='none'
                  autoComplete={
                    mode === 'signup' ? 'new-password' : 'current-password'
                  }
                  editable={!authLoading}
                />
              </View>

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  authLoading && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={
                  authLoading ||
                  !email ||
                  !password ||
                  (mode === 'signup' && !firstName.trim())
                }
              >
                {authLoading ? (
                  <ActivityIndicator color='#fff' />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {mode === 'signup' ? 'Create account' : 'Log in'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign In */}
            <TouchableOpacity
              style={[
                styles.googleButton,
                authLoading && styles.googleButtonDisabled,
              ]}
              onPress={handleGoogleSignIn}
              disabled={authLoading}
            >
              <View style={styles.googleIconContainer}>
                <Text style={styles.googleIcon}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Google</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#e5e7eb',
    marginBottom: 32,
    textAlign: 'center',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 4,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#0f172a',
  },
  modeButtonText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  modeButtonTextActive: {
    color: '#f9fafb',
    fontWeight: '600',
  },
  form: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e5e7eb',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#f9fafb',
    borderWidth: 1,
    borderColor: '#334155',
  },
  errorContainer: {
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  googleButton: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4285F4', // Google blue
  },
  googleButtonText: {
    color: '#f9fafb',
    fontSize: 16,
    fontWeight: '500',
  },
});
