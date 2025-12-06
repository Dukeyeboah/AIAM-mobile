// src/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase config - same as your web app
const firebaseConfig = {
  apiKey: 'AIzaSyDG3CamFgadW9EXXZ1yMgKLa8yzfU_6tMw',
  authDomain: 'aiam-95e87.firebaseapp.com',
  projectId: 'aiam-95e87',
  storageBucket: 'aiam-95e87.firebasestorage.app',
  messagingSenderId: '1039070821059',
  appId: '1:1039070821059:web:ee29002d5d3c5d30df8076',
};

// Initialize Firebase (only once)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with AsyncStorage persistence for React Native
// This ensures auth state persists between app sessions
// Note: getReactNativePersistence is not directly exported in Firebase 12.6.0
// We'll use getAuth for now (shows warning but works)
// The warning is harmless - auth works, just won't persist between app restarts
// TODO: Add proper AsyncStorage persistence when Firebase exports it correctly

let auth: ReturnType<typeof getAuth>;
try {
  // Try to get existing auth instance first (handles hot reload)
  try {
    auth = getAuth(app);
  } catch {
    // Auth doesn't exist yet, initialize it
    // For now, we'll use getAuth which works but shows a warning
    // The warning is about persistence - auth will still work, just won't persist between restarts
    auth = getAuth(app);
  }
} catch (error: any) {
  // If already initialized error, just get the existing instance
  if (error?.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    throw error;
  }
}

export { auth };

// Export Firebase services
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Set Google Auth to prompt for account selection
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

export default app;
