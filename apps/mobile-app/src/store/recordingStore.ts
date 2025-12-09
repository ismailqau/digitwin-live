/**
 * Recording Store
 *
 * Simple module-level store for managing saved audio recordings with file system persistence.
 * Using useState + useEffect pattern to avoid Hermes compatibility issues.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { useState, useEffect } from 'react';

// Directory for storing recordings
const RECORDINGS_DIR = `${FileSystem.documentDirectory}recordings/`;
const METADATA_FILE = `${RECORDINGS_DIR}metadata.json`;

export interface Recording {
  id: string;
  uri: string;
  timestamp: Date;
  durationMs: number;
  transcript?: string;
  syncedToServer: boolean;
}

// Module-level state
let recordings: Recording[] = [];
let isLoading = true;
let currentlyPlaying: string | null = null;
let _version = 0; // Used to trigger re-renders

// Simple event emitter for state updates
type Listener = () => void;
const listeners = new Set<Listener>();

const emitChange = () => {
  _version++;
  listeners.forEach((l) => l());
};

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Helper to generate unique ID
const generateId = () => `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

// Helper to ensure recordings directory exists
const ensureRecordingsDir = async () => {
  const dirInfo = await FileSystem.getInfoAsync(RECORDINGS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
  }
};

// Helper to serialize recordings for storage
const serializeRecordings = (recs: Recording[]): string => {
  return JSON.stringify(
    recs.map((r) => ({
      ...r,
      timestamp: r.timestamp.toISOString(),
    }))
  );
};

// Helper to deserialize recordings from storage
const deserializeRecordings = (json: string): Recording[] => {
  try {
    const parsed = JSON.parse(json);
    return parsed.map((r: any) => ({
      ...r,
      timestamp: new Date(r.timestamp),
    }));
  } catch {
    return [];
  }
};

// Store actions (can be called from anywhere)
export const recordingStore = {
  getRecordings: () => recordings,
  getIsLoading: () => isLoading,
  getCurrentlyPlaying: () => currentlyPlaying,

  addRecording: async (recordingData: Omit<Recording, 'id'>) => {
    const id = generateId();
    const newRecording: Recording = {
      ...recordingData,
      id,
      timestamp: new Date(recordingData.timestamp),
    };

    await ensureRecordingsDir();
    const newUri = `${RECORDINGS_DIR}${id}.m4a`;

    try {
      await FileSystem.copyAsync({
        from: recordingData.uri,
        to: newUri,
      });

      newRecording.uri = newUri;
      recordings = [newRecording, ...recordings];
      emitChange();

      await FileSystem.writeAsStringAsync(METADATA_FILE, serializeRecordings(recordings));
      console.log('[RecordingStore] Added recording:', id);
    } catch (error) {
      console.error('[RecordingStore] Failed to add recording:', error);
      throw error;
    }
  },

  deleteRecording: async (id: string) => {
    const recording = recordings.find((r) => r.id === id);
    if (!recording) return;

    try {
      await FileSystem.deleteAsync(recording.uri, { idempotent: true });
      recordings = recordings.filter((r) => r.id !== id);
      emitChange();
      await FileSystem.writeAsStringAsync(METADATA_FILE, serializeRecordings(recordings));
      console.log('[RecordingStore] Deleted recording:', id);
    } catch (error) {
      console.error('[RecordingStore] Failed to delete recording:', error);
      throw error;
    }
  },

  loadRecordings: async () => {
    isLoading = true;
    emitChange();

    try {
      await ensureRecordingsDir();

      const fileInfo = await FileSystem.getInfoAsync(METADATA_FILE);
      if (fileInfo.exists) {
        const json = await FileSystem.readAsStringAsync(METADATA_FILE);
        const loadedRecordings = deserializeRecordings(json);

        const validRecordings = await Promise.all(
          loadedRecordings.map(async (r) => {
            const info = await FileSystem.getInfoAsync(r.uri);
            return info.exists ? r : null;
          })
        );

        recordings = validRecordings.filter((r): r is Recording => r !== null);
      } else {
        recordings = [];
      }

      isLoading = false;
      emitChange();
      console.log('[RecordingStore] Loaded recordings:', recordings.length);
    } catch (error) {
      console.error('[RecordingStore] Failed to load recordings:', error);
      recordings = [];
      isLoading = false;
      emitChange();
    }
  },

  setCurrentlyPlaying: (id: string | null) => {
    currentlyPlaying = id;
    emitChange();
  },
};

// React hook to use the store - uses simple useState + useEffect
export function useRecordingStore() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribe(() => {
      forceUpdate((n) => n + 1);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    recordings,
    isLoading,
    currentlyPlaying,
    addRecording: recordingStore.addRecording,
    deleteRecording: recordingStore.deleteRecording,
    loadRecordings: recordingStore.loadRecordings,
    setCurrentlyPlaying: recordingStore.setCurrentlyPlaying,
  };
}
