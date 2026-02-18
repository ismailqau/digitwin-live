/**
 * TTSClient — typed API client for the Qwen3-TTS service.
 *
 * Covers all endpoints:
 *   /synthesize, /clone, /synthesize/stream
 *   /translate-synthesize, /audio-to-audio
 *   /clone/audio-to-audio
 *   /voices  (CRUD + /synthesize + /audio-to-audio)
 *   /languages, /speakers
 */

import { ENV } from '../config/env';

// ─── Base URL ─────────────────────────────────────────────────────────────────

export const TTS_BASE_URL: string =
  (ENV as unknown as Record<string, string>).QWEN3_TTS_URL ??
  'https://dev-qwen3-tts-854120816323.us-central1.run.app';

export const HEALTH_TIMEOUT_MS = 360_000;
export const SYNTH_TIMEOUT_MS = 300_000;

// ─── Enums ────────────────────────────────────────────────────────────────────

export const SPEAKERS = [
  'Vivian',
  'Serena',
  'Uncle_Fu',
  'Dylan',
  'Eric',
  'Ryan',
  'Aiden',
  'Ono_Anna',
  'Sohee',
] as const;

export type Speaker = (typeof SPEAKERS)[number];

export const ALL_LANGUAGES = [
  'en',
  'zh',
  'ja',
  'ko',
  'de',
  'fr',
  'es',
  'it',
  'pt',
  'ru',
  'ur',
  'ar',
  'hi',
] as const;

export const NATIVE_LANGUAGES = [
  'en',
  'zh',
  'ja',
  'ko',
  'de',
  'fr',
  'es',
  'it',
  'pt',
  'ru',
] as const;

export const EXTENDED_LANGUAGES = ['ur', 'ar', 'hi'] as const;

export type LanguageCode = (typeof ALL_LANGUAGES)[number];

export const LANGUAGE_META: Record<LanguageCode, { flag: string; label: string; native: boolean }> =
  {
    en: { flag: '🇬🇧', label: 'English', native: true },
    zh: { flag: '🇨🇳', label: 'Chinese', native: true },
    ja: { flag: '🇯🇵', label: 'Japanese', native: true },
    ko: { flag: '🇰🇷', label: 'Korean', native: true },
    de: { flag: '🇩🇪', label: 'German', native: true },
    fr: { flag: '🇫🇷', label: 'French', native: true },
    es: { flag: '🇪🇸', label: 'Spanish', native: true },
    it: { flag: '🇮🇹', label: 'Italian', native: true },
    pt: { flag: '🇧🇷', label: 'Portuguese', native: true },
    ru: { flag: '🇷🇺', label: 'Russian', native: true },
    ur: { flag: '🇵🇰', label: 'Urdu', native: false },
    ar: { flag: '🇸🇦', label: 'Arabic', native: false },
    hi: { flag: '🇮🇳', label: 'Hindi', native: false },
  };

// ─── Response types ───────────────────────────────────────────────────────────

export interface SynthesizeResponse {
  audio_data: string;
  sample_rate: number;
  duration: number;
  language: string;
  speaker: string;
  device_used: string;
  processing_time: number;
}

export interface TranslateSynthesizeResponse {
  audio_data: string;
  sample_rate: number;
  duration: number;
  source_language: string;
  target_language: string;
  original_text: string;
  translated_text: string;
  speaker: string;
  device_used: string;
  processing_time: number;
}

export interface CloneAudioToAudioResponse {
  audio_data: string;
  sample_rate: number;
  duration: number;
  detected_language: string;
  transcribed_text: string;
  speaker: string;
  device_used: string;
  processing_time: number;
}

export interface VoiceEntry {
  id: string;
  name: string;
  description: string;
  ref_text: string | null;
  created_at: string;
  language_hint: string;
}

export interface HealthStatus {
  status: string;
  device: string;
  platform: string;
  custom_voice_model_loaded: boolean;
  base_model_loaded: boolean;
  gpu_available: boolean;
  gpu_memory_used_mb?: number;
  gpu_memory_total_mb?: number;
}

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

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    let detail = body;
    try {
      const parsed = JSON.parse(body) as { detail?: string };
      if (parsed.detail) detail = parsed.detail;
    } catch {
      /* use raw */
    }
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

// ─── Client ───────────────────────────────────────────────────────────────────

export const TTSClient = {
  // ── Health ──────────────────────────────────────────────────────────────────

  async health(): Promise<HealthStatus> {
    const res = await fetchWithTimeout(`${TTS_BASE_URL}/health`, {}, 15_000);
    return parseResponse<HealthStatus>(res);
  },

  async wake(): Promise<HealthStatus> {
    const res = await fetchWithTimeout(`${TTS_BASE_URL}/health`, {}, HEALTH_TIMEOUT_MS);
    return parseResponse<HealthStatus>(res);
  },

  // ── Synthesis ────────────────────────────────────────────────────────────────

  async synthesize(params: {
    text: string;
    speaker?: Speaker;
    language?: LanguageCode;
    instruction?: string;
  }): Promise<SynthesizeResponse> {
    const res = await fetchWithTimeout(
      `${TTS_BASE_URL}/synthesize`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      SYNTH_TIMEOUT_MS
    );
    return parseResponse<SynthesizeResponse>(res);
  },

  async clone(params: {
    text: string;
    speaker_audio: string;
    ref_text?: string;
    language?: LanguageCode;
  }): Promise<SynthesizeResponse> {
    const res = await fetchWithTimeout(
      `${TTS_BASE_URL}/clone`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      SYNTH_TIMEOUT_MS
    );
    return parseResponse<SynthesizeResponse>(res);
  },

  // ── Translate + synthesize ───────────────────────────────────────────────────

  async translateSynthesize(params: {
    text: string;
    source_language: LanguageCode;
    target_language: LanguageCode;
    speaker?: Speaker;
    voice_id?: string;
    instruction?: string;
  }): Promise<TranslateSynthesizeResponse> {
    const res = await fetchWithTimeout(
      `${TTS_BASE_URL}/translate-synthesize`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      SYNTH_TIMEOUT_MS
    );
    return parseResponse<TranslateSynthesizeResponse>(res);
  },

  // ── Audio-to-audio (with translation) ───────────────────────────────────────

  async audioToAudio(params: {
    audio: string;
    target_language: LanguageCode;
    speaker?: Speaker;
    voice_id?: string;
    instruction?: string;
  }): Promise<TranslateSynthesizeResponse> {
    const res = await fetchWithTimeout(
      `${TTS_BASE_URL}/audio-to-audio`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      SYNTH_TIMEOUT_MS
    );
    return parseResponse<TranslateSynthesizeResponse>(res);
  },

  // ── Clone audio-to-audio (no translation) ───────────────────────────────────

  async cloneAudioToAudio(params: {
    audio: string;
    voice_id?: string;
    speaker_audio?: string;
    ref_text?: string;
  }): Promise<CloneAudioToAudioResponse> {
    const res = await fetchWithTimeout(
      `${TTS_BASE_URL}/clone/audio-to-audio`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      SYNTH_TIMEOUT_MS
    );
    return parseResponse<CloneAudioToAudioResponse>(res);
  },

  // ── Voice library ────────────────────────────────────────────────────────────

  async listVoices(): Promise<VoiceEntry[]> {
    const res = await fetchWithTimeout(`${TTS_BASE_URL}/voices`, {}, 15_000);
    return parseResponse<VoiceEntry[]>(res);
  },

  async addVoice(params: {
    name: string;
    ref_audio: string;
    description?: string;
    ref_text?: string;
    language_hint?: LanguageCode;
  }): Promise<VoiceEntry> {
    const res = await fetchWithTimeout(
      `${TTS_BASE_URL}/voices`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      SYNTH_TIMEOUT_MS
    );
    return parseResponse<VoiceEntry>(res);
  },

  async deleteVoice(voiceId: string): Promise<void> {
    await fetchWithTimeout(`${TTS_BASE_URL}/voices/${voiceId}`, { method: 'DELETE' }, 15_000);
  },

  async synthesizeWithVoice(
    voiceId: string,
    params: { text: string; language?: LanguageCode }
  ): Promise<SynthesizeResponse> {
    const res = await fetchWithTimeout(
      `${TTS_BASE_URL}/voices/${voiceId}/synthesize`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      SYNTH_TIMEOUT_MS
    );
    return parseResponse<SynthesizeResponse>(res);
  },

  async voiceAudioToAudio(
    voiceId: string,
    params: { audio: string }
  ): Promise<CloneAudioToAudioResponse> {
    const res = await fetchWithTimeout(
      `${TTS_BASE_URL}/voices/${voiceId}/audio-to-audio`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      SYNTH_TIMEOUT_MS
    );
    return parseResponse<CloneAudioToAudioResponse>(res);
  },
};
