export interface AudioChunkMessage {
    type: 'audio_chunk';
    sessionId: string;
    sequenceNumber: number;
    audioData: string;
    timestamp: number;
}
export interface InterruptionMessage {
    type: 'interruption';
    sessionId: string;
    timestamp: number;
}
export interface EndUtteranceMessage {
    type: 'end_utterance';
    sessionId: string;
    timestamp: number;
}
export interface TranscriptMessage {
    type: 'transcript';
    sessionId: string;
    transcript: string;
    isFinal: boolean;
    confidence: number;
}
export interface ResponseStartMessage {
    type: 'response_start';
    sessionId: string;
    turnId: string;
}
export interface ResponseAudioMessage {
    type: 'response_audio';
    sessionId: string;
    turnId: string;
    audioData: string;
    sequenceNumber: number;
    timestamp: number;
}
export interface ResponseVideoMessage {
    type: 'response_video';
    sessionId: string;
    turnId: string;
    frameData: string;
    sequenceNumber: number;
    timestamp: number;
    format: 'jpeg' | 'h264';
}
export interface ResponseEndMessage {
    type: 'response_end';
    sessionId: string;
    turnId: string;
    metrics: {
        totalLatencyMs: number;
        asrLatencyMs: number;
        ragLatencyMs: number;
        llmLatencyMs: number;
        ttsLatencyMs: number;
    };
}
export interface ErrorMessage {
    type: 'error';
    sessionId: string;
    errorCode: string;
    errorMessage: string;
    recoverable: boolean;
}
export type ClientMessage = AudioChunkMessage | InterruptionMessage | EndUtteranceMessage;
export type ServerMessage = TranscriptMessage | ResponseStartMessage | ResponseAudioMessage | ResponseVideoMessage | ResponseEndMessage | ErrorMessage;
//# sourceMappingURL=messages.d.ts.map