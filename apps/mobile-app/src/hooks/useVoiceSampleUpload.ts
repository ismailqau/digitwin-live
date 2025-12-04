/**
 * useVoiceSampleUpload Hook
 *
 * Custom hook for managing voice sample uploads with progress tracking.
 */

import { useState, useCallback } from 'react';

import { VoiceSample } from '../services/VoiceSampleManager';

interface UploadProgress {
  sampleId: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
}

interface VoiceModelCreationProgress {
  status: 'idle' | 'uploading' | 'processing' | 'training' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep: string;
  estimatedTimeRemaining?: number;
  error?: string;
}

interface UseVoiceSampleUploadReturn {
  uploadProgress: Record<string, UploadProgress>;
  modelCreationProgress: VoiceModelCreationProgress | null;
  uploadSample: (sample: VoiceSample) => Promise<void>;
  createVoiceModel: (samples: VoiceSample[], provider: string) => Promise<void>;
  clearProgress: () => void;
}

const API_BASE_URL = process.env.WEBSOCKET_URL || 'http://192.168.100.204:3001';

export const useVoiceSampleUpload = (): UseVoiceSampleUploadReturn => {
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [modelCreationProgress, setModelCreationProgress] =
    useState<VoiceModelCreationProgress | null>(null);

  const updateUploadProgress = useCallback((sampleId: string, update: Partial<UploadProgress>) => {
    setUploadProgress((prev) => ({
      ...prev,
      [sampleId]: {
        ...prev[sampleId],
        sampleId,
        ...update,
      },
    }));
  }, []);

  const uploadSample = useCallback(
    async (sample: VoiceSample) => {
      try {
        updateUploadProgress(sample.id, {
          progress: 0,
          status: 'uploading',
        });

        // Create FormData for multipart upload
        const formData = new FormData();

        // In a real implementation, you would read the actual audio file
        // For now, we'll simulate the upload with a File object
        const audioFile = new File(['simulated audio data'], sample.filename, {
          type: 'audio/wav',
          lastModified: Date.now(),
        });
        formData.append('audio', audioFile);
        formData.append('filename', sample.filename);
        formData.append('contentType', 'audio/wav');
        formData.append('duration', sample.duration.toString());
        formData.append('sampleRate', sample.metadata.sampleRate.toString());
        formData.append('channels', sample.metadata.channels.toString());
        formData.append('qualityScore', sample.qualityScore.toString());
        formData.append(
          'metadata',
          JSON.stringify({
            snr: sample.snr,
            hasClipping: sample.hasClipping,
            hasBackgroundNoise: sample.hasBackgroundNoise,
          })
        );

        // Simulate chunked upload with progress
        const chunkSize = 64 * 1024; // 64KB chunks
        const totalSize = sample.metadata.fileSize;
        const chunks = Math.ceil(totalSize / chunkSize);

        for (let chunk = 0; chunk < chunks; chunk++) {
          // Simulate upload delay
          await new Promise((resolve) => setTimeout(resolve, 200));

          const progress = Math.round(((chunk + 1) / chunks) * 100);
          updateUploadProgress(sample.id, { progress });
        }

        // Make actual API call
        const response = await fetch(`${API_BASE_URL}/api/v1/voice/samples`, {
          method: 'POST',
          body: formData,
          headers: {
            // Authorization header would be added here
            // 'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Upload failed');
        }

        const result = await response.json();

        updateUploadProgress(sample.id, {
          progress: 100,
          status: 'completed',
        });

        console.log('Voice sample uploaded successfully:', result);
      } catch (error) {
        updateUploadProgress(sample.id, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Upload failed',
        });
        throw error;
      }
    },
    [updateUploadProgress]
  );

  const createVoiceModel = useCallback(
    async (samples: VoiceSample[], provider: string) => {
      try {
        setModelCreationProgress({
          status: 'uploading',
          progress: 0,
          currentStep: 'Uploading voice samples',
        });

        // Upload all samples first
        const sampleIds: string[] = [];
        for (let i = 0; i < samples.length; i++) {
          const sample = samples[i];
          await uploadSample(sample);
          sampleIds.push(sample.id);

          const progress = Math.round(((i + 1) / samples.length) * 70); // 70% for upload phase
          setModelCreationProgress((prev) =>
            prev
              ? {
                  ...prev,
                  progress,
                  currentStep: `Uploading sample ${i + 1}/${samples.length}`,
                }
              : null
          );
        }

        setModelCreationProgress((prev) =>
          prev
            ? {
                ...prev,
                status: 'processing',
                progress: 75,
                currentStep: 'Creating voice model',
              }
            : null
        );

        // Create voice model
        const response = await fetch(`${API_BASE_URL}/api/v1/voice/models`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            provider,
            sampleIds,
            name: `Voice Model ${new Date().toLocaleDateString()}`,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Voice model creation failed');
        }

        const result = await response.json();

        setModelCreationProgress({
          status: 'training',
          progress: 80,
          currentStep: 'Training voice model',
          estimatedTimeRemaining: 1800, // 30 minutes
        });

        // Poll for training progress
        const pollProgress = async (modelId: string) => {
          try {
            const progressResponse = await fetch(
              `${API_BASE_URL}/api/v1/voice/models/${modelId}/progress`
            );
            if (progressResponse.ok) {
              const progressData = await progressResponse.json();

              setModelCreationProgress({
                status: progressData.status,
                progress: progressData.progress,
                currentStep: progressData.currentStep,
                estimatedTimeRemaining: progressData.estimatedTimeRemaining,
              });

              if (progressData.status === 'completed') {
                return;
              } else if (progressData.status === 'failed') {
                throw new Error('Voice model training failed');
              } else {
                // Continue polling
                setTimeout(() => pollProgress(modelId), 5000);
              }
            }
          } catch (error) {
            console.error('Error polling training progress:', error);
            setTimeout(() => pollProgress(modelId), 10000); // Retry after 10 seconds
          }
        };

        // Start polling
        pollProgress(result.id);
      } catch (error) {
        setModelCreationProgress({
          status: 'failed',
          progress: 0,
          currentStep: 'Voice model creation failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    },
    [uploadSample]
  );

  const clearProgress = useCallback(() => {
    setUploadProgress({});
    setModelCreationProgress(null);
  }, []);

  return {
    uploadProgress,
    modelCreationProgress,
    uploadSample,
    createVoiceModel,
    clearProgress,
  };
};

export default useVoiceSampleUpload;
