// Mock for react-native-audio-recorder-player
class MockAudioRecorderPlayer {
  startRecorder = jest.fn().mockResolvedValue('file://path');
  stopRecorder = jest.fn().mockResolvedValue('file://path');
  pauseRecorder = jest.fn().mockResolvedValue(undefined);
  resumeRecorder = jest.fn().mockResolvedValue(undefined);
  startPlayer = jest.fn().mockResolvedValue('success');
  stopPlayer = jest.fn().mockResolvedValue('success');
  pausePlayer = jest.fn().mockResolvedValue('success');
  resumePlayer = jest.fn().mockResolvedValue('success');
  seekToPlayer = jest.fn().mockResolvedValue('success');
  setVolume = jest.fn().mockResolvedValue('success');
  setSubscriptionDuration = jest.fn();
  addRecordBackListener = jest.fn();
  addPlayBackListener = jest.fn();
  removeRecordBackListener = jest.fn();
  removePlayBackListener = jest.fn();
}

module.exports = MockAudioRecorderPlayer;
module.exports.default = MockAudioRecorderPlayer;

module.exports.AudioEncoderAndroidType = {
  AAC: 'aac',
  AAC_ELD: 'aac_eld',
  AMR_NB: 'amr_nb',
  AMR_WB: 'amr_wb',
  HE_AAC: 'he_aac',
  VORBIS: 'vorbis',
};

module.exports.AudioSourceAndroidType = {
  DEFAULT: 0,
  MIC: 1,
  VOICE_UPLINK: 2,
  VOICE_DOWNLINK: 3,
  VOICE_CALL: 4,
  CAMCORDER: 5,
  VOICE_RECOGNITION: 6,
  VOICE_COMMUNICATION: 7,
};

module.exports.AVEncoderAudioQualityIOSType = {
  min: 0,
  low: 32,
  medium: 64,
  high: 96,
  max: 127,
};

module.exports.AVEncodingOption = {
  lpcm: 'lpcm',
  ima4: 'ima4',
  aac: 'aac',
  MAC3: 'MAC3',
  MAC6: 'MAC6',
  ulaw: 'ulaw',
  alaw: 'alaw',
  mp1: 'mp1',
  mp2: 'mp2',
  alac: 'alac',
  amr: 'amr',
  flac: 'flac',
  opus: 'opus',
};

module.exports.OutputFormatAndroidType = {
  DEFAULT: 0,
  THREE_GPP: 1,
  MPEG_4: 2,
  AMR_NB: 3,
  AMR_WB: 4,
  AAC_ADTS: 6,
  MPEG_2_TS: 8,
  WEBM: 9,
};
