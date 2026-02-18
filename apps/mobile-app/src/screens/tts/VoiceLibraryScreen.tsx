/**
 * VoiceLibraryScreen
 *
 * Manage saved cloned voices:
 *  - List all voices with metadata
 *  - Add a new voice by recording a sample
 *  - Synthesize text with any saved voice
 *  - Delete voices
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
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TTSClient,
  type VoiceEntry,
  type LanguageCode,
  LANGUAGE_META,
  ALL_LANGUAGES,
} from '../../services/TTSClient';

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

type Screen = 'list' | 'add' | 'synthesize';

// ─── Component ────────────────────────────────────────────────────────────────

export const VoiceLibraryScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const playerRef = useRef<AudioPlayer | null>(null);

  const [screen, setScreen] = useState<Screen>('list');
  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add voice form
  const [voiceName, setVoiceName] = useState('');
  const [voiceDesc, setVoiceDesc] = useState('');
  const [voiceRefText, setVoiceRefText] = useState('');
  const [voiceLangHint, setVoiceLangHint] = useState<LanguageCode>('en');
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Synthesize with voice
  const [selectedVoice, setSelectedVoice] = useState<VoiceEntry | null>(null);
  const [synthText, setSynthText] = useState('Hello, this is my cloned voice.');
  const [synthLang, setSynthLang] = useState<LanguageCode>('en');
  const [synthLoading, setSynthLoading] = useState(false);
  const [synthResult, setSynthResult] = useState<string | null>(null);

  const recorder = useAudioRecorder(WAV_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 200);
  const isRecording = recorderState.isRecording;

  useEffect(() => {
    void loadVoices();
  }, []);

  const loadVoices = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const list = await TTSClient.listVoices();
      setVoices(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Recording ──────────────────────────────────────────────────────────────

  const startRecording = useCallback(async (): Promise<void> => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission required', 'Microphone access is needed to record a voice sample.');
      return;
    }
    setRecordedUri(null);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

  const stopRecording = useCallback(async (): Promise<void> => {
    await recorder.stop();
    const uri = recorder.uri;
    if (uri) setRecordedUri(uri);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  }, [recorder]);

  // ── Add voice ──────────────────────────────────────────────────────────────

  const addVoice = useCallback(async (): Promise<void> => {
    if (!voiceName.trim()) {
      Alert.alert('Name required', 'Enter a name for this voice.');
      return;
    }
    if (!recordedUri) {
      Alert.alert('Recording required', 'Record a voice sample first.');
      return;
    }

    setAddLoading(true);
    setAddError(null);
    try {
      const base64 = await FileSystem.readAsStringAsync(recordedUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const entry = await TTSClient.addVoice({
        name: voiceName.trim(),
        ref_audio: base64,
        description: voiceDesc.trim(),
        ref_text: voiceRefText.trim() || undefined,
        language_hint: voiceLangHint,
      });
      setVoices((prev) => [entry, ...prev]);
      setVoiceName('');
      setVoiceDesc('');
      setVoiceRefText('');
      setRecordedUri(null);
      setScreen('list');
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e));
    } finally {
      setAddLoading(false);
    }
  }, [voiceName, voiceDesc, voiceRefText, voiceLangHint, recordedUri]);

  // ── Delete voice ───────────────────────────────────────────────────────────

  const deleteVoice = useCallback((voice: VoiceEntry): void => {
    Alert.alert('Delete voice', `Delete "${voice.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await TTSClient.deleteVoice(voice.id);
            setVoices((prev) => prev.filter((v) => v.id !== voice.id));
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  }, []);

  // ── Synthesize with voice ──────────────────────────────────────────────────

  const synthesizeWithVoice = useCallback(async (): Promise<void> => {
    if (!selectedVoice || !synthText.trim()) return;
    setSynthLoading(true);
    setSynthResult(null);
    try {
      const resp = await TTSClient.synthesizeWithVoice(selectedVoice.id, {
        text: synthText,
        language: synthLang,
      });
      setSynthResult(`✅ ${resp.duration.toFixed(1)}s audio | server ${resp.processing_time}s`);
      await playAudio(resp.audio_data);
    } catch (e) {
      setSynthResult(`❌ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSynthLoading(false);
    }
  }, [selectedVoice, synthText, synthLang]);

  const playAudio = async (base64: string): Promise<void> => {
    playerRef.current?.remove();
    await setAudioModeAsync({ playsInSilentMode: true });
    const uri = `${FileSystem.cacheDirectory}tts_${Date.now()}.wav`;
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    const player = createAudioPlayer({ uri });
    playerRef.current = player;
    player.play();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>🎙 Voice Library</Text>
        {screen !== 'list' && (
          <TouchableOpacity onPress={() => setScreen('list')}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── LIST ── */}
      {screen === 'list' && (
        <>
          <TouchableOpacity style={styles.addBtn} onPress={() => setScreen('add')}>
            <Text style={styles.addBtnText}>+ Add Voice</Text>
          </TouchableOpacity>

          {loading && <ActivityIndicator style={{ marginTop: 24 }} />}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {!loading && voices.length === 0 && (
            <Text style={styles.emptyText}>No voices saved yet. Add one to get started.</Text>
          )}

          <FlatList
            data={voices}
            keyExtractor={(v) => v.id}
            renderItem={({ item }) => (
              <View style={styles.voiceCard}>
                <View style={styles.voiceInfo}>
                  <Text style={styles.voiceName}>{item.name}</Text>
                  {item.description ? (
                    <Text style={styles.voiceDesc}>{item.description}</Text>
                  ) : null}
                  <Text style={styles.voiceMeta}>
                    {LANGUAGE_META[item.language_hint as LanguageCode]?.flag ?? '🌐'}{' '}
                    {item.language_hint} · {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.voiceActions}>
                  <TouchableOpacity
                    style={styles.synthVoiceBtn}
                    onPress={() => {
                      setSelectedVoice(item);
                      setScreen('synthesize');
                    }}
                  >
                    <Text style={styles.synthVoiceBtnText}>🔊</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteVoice(item)}>
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </>
      )}

      {/* ── ADD ── */}
      {screen === 'add' && (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        >
          <Text style={styles.sectionTitle}>1. Record Voice Sample</Text>
          <Text style={styles.note}>Speak clearly for 5–30 seconds.</Text>

          <TouchableOpacity
            style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <Text style={styles.recordBtnText}>
              {isRecording
                ? `⏹ Stop  ${Math.round((recorderState.durationMillis ?? 0) / 1000)}s`
                : '🎙 Record WAV'}
            </Text>
          </TouchableOpacity>

          {recordedUri && (
            <Text style={styles.recordedBadge}>✅ {recordedUri.split('/').pop()}</Text>
          )}

          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>2. Voice Details</Text>

          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={voiceName}
            onChangeText={setVoiceName}
            placeholder="e.g. My Voice"
            accessibilityLabel="Voice name"
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            value={voiceDesc}
            onChangeText={setVoiceDesc}
            placeholder="Optional description"
            accessibilityLabel="Voice description"
          />

          <Text style={styles.label}>Reference Transcript (optional — improves quality)</Text>
          <TextInput
            style={[styles.input, { minHeight: 60 }]}
            value={voiceRefText}
            onChangeText={setVoiceRefText}
            multiline
            placeholder="What did you say in the recording?"
            accessibilityLabel="Reference transcript"
          />

          <Text style={styles.label}>Language of Recording</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {ALL_LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.chip, voiceLangHint === l && styles.chipActive]}
                onPress={() => setVoiceLangHint(l)}
              >
                <Text style={[styles.chipText, voiceLangHint === l && styles.chipTextActive]}>
                  {LANGUAGE_META[l].flag} {l}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {addError && <Text style={styles.errorText}>{addError}</Text>}

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (addLoading || !recordedUri || !voiceName.trim()) && styles.btnDisabled,
            ]}
            onPress={addVoice}
            disabled={addLoading || !recordedUri || !voiceName.trim()}
          >
            {addLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>💾 Save Voice</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── SYNTHESIZE ── */}
      {screen === 'synthesize' && selectedVoice && (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        >
          <View style={styles.selectedVoiceBadge}>
            <Text style={styles.selectedVoiceText}>🎙 {selectedVoice.name}</Text>
          </View>

          <Text style={styles.label}>Text to Synthesize</Text>
          <TextInput
            style={[styles.input, { minHeight: 80 }]}
            value={synthText}
            onChangeText={setSynthText}
            multiline
            placeholder="Enter text..."
            accessibilityLabel="Text to synthesize"
          />

          <Text style={styles.label}>Output Language</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {ALL_LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.chip, synthLang === l && styles.chipActive]}
                onPress={() => setSynthLang(l)}
              >
                <Text style={[styles.chipText, synthLang === l && styles.chipTextActive]}>
                  {LANGUAGE_META[l].flag} {l}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.primaryBtn, (synthLoading || !synthText.trim()) && styles.btnDisabled]}
            onPress={synthesizeWithVoice}
            disabled={synthLoading || !synthText.trim()}
          >
            {synthLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>🔊 Synthesize with this Voice</Text>
            )}
          </TouchableOpacity>

          {synthResult && <Text style={styles.resultText}>{synthResult}</Text>}
        </ScrollView>
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  backBtn: { fontSize: 15, color: '#007AFF', fontWeight: '600' },
  addBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  emptyText: { textAlign: 'center', color: '#8E8E93', marginTop: 40, fontSize: 15 },
  voiceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceInfo: { flex: 1 },
  voiceName: { fontSize: 16, fontWeight: '700', color: '#333' },
  voiceDesc: { fontSize: 13, color: '#666', marginTop: 2 },
  voiceMeta: { fontSize: 12, color: '#8E8E93', marginTop: 4 },
  voiceActions: { flexDirection: 'row', gap: 8 },
  synthVoiceBtn: { backgroundColor: '#007AFF', borderRadius: 8, padding: 8 },
  synthVoiceBtnText: { fontSize: 18 },
  deleteBtn: { backgroundColor: '#FF3B30', borderRadius: 8, padding: 8 },
  deleteBtnText: { fontSize: 18 },
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
  chipRow: { flexDirection: 'row', marginBottom: 10, maxHeight: 40 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
    marginRight: 6,
  },
  chipActive: { backgroundColor: '#007AFF' },
  chipText: { fontSize: 13, color: '#555' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  recordBtn: {
    backgroundColor: '#34C759',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  recordBtnActive: { backgroundColor: '#FF3B30' },
  recordBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  recordedBadge: { backgroundColor: '#E8F5E9', borderRadius: 8, padding: 8, marginBottom: 8 },
  primaryBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  errorText: { color: '#FF3B30', fontSize: 13, marginTop: 8 },
  resultText: { color: '#34C759', fontSize: 13, marginTop: 8, fontWeight: '600' },
  selectedVoiceBadge: {
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  selectedVoiceText: { fontSize: 16, fontWeight: '700', color: '#1565C0' },
});
