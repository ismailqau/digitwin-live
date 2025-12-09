/**
 * RecordingListItem Component
 *
 * Displays a single recording with play/pause controls and metadata.
 */

import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React, { useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

import { Recording, useRecordingStore } from '../store/recordingStore';

interface RecordingListItemProps {
  recording: Recording;
  onDelete?: (id: string) => void;
}

// Format duration from milliseconds to mm:ss
const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Format timestamp to readable date/time
const formatTimestamp = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function RecordingListItem({ recording, onDelete }: RecordingListItemProps) {
  const { currentlyPlaying, setCurrentlyPlaying } = useRecordingStore();
  const isThisPlaying = currentlyPlaying === recording.id;

  // Create player for this recording
  const player = useAudioPlayer({ uri: recording.uri });
  const status = useAudioPlayerStatus(player);

  // Handle playback state changes
  useEffect(() => {
    if (status && !status.playing && isThisPlaying) {
      // Playback ended
      if (status.currentTime >= (status.duration || 0) - 0.1) {
        setCurrentlyPlaying(null);
      }
    }
  }, [status?.playing, status?.currentTime, status?.duration, isThisPlaying, setCurrentlyPlaying]);

  const handlePlayPause = useCallback(() => {
    if (isThisPlaying) {
      player.pause();
      setCurrentlyPlaying(null);
    } else {
      // Stop any other playing recording
      setCurrentlyPlaying(recording.id);
      player.seekTo(0);
      player.play();
    }
  }, [isThisPlaying, player, recording.id, setCurrentlyPlaying]);

  const handleDelete = useCallback(() => {
    if (isThisPlaying) {
      player.pause();
      setCurrentlyPlaying(null);
    }
    onDelete?.(recording.id);
  }, [isThisPlaying, player, setCurrentlyPlaying, onDelete, recording.id]);

  // Calculate progress
  const progress =
    status?.duration && status.duration > 0 ? (status.currentTime / status.duration) * 100 : 0;

  return (
    <View style={styles.container}>
      {/* Play/Pause Button */}
      <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
        {status?.isBuffering ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.playButtonText}>
            {isThisPlaying && status?.playing ? '⏸' : '▶️'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Recording Info */}
      <View style={styles.info}>
        <Text style={styles.timestamp}>{formatTimestamp(recording.timestamp)}</Text>
        {recording.transcript && (
          <Text style={styles.transcript} numberOfLines={2}>
            {recording.transcript}
          </Text>
        )}
        <View style={styles.metadata}>
          <Text style={styles.duration}>{formatDuration(recording.durationMs)}</Text>
          {recording.syncedToServer && <Text style={styles.syncBadge}>☁️ Synced</Text>}
        </View>

        {/* Progress Bar */}
        {isThisPlaying && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${progress}%` }]} />
          </View>
        )}
      </View>

      {/* Delete Button */}
      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteButtonText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playButtonText: {
    fontSize: 18,
    color: '#fff',
  },
  info: {
    flex: 1,
  },
  timestamp: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  transcript: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  duration: {
    fontSize: 12,
    color: '#999',
  },
  syncBadge: {
    fontSize: 11,
    color: '#34C759',
  },
  progressContainer: {
    height: 3,
    backgroundColor: '#E5E5EA',
    borderRadius: 1.5,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 1.5,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteButtonText: {
    fontSize: 18,
  },
});
