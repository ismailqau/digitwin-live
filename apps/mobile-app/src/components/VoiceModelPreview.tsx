/**
 * VoiceModelPreview Component
 *
 * Provides UI for previewing and testing voice models.
 * Features:
 * - Voice model selection
 * - Test audio generation
 * - Quality comparison
 * - Model activation/deactivation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';

interface VoiceModel {
  id: string;
  provider: string;
  qualityScore: number;
  isActive: boolean;
  status: string;
  createdAt: string;
  metadata: {
    name?: string;
    description?: string;
    sampleCount?: number;
    totalDuration?: number;
  };
}

interface VoiceModelPreviewProps {
  onModelSelected?: (model: VoiceModel) => void;
  onClose?: () => void;
}

const TEST_PHRASES = [
  'Hello, this is a test of my voice model. How does it sound?',
  'The quick brown fox jumps over the lazy dog.',
  'I hope this voice clone sounds natural and clear.',
  'Technology has transformed the way we communicate with each other.',
  'Thank you for listening to my voice model preview.',
];

export const VoiceModelPreview: React.FC<VoiceModelPreviewProps> = ({
  onModelSelected,
  onClose,
}) => {
  const [models, setModels] = useState<VoiceModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<VoiceModel | null>(null);
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [selectedPhrase, setSelectedPhrase] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    loadVoiceModels();
  }, []);

  const loadVoiceModels = async () => {
    try {
      setLoading(true);

      // In a real implementation, this would fetch from the API
      // For now, we'll simulate the data
      const mockModels: VoiceModel[] = [
        {
          id: 'model_1',
          provider: 'xtts-v2',
          qualityScore: 87,
          isActive: true,
          status: 'completed',
          createdAt: new Date().toISOString(),
          metadata: {
            name: 'Primary Voice Model',
            description: 'High-quality voice model trained on 5 samples',
            sampleCount: 5,
            totalDuration: 320,
          },
        },
        {
          id: 'model_2',
          provider: 'google-cloud-tts',
          qualityScore: 82,
          isActive: false,
          status: 'completed',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          metadata: {
            name: 'Backup Voice Model',
            description: 'Alternative voice model with Google TTS',
            sampleCount: 4,
            totalDuration: 280,
          },
        },
      ];

      setModels(mockModels);
      setSelectedModel(mockModels.find((m) => m.isActive) || mockModels[0] || null);
    } catch (error) {
      Alert.alert('Error', 'Failed to load voice models');
      console.error('Load voice models error:', error);
    } finally {
      setLoading(false);
    }
  };

  const testVoiceModel = async (model: VoiceModel) => {
    try {
      setTestingModel(model.id);
      setIsPlaying(true);

      // In a real implementation, this would:
      // 1. Send the test phrase to the TTS service
      // 2. Generate audio using the selected voice model
      // 3. Play the generated audio

      // Simulate TTS generation and playback
      await new Promise((resolve) => setTimeout(resolve, 2000));

      Alert.alert(
        'Voice Test',
        `Playing test phrase with ${model.metadata.name || 'Voice Model'}\n\n"${TEST_PHRASES[selectedPhrase]}"`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to test voice model');
      console.error('Test voice model error:', error);
    } finally {
      setTestingModel(null);
      setIsPlaying(false);
    }
  };

  const activateModel = async (model: VoiceModel) => {
    try {
      // In a real implementation, this would call the API to activate the model
      Alert.alert(
        'Activate Voice Model',
        `Are you sure you want to activate "${model.metadata.name || 'this voice model'}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Activate',
            onPress: async () => {
              // Update local state
              setModels((prev) =>
                prev.map((m) => ({
                  ...m,
                  isActive: m.id === model.id,
                }))
              );
              setSelectedModel({ ...model, isActive: true });

              Alert.alert('Success', 'Voice model activated successfully');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to activate voice model');
      console.error('Activate voice model error:', error);
    }
  };

  const deleteModel = async (model: VoiceModel) => {
    try {
      Alert.alert(
        'Delete Voice Model',
        `Are you sure you want to delete "${model.metadata.name || 'this voice model'}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              // Update local state
              setModels((prev) => prev.filter((m) => m.id !== model.id));
              if (selectedModel?.id === model.id) {
                setSelectedModel(models.find((m) => m.id !== model.id) || null);
              }

              Alert.alert('Success', 'Voice model deleted successfully');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to delete voice model');
      console.error('Delete voice model error:', error);
    }
  };

  const getProviderDisplayName = (provider: string): string => {
    switch (provider) {
      case 'xtts-v2':
        return 'XTTS-v2';
      case 'google-cloud-tts':
        return 'Google Cloud TTS';
      case 'openai-tts':
        return 'OpenAI TTS';
      default:
        return provider;
    }
  };

  const getQualityColor = (score: number): string => {
    if (score >= 85) return '#4CAF50'; // Green
    if (score >= 70) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading voice models...</Text>
      </View>
    );
  }

  if (models.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Voice Models</Text>
        <Text style={styles.emptyText}>
          You haven't created any voice models yet. Record some voice samples to get started.
        </Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Voice Model Preview</Text>
        <Text style={styles.subtitle}>Test and manage your voice models</Text>
      </View>

      {/* Test Phrase Selection */}
      <View style={styles.phraseContainer}>
        <Text style={styles.phraseTitle}>Test Phrase:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {TEST_PHRASES.map((phrase, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.phraseButton, selectedPhrase === index && styles.phraseButtonSelected]}
              onPress={() => setSelectedPhrase(index)}
            >
              <Text
                style={[
                  styles.phraseButtonText,
                  selectedPhrase === index && styles.phraseButtonTextSelected,
                ]}
                numberOfLines={2}
              >
                {phrase}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Voice Models List */}
      <View style={styles.modelsContainer}>
        <Text style={styles.modelsTitle}>Your Voice Models</Text>
        {models.map((model) => (
          <View key={model.id} style={styles.modelCard}>
            <View style={styles.modelHeader}>
              <View style={styles.modelInfo}>
                <Text style={styles.modelName}>
                  {model.metadata.name || `Voice Model ${model.id.slice(-4)}`}
                </Text>
                <Text style={styles.modelProvider}>{getProviderDisplayName(model.provider)}</Text>
                {model.isActive && (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                )}
              </View>
              <View style={styles.modelActions}>
                <TouchableOpacity
                  style={[
                    styles.testButton,
                    testingModel === model.id && styles.testButtonDisabled,
                  ]}
                  onPress={() => testVoiceModel(model)}
                  disabled={testingModel === model.id || isPlaying}
                >
                  {testingModel === model.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.testButtonText}>Test</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modelDetails}>
              <View style={styles.modelStat}>
                <Text style={styles.modelStatLabel}>Quality:</Text>
                <Text
                  style={[styles.modelStatValue, { color: getQualityColor(model.qualityScore) }]}
                >
                  {model.qualityScore}/100
                </Text>
              </View>
              <View style={styles.modelStat}>
                <Text style={styles.modelStatLabel}>Samples:</Text>
                <Text style={styles.modelStatValue}>{model.metadata.sampleCount || 0}</Text>
              </View>
              <View style={styles.modelStat}>
                <Text style={styles.modelStatLabel}>Duration:</Text>
                <Text style={styles.modelStatValue}>
                  {formatDuration(model.metadata.totalDuration || 0)}
                </Text>
              </View>
            </View>

            {model.metadata.description && (
              <Text style={styles.modelDescription}>{model.metadata.description}</Text>
            )}

            <View style={styles.modelButtonsContainer}>
              {!model.isActive && (
                <TouchableOpacity
                  style={styles.activateButton}
                  onPress={() => activateModel(model)}
                >
                  <Text style={styles.activateButtonText}>Activate</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.deleteButton} onPress={() => deleteModel(model)}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        {selectedModel && (
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => onModelSelected?.(selectedModel)}
          >
            <Text style={styles.selectButtonText}>
              Use {selectedModel.metadata.name || 'Selected Model'}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  phraseContainer: {
    marginBottom: 20,
  },
  phraseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  phraseButton: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginRight: 10,
    minWidth: 200,
    maxWidth: 250,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  phraseButtonSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  phraseButtonText: {
    fontSize: 14,
    color: '#333',
  },
  phraseButtonTextSelected: {
    color: '#fff',
  },
  modelsContainer: {
    marginBottom: 20,
  },
  modelsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  modelCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  modelInfo: {
    flex: 1,
  },
  modelName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  modelProvider: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  activeBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modelActions: {
    marginLeft: 10,
  },
  testButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  testButtonDisabled: {
    backgroundColor: '#ccc',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modelDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modelStat: {
    alignItems: 'center',
  },
  modelStatLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  modelStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  modelDescription: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  modelButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  activateButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    marginRight: 10,
  },
  activateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#F44336',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionContainer: {
    marginTop: 20,
  },
  selectButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#666',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default VoiceModelPreview;
