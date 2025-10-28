export interface VoiceModel {
  id: string;
  userId: string;
  provider: string;
  modelPath: string;
  sampleRate: number;
  createdAt: Date;
  qualityScore: number;
}

export interface VoiceConfig {
  provider: string;
  voiceModelId: string;
  sampleRate: number;
  speed: number;
  pitch: number;
}

export interface AudioBuffer {
  data: Buffer;
  sampleRate: number;
  channels: number;
  duration: number;
}
