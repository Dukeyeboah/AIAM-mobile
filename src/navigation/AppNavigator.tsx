// src/navigation/AppNavigator.tsx
// Bottom tab navigation for the app
// Similar to your web app's navigation structure

import React from 'react';
import { Text, View, Image, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../providers/AuthProvider';
import { HomeScreen } from '../screens/HomeScreen';
import DashboardScreen from '../screens/DashboardScreen';
import AccountScreen from '../screens/AccountScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarShowLabel: false, // Hide text labels, show only icons
      }}
    >
      <Tab.Screen
        name='Home'
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color }) => <TabIcon emoji='🏠' color={color} />,
        }}
      />
      <Tab.Screen
        name='Dashboard'
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color }) => <TabIcon emoji='📊' color={color} />,
        }}
      />
      <Tab.Screen
        name='Settings'
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color }) => <TabIcon emoji='⚙️' color={color} />,
        }}
      />
      <Tab.Screen
        name='Account'
        component={AccountScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <UserAvatarIcon color={color} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Simple icon component using emoji
function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return (
    <Text style={{ fontSize: 24, opacity: color === '#3b82f6' ? 1 : 0.6 }}>
      {emoji}
    </Text>
  );
}

// User avatar icon component
function UserAvatarIcon({
  color,
  focused,
}: {
  color: string;
  focused: boolean;
}) {
  const { user, profile } = useAuth();
  const avatarUrl = profile?.photoURL || user?.photoURL;
  const displayName = profile?.displayName || user?.displayName;
  const firstLetter =
    displayName?.charAt(0).toUpperCase() ||
    user?.email?.charAt(0).toUpperCase() ||
    '?';

  return (
    <View
      style={[styles.avatarContainer, focused && styles.avatarContainerFocused]}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{firstLetter}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    opacity: 0.6,
  },
  avatarContainerFocused: {
    borderColor: '#3b82f6',
    opacity: 1,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
});
