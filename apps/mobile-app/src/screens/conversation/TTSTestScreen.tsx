/**
 * TTSTestScreen — Qwen3-TTS dev/QA screen
 *
 * Tabs:
 *  1. Synthesize  — custom text, speaker, language
 *  2. Languages   — one-tap tests for all supported languages + Urdu/Arabic/Chinese extras
 *  3. Clone Voice — record mic → send to /clone → play result
 */

import {
  useAudioRecorder,
  useAudioRecorderState,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  createAudioPlayer,
} from 'expo-audio';
import type { AudioPlayer, AudioRecorder, RecordingOptions } from 'expo-audio';
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
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TTSClient,
  SPEAKERS,
  ALL_LANGUAGES,
  type Speaker,
  type LanguageCode,
} from '../../services/TTSClient';

// ─── Constants ───────────────────────────────────────────────────────────────

const QWEN3_TTS_URL = 'https://dev-qwen3-tts-854120816323.us-central1.run.app';
const HEALTH_TIMEOUT_MS = 360_000;

type TestTab = 'synthesize' | 'languages' | 'clone';

/**
 * WAV recording options — produces a RIFF/WAV file the service accepts natively.
 * iOS: outputFormat "lpcm" = IOSOutputFormat.LINEARPCM (AVAudioRecorder wraps it in WAV).
 * Android: 'default' output format — most devices produce a WAV-compatible stream.
 * Using raw string literals to avoid runtime enum resolution issues.
 */
const WAV_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.wav',
  sampleRate: 16000, // 16kHz optimal for voice cloning
  numberOfChannels: 1, // mono — sufficient for voice, smaller payload
  bitRate: 256000,
  ios: {
    outputFormat: 'lpcm', // IOSOutputFormat.LINEARPCM
    audioQuality: 96, // AudioQuality.HIGH
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    extension: '.wav',
    outputFormat: 'default',
    audioEncoder: 'default',
  },
  web: {
    mimeType: 'audio/wav',
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthStatus {
  status: string;
  device: string;
  custom_voice_model_loaded: boolean;
  base_model_loaded: boolean;
  gpu_available: boolean;
}

interface SynthesizeResult {
  audio_data: string;
  sample_rate: number;
  duration: number;
  speaker: string;
  processing_time: number;
}

interface LanguageSample {
  code: LanguageCode;
  flag: string;
  label: string;
  text: string;
  /** true = native Qwen3-TTS; false = translated via /translate-synthesize */
  native: boolean;
}

// ─── Language samples ─────────────────────────────────────────────────────────

const LANGUAGE_SAMPLES: LanguageSample[] = [
  {
    code: 'en',
    flag: '🇬🇧',
    label: 'English',
    native: true,
    text: 'Hello, this is a test of the Qwen3 text-to-speech system.',
  },
  {
    code: 'zh',
    flag: '🇨🇳',
    label: 'Chinese',
    native: true,
    text: '你好，这是Qwen3语音合成系统的测试。',
  },
  {
    code: 'ja',
    flag: '🇯🇵',
    label: 'Japanese',
    native: true,
    text: 'こんにちは、これはQwen3音声合成システムのテストです。',
  },
  {
    code: 'ko',
    flag: '🇰🇷',
    label: 'Korean',
    native: true,
    text: '안녕하세요, 이것은 Qwen3 음성 합성 시스템의 테스트입니다.',
  },
  {
    code: 'de',
    flag: '🇩🇪',
    label: 'German',
    native: true,
    text: 'Hallo, dies ist ein Test des Qwen3 Sprachsynthesesystems.',
  },
  {
    code: 'fr',
    flag: '🇫🇷',
    label: 'French',
    native: true,
    text: 'Bonjour, ceci est un test du système de synthèse vocale Qwen3.',
  },
  {
    code: 'es',
    flag: '🇪🇸',
    label: 'Spanish',
    native: true,
    text: 'Hola, esta es una prueba del sistema de síntesis de voz Qwen3.',
  },
  {
    code: 'it',
    flag: '🇮🇹',
    label: 'Italian',
    native: true,
    text: 'Ciao, questo è un test del sistema di sintesi vocale Qwen3.',
  },
  {
    code: 'pt',
    flag: '🇧🇷',
    label: 'Portuguese',
    native: true,
    text: 'Olá, este é um teste do sistema de síntese de voz Qwen3.',
  },
  {
    code: 'ru',
    flag: '🇷🇺',
    label: 'Russian',
    native: true,
    text: 'Привет, это тест системы синтеза речи Qwen3.',
  },
  {
    code: 'ur',
    flag: '🇵🇰',
    label: 'Urdu',
    native: false,
    text: 'السلام علیکم، یہ Qwen3 ٹیکسٹ ٹو اسپیچ سسٹم کا ٹیسٹ ہے۔',
  },
  {
    code: 'ar',
    flag: '🇸🇦',
    label: 'Arabic',
    native: false,
    text: 'مرحباً، هذا اختبار لنظام تحويل النص إلى كلام Qwen3.',
  },
  {
    code: 'hi',
    flag: '🇮🇳',
    label: 'Hindi',
    native: false,
    text: 'नमस्ते, यह Qwen3 टेक्स्ट टू स्पीच सिस्टम का परीक्षण है।',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function playBase64Audio(
  base64: string,
  playerRef: React.MutableRefObject<AudioPlayer | null>,
  onLog: (msg: string) => void
): Promise<void> {
  try {
    playerRef.current?.remove();
    playerRef.current = null;

    await setAudioModeAsync({ playsInSilentMode: true });

    const fileUri = `${FileSystem.cacheDirectory}tts_${Date.now()}.wav`;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const player: AudioPlayer = createAudioPlayer({ uri: fileUri });
    playerRef.current = player;
    player.play();
    onLog('Playback started');
  } catch (e) {
    onLog(`Playback error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export const TTSTestScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TestTab>('synthesize');

  // Shared state
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [waking, setWaking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const playerRef = useRef<AudioPlayer | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Synthesize tab
  const [text, setText] = useState('Hello, this is a test of the Qwen3 TTS voice cloning service.');
  const [speaker, setSpeaker] = useState<Speaker>('Vivian');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [synthLoading, setSynthLoading] = useState(false);
  const [synthResult, setSynthResult] = useState<SynthesizeResult | null>(null);
  const [synthError, setSynthError] = useState<string | null>(null);

  // Languages tab
  const [langLoading, setLangLoading] = useState<string | null>(null);

  // Clone tab
  const [cloneText, setCloneText] = useState(
    'This is my cloned voice speaking the text you provided.'
  );
  const [cloneLang, setCloneLang] = useState<LanguageCode>('en');
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneResult, setCloneResult] = useState<SynthesizeResult | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [refText, setRefText] = useState('');

  // Recorder (hook must always be called)
  const recorder: AudioRecorder = useAudioRecorder(WAV_RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 200);

  useEffect(() => () => stopTimer(), []);

  const addLog = useCallback((msg: string): void => {
    const ts = new Date().toLocaleTimeString();
    setLog((prev) => [`[${ts}] ${msg}`, ...prev.slice(0, 49)]);
  }, []);

  const startTimer = useCallback((): void => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }, []);

  const stopTimer = useCallback((): void => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ── Health / Wake ──────────────────────────────────────────────────────────

  const checkHealth = useCallback(async (): Promise<void> => {
    addLog('Checking health...');
    try {
      const res = await fetchWithTimeout(`${QWEN3_TTS_URL}/health`, {}, 15_000);
      const data = (await res.json()) as HealthStatus;
      setHealth(data);
      addLog(
        `Health: ${data.status} | ${data.device} | models: ${data.custom_voice_model_loaded && data.base_model_loaded ? '✅' : '⏳'}`
      );
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === 'AbortError'
            ? 'Timed out — use Wake Service'
            : e.message
          : String(e);
      addLog(`Health failed: ${msg}`);
    }
  }, [addLog]);

  const wakeService = useCallback(async (): Promise<void> => {
    setWaking(true);
    setHealth(null);
    startTimer();
    addLog('Waking service (cold start ~5 min)...');
    try {
      const res = await fetchWithTimeout(`${QWEN3_TTS_URL}/health`, {}, HEALTH_TIMEOUT_MS);
      const data = (await res.json()) as HealthStatus;
      setHealth(data);
      addLog(`Awake: ${data.status} | ${data.device}`);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === 'AbortError'
            ? 'Timed out after 6 min'
            : e.message
          : String(e);
      addLog(`Wake failed: ${msg}`);
    } finally {
      setWaking(false);
      stopTimer();
    }
  }, [addLog, startTimer, stopTimer]);

  // ── Synthesize ─────────────────────────────────────────────────────────────

  const synthesize = useCallback(async (): Promise<void> => {
    if (!text.trim()) return;
    setSynthLoading(true);
    setSynthError(null);
    setSynthResult(null);
    startTimer();
    addLog(`Synthesizing: "${text.substring(0, 40)}..." speaker=${speaker} lang=${language}`);
    try {
      const t0 = Date.now();
      const data = await TTSClient.synthesize({ text, speaker, language });
      setSynthResult(data);
      addLog(`Done ${Date.now() - t0}ms | server=${data.processing_time}s | dur=${data.duration}s`);
      await playBase64Audio(data.audio_data, playerRef, addLog);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === 'AbortError'
            ? 'Timed out — wake service first'
            : e.message
          : String(e);
      setSynthError(msg);
      addLog(`Synth failed: ${msg}`);
    } finally {
      setSynthLoading(false);
      stopTimer();
    }
  }, [text, speaker, language, addLog, startTimer, stopTimer]);

  // ── Language quick-test ────────────────────────────────────────────────────

  const testLanguage = useCallback(
    async (sample: LanguageSample): Promise<void> => {
      const key = sample.code;
      setLangLoading(key);
      addLog(`Testing ${sample.label}: "${sample.text.substring(0, 30)}..."`);
      try {
        let audioData: string;
        let duration: number;
        let processingTime: number;

        if (sample.native) {
          // Native language — direct synthesis
          const data = await TTSClient.synthesize({
            text: sample.text,
            speaker: 'Vivian',
            language: sample.code,
          });
          audioData = data.audio_data;
          duration = data.duration;
          processingTime = data.processing_time;
        } else {
          // Extended language — translate then synthesize
          const data = await TTSClient.translateSynthesize({
            text: sample.text,
            source_language: sample.code,
            target_language: sample.code,
            speaker: 'Vivian',
          });
          audioData = data.audio_data;
          duration = data.duration;
          processingTime = data.processing_time;
          addLog(`Translated: "${data.translated_text.substring(0, 40)}..."`);
        }

        addLog(`${sample.label} done | dur=${duration}s | server=${processingTime}s`);
        await playBase64Audio(audioData, playerRef, addLog);
      } catch (e) {
        const msg =
          e instanceof Error ? (e.name === 'AbortError' ? 'Timed out' : e.message) : String(e);
        addLog(`${sample.label} failed: ${msg}`);
      } finally {
        setLangLoading(null);
      }
    },
    [addLog]
  );

  // ── Voice Clone ────────────────────────────────────────────────────────────

  const startRecording = useCallback(async (): Promise<void> => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission required', 'Microphone access is needed to record a voice sample.');
      return;
    }
    setRecordedUri(null);
    setCloneError(null);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    addLog('Recording started — speak for 5–30 seconds');
  }, [recorder, addLog]);

  const stopRecording = useCallback(async (): Promise<void> => {
    await recorder.stop();
    const uri = recorder.uri;
    if (uri) {
      setRecordedUri(uri);
      addLog(`Recording saved: ${uri.split('/').pop()}`);
    } else {
      addLog('Recording stopped but no URI found');
    }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  }, [recorder, addLog]);

  const playRecording = useCallback(async (): Promise<void> => {
    if (!recordedUri) return;
    await playBase64Audio('', playerRef, addLog); // clear old player
    const player: AudioPlayer = createAudioPlayer({ uri: recordedUri });
    playerRef.current = player;
    player.play();
    addLog('Playing recording...');
  }, [recordedUri, addLog]);

  const cloneVoice = useCallback(async (): Promise<void> => {
    if (!recordedUri) {
      Alert.alert('No recording', 'Record a voice sample first.');
      return;
    }
    if (!cloneText.trim()) return;

    setCloneLoading(true);
    setCloneError(null);
    setCloneResult(null);
    startTimer();

    try {
      const base64Audio = await FileSystem.readAsStringAsync(recordedUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const fileSizeKb = Math.round((base64Audio.length * 3) / 4 / 1024);
      const ext = recordedUri.split('.').pop() ?? 'unknown';
      addLog(`Audio: ${ext.toUpperCase()} ~${fileSizeKb}KB`);

      const t0 = Date.now();
      const data = await TTSClient.clone({
        text: cloneText,
        speaker_audio: base64Audio,
        language: cloneLang,
        ref_text: refText.trim() || undefined,
      });
      setCloneResult(data);
      addLog(
        `Clone done ${Date.now() - t0}ms | server=${data.processing_time}s | dur=${data.duration}s`
      );
      await playBase64Audio(data.audio_data, playerRef, addLog);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === 'AbortError'
            ? 'Timed out — wake service first'
            : e.message
          : String(e);
      setCloneError(msg);
      addLog(`Clone failed: ${msg}`);
    } finally {
      setCloneLoading(false);
      stopTimer();
    }
  }, [recordedUri, cloneText, cloneLang, refText, addLog, startTimer, stopTimer]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const isServiceReady =
    health?.status === 'healthy' && health.custom_voice_model_loaded && health.base_model_loaded;
  const isBusy = synthLoading || waking || cloneLoading || langLoading !== null;
  const isRecording = recorderState.isRecording;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}
    >
      <Text style={styles.title}>Qwen3-TTS Test</Text>
      <Text style={styles.url}>{QWEN3_TTS_URL}</Text>

      {/* Service controls */}
      <View style={styles.statusRow}>
        <TouchableOpacity style={styles.healthBtn} onPress={checkHealth} disabled={isBusy}>
          <Text style={styles.healthBtnText}>Check Health</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.wakeBtn, waking && styles.btnDisabled]}
          onPress={wakeService}
          disabled={isBusy}
        >
          {waking ? (
            <View style={styles.row}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.wakeBtnText}> Waking... {elapsed}s</Text>
            </View>
          ) : (
            <Text style={styles.wakeBtnText}>☀️ Wake Service</Text>
          )}
        </TouchableOpacity>
      </View>

      {health && (
        <View style={[styles.badge, { backgroundColor: isServiceReady ? '#34C759' : '#FF9500' }]}>
          <Text style={styles.badgeText}>
            {health.status} | {health.device} | models: {isServiceReady ? '✅' : '⏳'}
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['synthesize', 'languages', 'clone'] as TestTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'synthesize'
                ? '🔊 Synth'
                : tab === 'languages'
                  ? '🌍 Languages'
                  : '🎤 Clone'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.tabContent} keyboardShouldPersistTaps="handled">
        {/* ── SYNTHESIZE TAB ── */}
        {activeTab === 'synthesize' && (
          <View>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              multiline
              placeholder="Enter text to synthesize..."
              accessibilityLabel="Text to synthesize"
            />

            <Text style={styles.label}>Speaker</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {SPEAKERS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, speaker === s && styles.chipActive]}
                  onPress={() => setSpeaker(s)}
                >
                  <Text style={[styles.chipText, speaker === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Language</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {ALL_LANGUAGES.map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.chip, language === l && styles.chipActive]}
                  onPress={() => setLanguage(l)}
                >
                  <Text style={[styles.chipText, language === l && styles.chipTextActive]}>
                    {l}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.primaryBtn, isBusy && styles.btnDisabled]}
              onPress={synthesize}
              disabled={isBusy}
              accessibilityRole="button"
            >
              {synthLoading ? (
                <View style={styles.row}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.primaryBtnText}> Synthesizing... {elapsed}s</Text>
                </View>
              ) : (
                <Text style={styles.primaryBtnText}>🔊 Synthesize</Text>
              )}
            </TouchableOpacity>

            {synthResult && (
              <View style={styles.resultBox}>
                <Text style={styles.resultText}>
                  dur={synthResult.duration}s | server={synthResult.processing_time}s | speaker=
                  {synthResult.speaker}
                </Text>
              </View>
            )}
            {synthError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{synthError}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── LANGUAGES TAB ── */}
        {activeTab === 'languages' && (
          <View>
            <Text style={styles.sectionTitle}>All Languages</Text>
            {LANGUAGE_SAMPLES.map((s) => (
              <TouchableOpacity
                key={s.code}
                style={[styles.langRow, langLoading === s.code && styles.btnDisabled]}
                onPress={() => testLanguage(s)}
                disabled={isBusy}
              >
                <View style={styles.langInfo}>
                  <Text style={styles.langFlag}>{s.flag}</Text>
                  <View style={styles.langTextCol}>
                    <Text style={styles.langLabel}>{s.label}</Text>
                    <Text style={styles.langSample} numberOfLines={1}>
                      {s.text}
                    </Text>
                    {!s.native && <Text style={styles.langNote}>via translate</Text>}
                  </View>
                </View>
                {langLoading === s.code ? (
                  <ActivityIndicator size="small" color="#007AFF" />
                ) : (
                  <Text style={styles.playIcon}>▶</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── CLONE TAB ── */}
        {activeTab === 'clone' && (
          <View>
            <Text style={styles.sectionTitle}>1. Record Voice Sample</Text>
            <Text style={styles.noteText}>
              Record at least 3 seconds (5–30s recommended). Speak clearly.
            </Text>

            <View style={styles.recordRow}>
              <TouchableOpacity
                style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
                onPress={isRecording ? stopRecording : startRecording}
                disabled={cloneLoading}
                accessibilityRole="button"
                accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
              >
                <Text style={styles.recordBtnText}>
                  {isRecording
                    ? `⏹ Stop  ${Math.round((recorderState.durationMillis ?? 0) / 1000)}s ${(recorderState.durationMillis ?? 0) < 3000 ? '(need 3s+)' : '✓'}`
                    : '🎙 Record WAV'}
                </Text>
              </TouchableOpacity>

              {recordedUri && !isRecording && (
                <TouchableOpacity style={styles.playRecordingBtn} onPress={playRecording}>
                  <Text style={styles.playRecordingText}>▶ Play</Text>
                </TouchableOpacity>
              )}
            </View>

            {recordedUri && (
              <View style={styles.recordedBadge}>
                <Text style={styles.recordedText}>✅ {recordedUri.split('/').pop()}</Text>
              </View>
            )}

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
              2. Reference Transcript (optional)
            </Text>
            <Text style={styles.noteText}>
              Providing the exact words you spoke improves cloning quality.
            </Text>
            <TextInput
              style={styles.input}
              value={refText}
              onChangeText={setRefText}
              placeholder="What did you say in the recording? (optional)"
              accessibilityLabel="Reference transcript"
            />

            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>3. Text to Synthesize</Text>
            <TextInput
              style={styles.input}
              value={cloneText}
              onChangeText={setCloneText}
              multiline
              placeholder="Text to speak in your cloned voice..."
              accessibilityLabel="Text to clone"
            />

            <Text style={styles.label}>Output Language</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {ALL_LANGUAGES.map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.chip, cloneLang === l && styles.chipActive]}
                  onPress={() => setCloneLang(l)}
                >
                  <Text style={[styles.chipText, cloneLang === l && styles.chipTextActive]}>
                    {l}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.cloneBtn, (isBusy || !recordedUri) && styles.btnDisabled]}
              onPress={cloneVoice}
              disabled={isBusy || !recordedUri}
              accessibilityRole="button"
            >
              {cloneLoading ? (
                <View style={styles.row}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.primaryBtnText}> Cloning... {elapsed}s</Text>
                </View>
              ) : (
                <Text style={styles.primaryBtnText}>🧬 Clone & Synthesize</Text>
              )}
            </TouchableOpacity>

            {cloneResult && (
              <View style={styles.resultBox}>
                <Text style={styles.resultText}>
                  dur={cloneResult.duration}s | server={cloneResult.processing_time}s |
                  speaker=clone
                </Text>
              </View>
            )}
            {cloneError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{cloneError}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Log */}
      <Text style={styles.label}>Log</Text>
      <ScrollView style={styles.logBox}>
        {log.map((entry, i) => (
          <Text key={`log-${i}`} style={styles.logEntry}>
            {entry}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 2 },
  url: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  healthBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  healthBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  wakeBtn: {
    backgroundColor: '#FF9500',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  wakeBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center' },
  btnDisabled: { opacity: 0.5 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  // Tabs
  tabRow: { flexDirection: 'row', marginBottom: 12, gap: 6 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#007AFF' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#555' },
  tabTextActive: { color: '#fff' },
  tabContent: { flex: 1 },
  // Inputs
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 56,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  label: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 4 },
  chipRow: { flexDirection: 'row', marginBottom: 10, maxHeight: 36 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
    marginRight: 6,
  },
  chipActive: { backgroundColor: '#007AFF' },
  chipText: { fontSize: 13, color: '#333' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  // Buttons
  primaryBtn: {
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cloneBtn: {
    backgroundColor: '#AF52DE',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  // Result / Error
  resultBox: { backgroundColor: '#E8F5E9', padding: 10, borderRadius: 8, marginBottom: 8 },
  resultText: {
    fontSize: 12,
    color: '#2E7D32',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F44336',
  },
  errorText: { fontSize: 12, color: '#C62828' },
  // Language tab
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 6 },
  noteText: { fontSize: 11, color: '#8E8E93', marginBottom: 8 },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  langInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  langFlag: { fontSize: 24, marginRight: 10 },
  langTextCol: { flex: 1 },
  langLabel: { fontSize: 13, fontWeight: '600', color: '#333' },
  langSample: { fontSize: 11, color: '#666', marginTop: 1 },
  langNote: { fontSize: 10, color: '#FF9500', marginTop: 2 },
  playIcon: { fontSize: 16, color: '#007AFF', paddingLeft: 8 },
  // Clone tab
  recordRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  recordBtn: {
    flex: 1,
    backgroundColor: '#FF3B30',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  recordBtnActive: { backgroundColor: '#8E0000' },
  recordBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  playRecordingBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  playRecordingText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  recordedBadge: { backgroundColor: '#E8F5E9', padding: 8, borderRadius: 8, marginBottom: 8 },
  recordedText: { fontSize: 12, color: '#2E7D32' },
  // Log
  logBox: { height: 100, backgroundColor: '#1E1E1E', borderRadius: 8, padding: 8, marginTop: 4 },
  logEntry: {
    fontSize: 10,
    color: '#A0A0A0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 1,
  },
});

export default TTSTestScreen;
