/**
 * Face Store
 *
 * Module-level store for face model creation state management.
 * Replaces Zustand to avoid Hermes 'property is not configurable' proxy issues.
 */

import { useState, useEffect } from 'react';

export interface FacePhoto {
  id: string;
  uri: string;
  angle: 'frontal' | 'left' | 'right';
  qualityScore: number;
  isValid: boolean;
  issues: string[];
  capturedAt: Date;
  metadata: {
    width: number;
    height: number;
    fileSize: number;
  };
}

export interface FaceVideo {
  id: string;
  uri: string;
  duration: number;
  qualityScore: number;
  isValid: boolean;
  issues: string[];
  recordedAt: Date;
  thumbnailUri?: string;
  metadata: {
    width: number;
    height: number;
    fileSize: number;
    frameCount: number;
  };
}

export type FaceModelStatus =
  | 'idle'
  | 'uploading'
  | 'detecting'
  | 'embedding'
  | 'training'
  | 'completed'
  | 'failed';

export interface FaceModelProgress {
  status: FaceModelStatus;
  progress: number;
  currentStep: string;
  estimatedTimeRemaining?: number;
  error?: string;
}

export interface FaceModelResult {
  id: string;
  qualityScore: number;
  previewVideoUri?: string;
  createdAt: Date;
}

export interface FaceState {
  // Captured media
  photos: FacePhoto[];
  video: FaceVideo | null;
  captureMode: 'photo' | 'video';

  // Processing state
  isCapturing: boolean;
  isUploading: boolean;
  isProcessing: boolean;
  progress: FaceModelProgress;

  // Result
  faceModel: FaceModelResult | null;

  // Error handling
  error: string | null;

  // Actions
  setCaptureMode: (mode: 'photo' | 'video') => void;
  addPhoto: (photo: FacePhoto) => void;
  removePhoto: (photoId: string) => void;
  clearPhotos: () => void;
  setVideo: (video: FaceVideo | null) => void;
  setIsCapturing: (isCapturing: boolean) => void;
  setIsUploading: (isUploading: boolean) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setProgress: (progress: FaceModelProgress) => void;
  setFaceModel: (model: FaceModelResult | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const INITIAL_PROGRESS: FaceModelProgress = {
  status: 'idle',
  progress: 0,
  currentStep: '',
};

// Internal state storage
type FaceData = Omit<
  FaceState,
  | 'setCaptureMode'
  | 'addPhoto'
  | 'removePhoto'
  | 'clearPhotos'
  | 'setVideo'
  | 'setIsCapturing'
  | 'setIsUploading'
  | 'setIsProcessing'
  | 'setProgress'
  | 'setFaceModel'
  | 'setError'
  | 'reset'
>;

let faceData: FaceData = {
  photos: [],
  video: null,
  captureMode: 'photo',
  isCapturing: false,
  isUploading: false,
  isProcessing: false,
  progress: INITIAL_PROGRESS,
  faceModel: null,
  error: null,
};

// Event system for updates
const listeners = new Set<() => void>();

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// Actions implementation
const actions = {
  setCaptureMode: (mode: 'photo' | 'video') => {
    faceData.captureMode = mode;
    emitChange();
  },

  addPhoto: (photo: FacePhoto) => {
    faceData.photos = [...faceData.photos, photo];
    emitChange();
  },

  removePhoto: (photoId: string) => {
    faceData.photos = faceData.photos.filter((p) => p.id !== photoId);
    emitChange();
  },

  clearPhotos: () => {
    faceData.photos = [];
    emitChange();
  },

  setVideo: (video: FaceVideo | null) => {
    faceData.video = video;
    emitChange();
  },

  setIsCapturing: (isCapturing: boolean) => {
    faceData.isCapturing = isCapturing;
    emitChange();
  },

  setIsUploading: (isUploading: boolean) => {
    faceData.isUploading = isUploading;
    emitChange();
  },

  setIsProcessing: (isProcessing: boolean) => {
    faceData.isProcessing = isProcessing;
    emitChange();
  },

  setProgress: (progress: FaceModelProgress) => {
    faceData.progress = progress;
    emitChange();
  },

  setFaceModel: (faceModel: FaceModelResult | null) => {
    faceData.faceModel = faceModel;
    emitChange();
  },

  setError: (error: string | null) => {
    faceData.error = error;
    emitChange();
  },

  reset: () => {
    faceData = {
      photos: [],
      video: null,
      captureMode: 'photo',
      isCapturing: false,
      isUploading: false,
      isProcessing: false,
      progress: INITIAL_PROGRESS,
      faceModel: null,
      error: null,
    };
    emitChange();
  },
};

// Custom hook matching the previous generic Zustand signature
export const useFaceStore = (): FaceState => {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribe(() => forceUpdate((n) => n + 1));
    return unsubscribe;
  }, []);

  return {
    ...faceData,
    ...actions,
  };
};
