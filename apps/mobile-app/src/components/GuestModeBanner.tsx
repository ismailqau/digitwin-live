/**
 * GuestModeBanner Component
 *
 * Displays a banner when user is in guest mode, prompting them to sign in
 * to save their data and access full features.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface GuestModeBannerProps {
  onSignInPress: () => void;
}

export const GuestModeBanner: React.FC<GuestModeBannerProps> = ({ onSignInPress }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>👤 Guest Mode</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.message}>Sign in to save your data and access all features</Text>

        <TouchableOpacity style={styles.signInButton} onPress={onSignInPress} activeOpacity={0.8}>
          <Text style={styles.signInButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF9E6',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE082',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#FFA726',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  message: {
    flex: 1,
    fontSize: 14,
    color: '#5D4037',
    marginRight: 12,
  },
  signInButton: {
    backgroundColor: '#FF6F00',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default GuestModeBanner;
