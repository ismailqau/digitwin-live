/**
 * TranslateSynthesizeScreen
 *
 * Translate text from any supported language and synthesize audio output.
 * Supports all 13 languages including Urdu, Arabic, and Hindi.
 * Optionally use a saved library voice for cloning instead of a preset speaker.
 */

import { setAudioModeAsync, createAudioPlayer } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TTSClient,
  SPEAKERS,
  ALL_LANGUAGES,
  LANGUAGE_META,
  type Speaker,
  type LanguageCode,
  type VoiceEntry,
} from '../../services/TTSClient';

// ─── Language sample texts ────────────────────────────────────────────────────

const SAMPLE_TEXTS: Partial<Record<LanguageCode, string>> = {
  en: 'Hello, this is a test of the multilingual text-to-speech system.',
  zh: '你好，这是多语言语音合成系统的测试。',
  ja: 'こんにちは、これは多言語音声合成システムのテストです。',
  ko: '안녕하세요, 이것은 다국어 음성 합성 시스템의 테스트입니다.',
  de: 'Hallo, dies ist ein Test des mehrsprachigen Sprachsynthesesystems.',
  fr: 'Bonjour, ceci est un test du système de synthèse vocale multilingue.',
  es: 'Hola, esta es una prueba del sistema de síntesis de voz multilingüe.',
  it: 'Ciao, questo è un test del sistema di sintesi vocale multilingue.',
  pt: 'Olá, este é um teste do sistema de síntese de voz multilíngue.',
  ru: 'Привет, это тест многоязычной системы синтеза речи.',
  ur: 'السلام علیکم، یہ کثیر لسانی ٹیکسٹ ٹو اسپیچ سسٹم کا ٹیسٹ ہے۔',
  ar: 'مرحباً، هذا اختبار لنظام تحويل النص إلى كلام متعدد اللغات.',
  hi: 'नमस्ते, यह बहुभाषी टेक्स्ट टू स्पीच सिस्टम का परीक्षण है।',
};

// ─── Component ────────────────────────────────────────────────────────────────

export const TranslateSynthesizeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const playerRef = useRef<AudioPlayer | null>(null);

  const [text, setText] = useState(
    'Hello, this is a test of the multilingual text-to-speech system.'
  );
  const [sourceLang, setSourceLang] = useState<LanguageCode>('en');
  const [targetLang, setTargetLang] = useState<LanguageCode>('en');
  const [speaker, setSpeaker] = useState<Speaker>('Vivian');
  const [useLibraryVoice, setUseLibraryVoice] = useState(false);
  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    translated: string;
    duration: number;
    processingTime: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleUseLibraryToggle = useCallback((): void => {
    const next = !useLibraryVoice;
    setUseLibraryVoice(next);
    if (next) void loadVoices();
  }, [useLibraryVoice, loadVoices]);

  const handleSourceLangChange = useCallback((lang: LanguageCode): void => {
    setSourceLang(lang);
    const sample = SAMPLE_TEXTS[lang];
    if (sample) setText(sample);
  }, []);

  const synthesize = useCallback(async (): Promise<void> => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await TTSClient.translateSynthesize({
        text: text.trim(),
        source_language: sourceLang,
        target_language: targetLang,
        speaker: useLibraryVoice ? undefined : speaker,
        voice_id: useLibraryVoice && selectedVoiceId ? selectedVoiceId : undefined,
      });
      setResult({
        translated: resp.translated_text,
        duration: resp.duration,
        processingTime: resp.processing_time,
      });
      await playAudio(resp.audio_data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [text, sourceLang, targetLang, speaker, useLibraryVoice, selectedVoiceId]);

  const playAudio = async (base64: string): Promise<void> => {
    playerRef.current?.remove();
    await setAudioModeAsync({ playsInSilentMode: true });
    const uri = `${FileSystem.cacheDirectory}tts_${Date.now()}.wav`;
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
    const player = createAudioPlayer({ uri });
    playerRef.current = player;
    player.play();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>🌍 Translate & Synthesize</Text>
      <Text style={styles.subtitle}>Translate text and generate speech in any language</Text>

      {/* Source language */}
      <Text style={styles.label}>Source Language</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {ALL_LANGUAGES.map((l) => (
          <TouchableOpacity
            key={l}
            style={[styles.chip, sourceLang === l && styles.chipActive]}
            onPress={() => handleSourceLangChange(l)}
          >
            <Text style={[styles.chipText, sourceLang === l && styles.chipTextActive]}>
              {LANGUAGE_META[l].flag} {LANGUAGE_META[l].label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input text */}
      <Text style={styles.label}>Text</Text>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Enter text to translate and synthesize..."
        accessibilityLabel="Text to translate and synthesize"
      />

      {/* Target language */}
      <Text style={styles.label}>Target Language (output)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {ALL_LANGUAGES.map((l) => (
          <TouchableOpacity
            key={l}
            style={[styles.chip, targetLang === l && styles.chipActive]}
            onPress={() => setTargetLang(l)}
          >
            <Text style={[styles.chipText, targetLang === l && styles.chipTextActive]}>
              {LANGUAGE_META[l].flag} {LANGUAGE_META[l].label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Voice selection */}
      <View style={styles.toggleRow}>
        <Text style={styles.label}>Use Library Voice</Text>
        <TouchableOpacity
          style={[styles.toggle, useLibraryVoice && styles.toggleActive]}
          onPress={handleUseLibraryToggle}
          accessibilityRole="switch"
          accessibilityState={{ checked: useLibraryVoice }}
        >
          <Text style={styles.toggleText}>{useLibraryVoice ? 'ON' : 'OFF'}</Text>
        </TouchableOpacity>
      </View>

      {!useLibraryVoice && (
        <>
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
        </>
      )}

      {useLibraryVoice && (
        <>
          <Text style={styles.label}>Select Library Voice</Text>
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
              </Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Synthesize button */}
      <TouchableOpacity
        style={[styles.primaryBtn, (loading || !text.trim()) && styles.btnDisabled]}
        onPress={synthesize}
        disabled={loading || !text.trim()}
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>🔊 Translate & Synthesize</Text>
        )}
      </TouchableOpacity>

      {/* Result */}
      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>Translated text:</Text>
          <Text style={styles.resultTranslated}>{result.translated}</Text>
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
  label: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 4, marginTop: 10 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginBottom: 4,
  },
  chipRow: { flexDirection: 'row', marginBottom: 4, maxHeight: 40 },
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  toggle: {
    backgroundColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  toggleActive: { backgroundColor: '#34C759' },
  toggleText: { fontWeight: '700', color: '#333', fontSize: 13 },
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
  note: { fontSize: 13, color: '#8E8E93', marginBottom: 8 },
  primaryBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  resultBox: { backgroundColor: '#E8F5E9', borderRadius: 10, padding: 14, marginTop: 14 },
  resultLabel: { fontSize: 12, fontWeight: '600', color: '#2E7D32', marginBottom: 4 },
  resultTranslated: { fontSize: 14, color: '#1B5E20', marginBottom: 6 },
  resultMeta: { fontSize: 12, color: '#388E3C' },
  errorBox: { backgroundColor: '#FFEBEE', borderRadius: 10, padding: 12, marginTop: 12 },
  errorText: { color: '#C62828', fontSize: 13 },
});
