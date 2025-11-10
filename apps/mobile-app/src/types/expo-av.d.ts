declare module 'expo-av' {
  export interface AudioMode {
    allowsRecordingIOS?: boolean;
    playsInSilentModeIOS?: boolean;
    staysActiveInBackground?: boolean;
    interruptionModeIOS?: number;
    shouldDuckAndroid?: boolean;
    interruptionModeAndroid?: number;
    playThroughEarpieceAndroid?: boolean;
  }

  export interface AudioSource {
    uri?: string;
    [key: string]: unknown;
  }

  export interface AudioStatus {
    isLoaded: boolean;
    isPlaying?: boolean;
    positionMillis?: number;
    durationMillis?: number;
    rate?: number;
    volume?: number;
    [key: string]: unknown;
  }

  export class Audio {
    static INTERRUPTION_MODE_IOS_MIX_WITH_OTHERS: number;
    static INTERRUPTION_MODE_IOS_DO_NOT_MIX: number;
    static INTERRUPTION_MODE_IOS_DUCK_OTHERS: number;
    static INTERRUPTION_MODE_ANDROID_DO_NOT_MIX: number;
    static INTERRUPTION_MODE_ANDROID_DUCK_OTHERS: number;

    static setAudioModeAsync(mode: AudioMode): Promise<void>;

    static Sound: typeof Sound;
  }

  export class Sound {
    loadAsync(source: AudioSource | number, initialStatus?: Partial<AudioStatus>): Promise<void>;
    unloadAsync(): Promise<void>;
    playAsync(): Promise<void>;
    pauseAsync(): Promise<void>;
    stopAsync(): Promise<void>;
    setPositionAsync(position: number): Promise<void>;
    setRateAsync(rate: number, shouldCorrectPitch: boolean): Promise<void>;
    setVolumeAsync(volume: number): Promise<void>;
    getStatusAsync(): Promise<AudioStatus>;
  }

  export interface AVPlaybackStatus {
    isLoaded: boolean;
    isPlaying?: boolean;
    positionMillis?: number;
    durationMillis?: number;
    [key: string]: unknown;
  }
}
