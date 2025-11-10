declare module 'react-native-audio-recorder-player' {
  export enum AVEncoderAudioQualityIOSType {
    min = 0,
    low = 32,
    medium = 64,
    high = 96,
    max = 127,
  }

  export enum AVEncodingOption {
    lpcm = 'lpcm',
    ima4 = 'ima4',
    aac = 'aac',
    MAC3 = 'MAC3',
    MAC6 = 'MAC6',
    ulaw = 'ulaw',
    alaw = 'alaw',
    mp1 = 'mp1',
    mp2 = 'mp2',
    alac = 'alac',
    amr = 'amr',
    flac = 'flac',
    opus = 'opus',
  }

  export enum AudioEncoderAndroidType {
    DEFAULT = 0,
    AMR_NB = 1,
    AMR_WB = 2,
    AAC = 3,
    HE_AAC = 4,
    AAC_ELD = 5,
    VORBIS = 6,
  }

  export enum AudioSourceAndroidType {
    DEFAULT = 0,
    MIC = 1,
    VOICE_UPLINK = 2,
    VOICE_DOWNLINK = 3,
    VOICE_CALL = 4,
    CAMCORDER = 5,
    VOICE_RECOGNITION = 6,
    VOICE_COMMUNICATION = 7,
    REMOTE_SUBMIX = 8,
    UNPROCESSED = 9,
    RADIO_TUNER = 1998,
    HOTWORD = 1999,
  }

  export enum OutputFormatAndroidType {
    DEFAULT = 0,
    THREE_GPP = 1,
    MPEG_4 = 2,
    AMR_NB = 3,
    AMR_WB = 4,
    AAC_ADIF = 5,
    AAC_ADTS = 6,
    OUTPUT_FORMAT_RTP_AVP = 7,
    MPEG_2_TS = 8,
    WEBM = 9,
    OGG = 11,
  }

  export interface AudioSet {
    AudioEncoderAndroid?: AudioEncoderAndroidType;
    AudioSourceAndroid?: AudioSourceAndroidType;
    AVEncoderAudioQualityKeyIOS?: AVEncoderAudioQualityIOSType;
    AVNumberOfChannelsKeyIOS?: number;
    AVFormatIDKeyIOS?: AVEncodingOption;
    OutputFormatAndroid?: OutputFormatAndroidType;
  }

  export interface RecordBackType {
    currentPosition: number;
    currentMetering?: number;
  }

  export interface PlayBackType {
    currentPosition: number;
    duration: number;
    isPlaying?: boolean;
  }

  export interface PlaybackStatus {
    isPlaying: boolean;
    currentPosition: number;
    duration: number;
  }

  export default class AudioRecorderPlayer {
    startRecorder(path?: string, audioSet?: AudioSet, meteringEnabled?: boolean): Promise<string>;

    stopRecorder(): Promise<string>;

    pauseRecorder(): Promise<string>;

    resumeRecorder(): Promise<string>;

    addRecordBackListener(callback: (e: RecordBackType) => void): void;

    removeRecordBackListener(): void;

    startPlayer(path?: string): Promise<string>;

    stopPlayer(): Promise<string>;

    pausePlayer(): Promise<string>;

    resumePlayer(): Promise<string>;

    setVolume(volume: number): Promise<string>;

    addPlayBackListener(callback: (e: PlayBackType) => void): void;

    removePlayBackListener(): void;

    getPlaybackStatus(): Promise<PlaybackStatus>;
  }
}
