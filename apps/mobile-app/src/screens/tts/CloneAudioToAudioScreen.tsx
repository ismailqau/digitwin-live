/**
 * CloneAudioToAudioScreen
 *
 * Record or select input audio → transcribe → re-synthesize in the same language
 * using a cloned voice (no translation).
 *
 * Two clone source options:
 *  A) Library voice — pick a saved voice by ID
 *  B) Inline reference — record a new reference sample on the spot
 */

import {
  useAudioRecorder,
  useAudioRecorderState,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  createAudioPlayer,
} from 'expo-audio';
import type { AudioPlayer, RecordingOptions } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TTSClient, type VoiceEntry } from '../../services/TTSClient';

// ─── Constants ────────────────────────────────────────────────────────────────

const WAV_OPTIONS: RecordingOptions = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  ios: {
    outputFormat: 'lpcm',
    audioQuality: 96,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: { extension: '.wav', outputFormat: 'default', audioEncoder: 'default' },
  web: { mimeType: 'audio/wav' },
};

type CloneSource = 'library' | 'inline';

// ─── Component ────────────────────────────────────────────────────────────────

export const CloneAudioToAudioScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const playerRef = useRef<AudioPlayer | null>(null);

  // Input audio (what to transcribe)
  const inputRecorder = useAudioRecorder(WAV_OPTIONS);
  const inputRecorderState = useAudioRecorderState(inputRecorder, 200);
  const [inputUri, setInputUri] = useState<string | null>(null);

  // Reference audio (for inline cloning)
  const refRecorder = useAudioRecorder(WAV_OPTIONS);
  const refRecorderState = useAudioRecorderState(refRecorder, 200);
  const [refUri, setRefUri] = useState<string | null>(null);
  const [refText, setRefText] = useState('');

  // Clone source
  const [cloneSource, setCloneSource] = useState<CloneSource>('library');
  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  // Result
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    detectedLang: string;
    transcribed: string;
    duration: number;
    processingTime: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadVoices();
  }, []);

  const loadVoices = useCallback(async (): Promise<void> => {
    if (voicesLoaded) return;
    try {
      const list = await TTSClient.listVoices();
      setVoices(list);
      setVoicesLoaded(true);
    } catch {
      /* non-critical */
    }
  }, [voicesLoaded]);

  // ── Input recording ────────────────────────────────────────────────────────

  const startInputRecording = useCallback(async (): Promise<void> => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission required', 'Microphone access is needed.');
      return;
    }
    setInputUri(null);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await inputRecorder.prepareToRecordAsync();
    inputRecorder.record();
  }, [inputRecorder]);

  const stopInputRecording = useCallback(async (): Promise<void> => {
    await inputRecorder.stop();
    const uri = inputRecorder.uri;
    if (uri) setInputUri(uri);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  }, [inputRecorder]);

  // ── Reference recording (inline clone) ────────────────────────────────────

  const startRefRecording = useCallback(async (): Promise<void> => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission required', 'Microphone access is needed.');
      return;
    }
    setRefUri(null);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await refRecorder.prepareToRecordAsync();
    refRecorder.record();
  }, [refRecorder]);

  const stopRefRecording = useCallback(async (): Promise<void> => {
    await refRecorder.stop();
    const uri = refRecorder.uri;
    if (uri) setRefUri(uri);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  }, [refRecorder]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const submit = useCallback(async (): Promise<void> => {
    if (!inputUri) {
      Alert.alert('No input audio', 'Record the audio you want to re-synthesize.');
      return;
    }
    if (cloneSource === 'library' && !selectedVoiceId) {
      Alert.alert('No voice selected', 'Select a library voice.');
      return;
    }
    if (cloneSource === 'inline' && !refUri) {
      Alert.alert('No reference audio', 'Record a reference voice sample.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const inputBase64 = await FileSystem.readAsStringAsync(inputUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      let resp;
      if (cloneSource === 'library' && selectedVoiceId) {
        resp = await TTSClient.voiceAudioToAudio(selectedVoiceId, { audio: inputBase64 });
      } else {
        const refBase64 = await FileSystem.readAsStringAsync(refUri!, {
          encoding: FileSystem.EncodingType.Base64,
        });
        resp = await TTSClient.cloneAudioToAudio({
          audio: inputBase64,
          speaker_audio: refBase64,
          ref_text: refText.trim() || undefined,
        });
      }

      setResult({
        detectedLang: resp.detected_language,
        transcribed: resp.transcribed_text,
        duration: resp.duration,
        processingTime: resp.processing_time,
      });
      await playAudio(resp.audio_data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [inputUri, cloneSource, selectedVoiceId, refUri, refText]);

  const playAudio = async (base64: string): Promise<void> => {
    playerRef.current?.remove();
    await setAudioModeAsync({ playsInSilentMode: true });
    const uri = `${FileSystem.cacheDirectory}tts_${Date.now()}.wav`;
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    const player = createAudioPlayer({ uri });
    playerRef.current = player;
    player.play();
  };

  const isInputRecording = inputRecorderState.isRecording;
  const isRefRecording = refRecorderState.isRecording;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>🔄 Clone Audio-to-Audio</Text>
      <Text style={styles.subtitle}>
        Transcribe input audio and re-synthesize in the same language using a cloned voice
      </Text>

      {/* Step 1: Input audio */}
      <Text style={styles.sectionTitle}>1. Record Input Audio</Text>
      <Text style={styles.note}>
        This audio will be transcribed and re-spoken by the cloned voice.
      </Text>

      <TouchableOpacity
        style={[styles.recordBtn, isInputRecording && styles.recordBtnActive]}
        onPress={isInputRecording ? stopInputRecording : startInputRecording}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={isInputRecording ? 'Stop recording input' : 'Start recording input'}
      >
        <Text style={styles.recordBtnText}>
          {isInputRecording
            ? `⏹ Stop  ${Math.round((inputRecorderState.durationMillis ?? 0) / 1000)}s`
            : '🎙 Record Input Audio'}
        </Text>
      </TouchableOpacity>

      {inputUri && <Text style={styles.recordedBadge}>✅ Input: {inputUri.split('/').pop()}</Text>}

      {/* Step 2: Clone source */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>2. Clone Voice Source</Text>

      <View style={styles.sourceToggle}>
        <TouchableOpacity
          style={[styles.sourceBtn, cloneSource === 'library' && styles.sourceBtnActive]}
          onPress={() => setCloneSource('library')}
        >
          <Text
            style={[styles.sourceBtnText, cloneSource === 'library' && styles.sourceBtnTextActive]}
          >
            📚 Library Voice
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sourceBtn, cloneSource === 'inline' && styles.sourceBtnActive]}
          onPress={() => setCloneSource('inline')}
        >
          <Text
            style={[styles.sourceBtnText, cloneSource === 'inline' && styles.sourceBtnTextActive]}
          >
            🎙 Record Reference
          </Text>
        </TouchableOpacity>
      </View>

      {/* Library voice picker */}
      {cloneSource === 'library' && (
        <>
          {voices.length === 0 && (
            <Text style={styles.note}>No voices saved. Add voices in the Voice Library tab.</Text>
          )}
          {voices.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={[styles.voiceOption, selectedVoiceId === v.id && styles.voiceOptionActive]}
              onPress={() => setSelectedVoiceId(v.id)}
            >
              <Text
                style={[
                  styles.voiceOptionText,
                  selectedVoiceId === v.id && styles.voiceOptionTextActive,
                ]}
              >
                🎙 {v.name}
                {v.description ? `  ·  ${v.description}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Inline reference recording */}
      {cloneSource === 'inline' && (
        <>
          <Text style={styles.note}>Record at least 3 seconds of the voice you want to clone.</Text>

          <TouchableOpacity
            style={[
              styles.recordBtn,
              styles.recordBtnRef,
              isRefRecording && styles.recordBtnActive,
            ]}
            onPress={isRefRecording ? stopRefRecording : startRefRecording}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={
              isRefRecording ? 'Stop reference recording' : 'Start reference recording'
            }
          >
            <Text style={styles.recordBtnText}>
              {isRefRecording
                ? `⏹ Stop  ${Math.round((refRecorderState.durationMillis ?? 0) / 1000)}s`
                : '🎙 Record Reference Voice'}
            </Text>
          </TouchableOpacity>

          {refUri && (
            <Text style={styles.recordedBadge}>✅ Reference: {refUri.split('/').pop()}</Text>
          )}

          <Text style={styles.label}>Reference Transcript (optional — improves quality)</Text>
          <TextInput
            style={styles.input}
            value={refText}
            onChangeText={setRefText}
            placeholder="What did you say in the reference recording?"
            accessibilityLabel="Reference transcript"
          />
        </>
      )}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.primaryBtn, (loading || !inputUri) && styles.btnDisabled]}
        onPress={submit}
        disabled={loading || !inputUri}
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>🔄 Clone & Re-Synthesize</Text>
        )}
      </TouchableOpacity>

      {/* Result */}
      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>Detected language: {result.detectedLang}</Text>
          <Text style={styles.resultLabel}>Transcribed:</Text>
          <Text style={styles.resultTranscribed}>{result.transcribed}</Text>
          <Text style={styles.resultMeta}>
            {result.duration.toFixed(1)}s audio · {result.processingTime.toFixed(1)}s server
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </ScrollView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#8E8E93', marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 6 },
  note: { fontSize: 13, color: '#8E8E93', marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 8,
  },
  recordBtn: {
    backgroundColor: '#34C759',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  recordBtnRef: { backgroundColor: '#5856D6' },
  recordBtnActive: { backgroundColor: '#FF3B30' },
  recordBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  recordedBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    fontSize: 13,
    color: '#2E7D32',
  },
  sourceToggle: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  sourceBtn: {
    flex: 1,
    backgroundColor: '#E5E5EA',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  sourceBtnActive: { backgroundColor: '#007AFF' },
  sourceBtnText: { fontSize: 13, fontWeight: '600', color: '#555' },
  sourceBtnTextActive: { color: '#fff' },
  voiceOption: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  voiceOptionActive: { borderColor: '#007AFF', backgroundColor: '#E3F2FD' },
  voiceOptionText: { fontSize: 14, color: '#333' },
  voiceOptionTextActive: { color: '#1565C0', fontWeight: '600' },
  primaryBtn: {
    backgroundColor: '#5856D6',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  resultBox: { backgroundColor: '#E8F5E9', borderRadius: 10, padding: 14, marginTop: 14 },
  resultLabel: { fontSize: 12, fontWeight: '600', color: '#2E7D32', marginBottom: 2 },
  resultTranscribed: { fontSize: 14, color: '#1B5E20', marginBottom: 6 },
  resultMeta: { fontSize: 12, color: '#388E3C' },
  errorBox: { backgroundColor: '#FFEBEE', borderRadius: 10, padding: 12, marginTop: 12 },
  errorText: { color: '#C62828', fontSize: 13 },
});
