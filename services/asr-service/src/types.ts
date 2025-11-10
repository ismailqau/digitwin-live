// ASR Service Types

export interface ASRConfig {
  sampleRate: number;
  encoding: AudioEncoding;
  languageCode?: string;
  enableAutomaticPunctuation: boolean;
  enableWordTimeOffsets: boolean;
  model: 'chirp' | 'latest_long' | 'latest_short';
  enableInterimResults: boolean;
  maxAlternatives?: number;
  profanityFilter?: boolean;
  speechContexts?: SpeechContext[];
  enableSpeakerDiarization?: boolean;
  diarizationSpeakerCount?: number;
}

export enum AudioEncoding {
  LINEAR16 = 'LINEAR16',
  FLAC = 'FLAC',
  MULAW = 'MULAW',
  AMR = 'AMR',
  AMR_WB = 'AMR_WB',
  OGG_OPUS = 'OGG_OPUS',
  SPEEX_WITH_HEADER_BYTE = 'SPEEX_WITH_HEADER_BYTE',
  WEBM_OPUS = 'WEBM_OPUS',
}

export interface SpeechContext {
  phrases: string[];
  boost?: number;
}

export interface WordInfo {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
  speakerTag?: number;
}

export interface TranscriptResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  words?: WordInfo[];
  languageCode?: string;
  alternatives?: TranscriptAlternative[];
}

export interface TranscriptAlternative {
  transcript: string;
  confidence: number;
}

export interface StreamHandle {
  id: string;
  sessionId: string;
  stream: NodeJS.ReadWriteStream;
  config: ASRConfig;
  createdAt: Date;
}

export interface ASRMetrics {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  totalAudioDuration: number;
  transcriptionLatency: number;
  accuracy?: number;
  cost: number;
  errorCount: number;
  interimResultCount: number;
  finalResultCount: number;
}

export interface ASRCacheEntry {
  audioHash: string;
  transcript: string;
  confidence: number;
  languageCode: string;
  createdAt: Date;
  expiresAt: Date;
}
