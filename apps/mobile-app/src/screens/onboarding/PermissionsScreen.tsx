/**
 * Permissions Screen
 *
 * Requests necessary permissions for app functionality
 * Displays permission status and handles "Don't Allow" scenarios
 */

import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';

import OnboardingProgressIndicator from '../../components/OnboardingProgressIndicator';
import { lightTheme } from '../../theme';
import type { OnboardingScreenProps } from '../../types/navigation';

interface PermissionItem {
  id: string;
  title: string;
  description: string;
  status: 'granted' | 'denied' | 'blocked' | 'pending';
  required: boolean;
}

const PERMISSIONS: PermissionItem[] = [
  {
    id: 'microphone',
    title: 'Microphone',
    description: 'Required to record your voice for cloning',
    status: 'pending',
    required: true,
  },
  {
    id: 'camera',
    title: 'Camera',
    description: 'Required to capture your face for video generation',
    status: 'pending',
    required: true,
  },
  {
    id: 'photoLibrary',
    title: 'Photo Library',
    description: 'Optional - to upload photos for face model creation',
    status: 'pending',
    required: false,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Optional - for training completion alerts',
    status: 'pending',
    required: false,
  },
];

export default function PermissionsScreen({
  navigation,
}: OnboardingScreenProps<'Permissions'>): React.ReactElement {
  const [permissions, setPermissions] = useState<PermissionItem[]>(PERMISSIONS);
  const [allRequiredGranted, setAllRequiredGranted] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  useEffect(() => {
    const requiredGranted = permissions
      .filter((p) => p.required)
      .every((p) => p.status === 'granted');
    setAllRequiredGranted(requiredGranted);
  }, [permissions]);

  const checkPermissions = async () => {
    try {
      // Check microphone permission (via Camera API which includes audio)
      const cameraStatus = await Camera.getCameraPermissionsAsync();
      const micStatus = cameraStatus.granted
        ? 'granted'
        : cameraStatus.canAskAgain
          ? 'pending'
          : 'blocked';

      // Check camera permission
      const camStatus = cameraStatus.granted
        ? 'granted'
        : cameraStatus.canAskAgain
          ? 'pending'
          : 'blocked';

      // Check photo library permission
      const mediaStatus = await MediaLibrary.getPermissionsAsync();
      const photoStatus = mediaStatus.granted
        ? 'granted'
        : mediaStatus.canAskAgain
          ? 'pending'
          : 'blocked';

      // Notification permission - mark as granted by default (optional feature)
      const notificationStatus = 'granted';

      setPermissions((prev) =>
        prev.map((p) => {
          if (p.id === 'microphone') return { ...p, status: micStatus };
          if (p.id === 'camera') return { ...p, status: camStatus };
          if (p.id === 'photoLibrary') return { ...p, status: photoStatus };
          if (p.id === 'notifications') return { ...p, status: notificationStatus };
          return p;
        })
      );
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const requestPermission = async (permissionId: string) => {
    const permission = permissions.find((p) => p.id === permissionId);
    if (!permission) return;

    try {
      let status: 'granted' | 'denied' | 'blocked' = 'denied';

      if (permissionId === 'microphone') {
        // Microphone permission is handled via Camera API
        const result = await Camera.requestCameraPermissionsAsync();
        status = result.granted ? 'granted' : result.canAskAgain ? 'denied' : 'blocked';
      } else if (permissionId === 'camera') {
        const result = await Camera.requestCameraPermissionsAsync();
        status = result.granted ? 'granted' : result.canAskAgain ? 'denied' : 'blocked';
      } else if (permissionId === 'photoLibrary') {
        const result = await MediaLibrary.requestPermissionsAsync();
        status = result.granted ? 'granted' : result.canAskAgain ? 'denied' : 'blocked';
      } else if (permissionId === 'notifications') {
        // Notifications are optional - mark as granted
        status = 'granted';
      }

      setPermissions((prev) => prev.map((p) => (p.id === permissionId ? { ...p, status } : p)));

      // Show instructions if permission was blocked
      if (status === 'blocked') {
        Alert.alert(
          'Permission Blocked',
          `${permission.title} permission was denied. Please enable it in Settings to use this feature.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (error) {
      console.error(`Error requesting ${permissionId} permission:`, error);
      Alert.alert('Error', 'Failed to request permission. Please try again.');
    }
  };

  const handleContinue = () => {
    if (allRequiredGranted) {
      navigation.navigate('PersonalitySetup');
    } else {
      Alert.alert(
        'Required Permissions',
        'Please grant microphone and camera permissions to continue.',
        [{ text: 'OK' }]
      );
    }
  };

  const renderPermissionItem = (permission: PermissionItem) => {
    const isGranted = permission.status === 'granted';
    const statusColor = isGranted ? lightTheme.colors.success : lightTheme.colors.error;
    const statusText = isGranted ? 'Granted' : 'Not Granted';

    return (
      <View key={permission.id} style={styles.permissionItem}>
        <View style={styles.permissionInfo}>
          <View style={styles.permissionHeader}>
            <Text style={styles.permissionTitle}>{permission.title}</Text>
            {!permission.required && <Text style={styles.optionalBadge}>Optional</Text>}
          </View>
          <Text style={styles.permissionDescription}>{permission.description}</Text>
        </View>

        <View style={styles.permissionStatus}>
          <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>

        {permission.status !== 'granted' && (
          <TouchableOpacity
            style={styles.requestButton}
            onPress={() => requestPermission(permission.id)}
          >
            <Text style={styles.requestButtonText}>Request</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Progress Indicator */}
      <OnboardingProgressIndicator
        currentStep={2}
        totalSteps={6}
        stepLabels={['Welcome', 'Permissions', 'Personality', 'Voice', 'Face', 'Complete']}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Permissions</Text>
        <Text style={styles.subtitle}>Grant access to microphone and camera to get started</Text>
      </View>

      {/* Permissions List */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {permissions.map(renderPermissionItem)}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.primaryButton,
            !allRequiredGranted && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!allRequiredGranted}
        >
          <Text
            style={[styles.primaryButtonText, !allRequiredGranted && styles.buttonTextDisabled]}
          >
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightTheme.colors.background,
  },
  header: {
    paddingHorizontal: lightTheme.spacing.lg,
    paddingTop: lightTheme.spacing.xl,
    paddingBottom: lightTheme.spacing.lg,
  },
  title: {
    fontSize: lightTheme.fontSize.xl,
    fontWeight: lightTheme.fontWeight.bold,
    color: lightTheme.colors.text,
    marginBottom: lightTheme.spacing.sm,
  },
  subtitle: {
    fontSize: lightTheme.fontSize.md,
    color: lightTheme.colors.textSecondary,
    lineHeight: lightTheme.lineHeight.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: lightTheme.spacing.lg,
  },
  permissionItem: {
    backgroundColor: lightTheme.colors.surface,
    borderRadius: lightTheme.borderRadius.md,
    padding: lightTheme.spacing.md,
    marginBottom: lightTheme.spacing.md,
    borderWidth: 1,
    borderColor: lightTheme.colors.outline,
  },
  permissionInfo: {
    marginBottom: lightTheme.spacing.md,
  },
  permissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: lightTheme.spacing.xs,
  },
  permissionTitle: {
    fontSize: lightTheme.fontSize.md,
    fontWeight: lightTheme.fontWeight.semibold,
    color: lightTheme.colors.text,
  },
  optionalBadge: {
    fontSize: lightTheme.fontSize.xs,
    color: lightTheme.colors.textSecondary,
    fontWeight: lightTheme.fontWeight.medium,
    backgroundColor: lightTheme.colors.surfaceVariant,
    paddingHorizontal: lightTheme.spacing.sm,
    paddingVertical: 2,
    borderRadius: lightTheme.borderRadius.sm,
  },
  permissionDescription: {
    fontSize: lightTheme.fontSize.sm,
    color: lightTheme.colors.textSecondary,
    lineHeight: lightTheme.lineHeight.sm,
  },
  permissionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: lightTheme.spacing.md,
    gap: lightTheme.spacing.sm,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: lightTheme.fontSize.sm,
    fontWeight: lightTheme.fontWeight.medium,
  },
  requestButton: {
    backgroundColor: lightTheme.colors.primary,
    paddingVertical: lightTheme.spacing.sm,
    borderRadius: lightTheme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestButtonText: {
    fontSize: lightTheme.fontSize.sm,
    fontWeight: lightTheme.fontWeight.semibold,
    color: lightTheme.colors.onPrimary,
  },
  footer: {
    paddingHorizontal: lightTheme.spacing.lg,
    paddingBottom: lightTheme.spacing.xl,
    gap: lightTheme.spacing.md,
  },
  button: {
    paddingVertical: lightTheme.spacing.md,
    borderRadius: lightTheme.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: lightTheme.colors.primary,
  },
  primaryButtonText: {
    fontSize: lightTheme.fontSize.md,
    fontWeight: lightTheme.fontWeight.semibold,
    color: lightTheme.colors.onPrimary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonTextDisabled: {
    opacity: 0.7,
  },
});
