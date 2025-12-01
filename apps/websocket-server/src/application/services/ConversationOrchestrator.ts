import axios, { AxiosInstance } from 'axios';
import { injectable, inject } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';

import {
  AudioChunkMessage,
  ResponseStartMessage,
  ResponseAudioMessage,
  ResponseVideoMessage,
  ResponseEndMessage,
  ErrorMessage,
  TranscriptMessage,
} from '../../domain/models/Message';
import { logger } from '../../infrastructure/logging/logger';

import { ConnectionService } from './ConnectionService';
import { ConversationSessionService } from './ConversationSessionService';
import { SessionService } from './SessionService';

/**
 * Pipeline stage latency tracking
 */
interface PipelineLatencies {
  asrStartTime?: number;
  asrEndTime?: number;
  ragStartTime?: number;
  ragEndTime?: number;
  llmStartTime?: number;
  llmFirstTokenTime?: number;
  llmEndTime?: number;
  ttsStartTime?: number;
  ttsFirstChunkTime?: number;
  ttsEndTime?: number;
  lipsyncStartTime?: number;
  lipsyncFirstFrameTime?: number;
  lipsyncEndTime?: number;
  userSpeechEndTime?: number;
  firstAudioChunkTime?: number;
}

/**
 * Turn context for tracking conversation turn state
 */
interface TurnContext {
  turnId: string;
  sessionId: string;
  userId: string;
  audioChunks: AudioChunkMessage[];
  transcript?: string;
  ragContext?: string[];
  llmTokens: string[];
  sentenceBuffer: string;
  audioSequence: number;
  videoSequence: number;
  latencies: PipelineLatencies;
  cancelled: boolean;
}

/**
 * Service client configuration
 */
interface ServiceConfig {
  asrServiceUrl: string;
  ragServiceUrl: string;
  llmServiceUrl: string;
  ttsServiceUrl: string;
  lipsyncServiceUrl: string;
}

/**
 * ConversationOrchestrator coordinates the entire conversation pipeline:
 * Audio → ASR → RAG → LLM → TTS → Lip-sync → Playback
 *
 * Responsibilities:
 * - Route messages between services
 * - Track latency at each stage
 * - Handle errors and implement fallback strategies
 * - Manage conversation turn lifecycle
 */
@injectable()
export class ConversationOrchestrator {
  private activeTurns: Map<string, TurnContext> = new Map();
  private asrClient: AxiosInstance;
  private ragClient: AxiosInstance;
  private llmClient: AxiosInstance;
  private ttsClient: AxiosInstance;
  private lipsyncClient: AxiosInstance;

  constructor(
    @inject(ConnectionService) private connectionService: ConnectionService,
    @inject(SessionService) private sessionService: SessionService,
    @inject(ConversationSessionService)
    private conversationSessionService: ConversationSessionService
  ) {
    // Initialize service clients
    const config = this.getServiceConfig();

    this.asrClient = axios.create({
      baseURL: config.asrServiceUrl,
      timeout: 30000,
    });

    this.ragClient = axios.create({
      baseURL: config.ragServiceUrl,
      timeout: 10000,
    });

    this.llmClient = axios.create({
      baseURL: config.llmServiceUrl,
      timeout: 60000,
    });

    this.ttsClient = axios.create({
      baseURL: config.ttsServiceUrl,
      timeout: 30000,
    });

    this.lipsyncClient = axios.create({
      baseURL: config.lipsyncServiceUrl,
      timeout: 30000,
    });
  }

  /**
   * Get service configuration from environment variables
   */
  private getServiceConfig(): ServiceConfig {
    return {
      asrServiceUrl: process.env.ASR_SERVICE_URL || 'http://localhost:3001',
      ragServiceUrl: process.env.RAG_SERVICE_URL || 'http://localhost:3002',
      llmServiceUrl: process.env.LLM_SERVICE_URL || 'http://localhost:3003',
      ttsServiceUrl: process.env.TTS_SERVICE_URL || 'http://localhost:3004',
      lipsyncServiceUrl: process.env.LIPSYNC_SERVICE_URL || 'http://localhost:3005',
    };
  }

  /**
   * Handle incoming audio chunk from mobile app
   * Wire: Mobile App → WebSocket → ASR Service
   */
  async handleAudioChunk(sessionId: string, message: AudioChunkMessage): Promise<void> {
    try {
      // Get or create turn context
      let turnContext = this.activeTurns.get(sessionId);
      if (!turnContext) {
        const session = await this.sessionService.getSession(sessionId);
        if (!session) {
          throw new Error(`Session not found: ${sessionId}`);
        }

        turnContext = {
          turnId: uuidv4(),
          sessionId,
          userId: session.userId,
          audioChunks: [],
          llmTokens: [],
          sentenceBuffer: '',
          audioSequence: 0,
          videoSequence: 0,
          latencies: {
            userSpeechEndTime: Date.now(),
          },
          cancelled: false,
        };
        this.activeTurns.set(sessionId, turnContext);

        // Start ASR timing
        turnContext.latencies.asrStartTime = Date.now();
      }

      // Store audio chunk
      turnContext.audioChunks.push(message);

      // Forward to ASR service
      await this.forwardToASR(sessionId, message);

      logger.info(`Audio chunk forwarded to ASR`, {
        sessionId,
        sequenceNumber: message.sequenceNumber,
      });
    } catch (error) {
      await this.handleError(sessionId, 'asr', error as Error);
    }
  }

  /**
   * Handle end of user utterance
   * Signal ASR service to finalize transcript
   */
  async handleEndUtterance(sessionId: string): Promise<void> {
    try {
      const turnContext = this.activeTurns.get(sessionId);
      if (!turnContext) {
        logger.warn(`No active turn for session ${sessionId}`);
        return;
      }

      // Record user speech end time
      turnContext.latencies.userSpeechEndTime = Date.now();

      // Signal ASR to finalize
      await this.asrClient.post('/finalize', {
        sessionId,
      });

      logger.info(`End utterance signaled to ASR`, { sessionId });
    } catch (error) {
      await this.handleError(sessionId, 'asr', error as Error);
    }
  }

  /**
   * Forward audio chunk to ASR service
   */
  private async forwardToASR(sessionId: string, message: AudioChunkMessage): Promise<void> {
    try {
      // Send audio chunk to ASR service
      const response = await this.asrClient.post('/transcribe/stream', {
        sessionId,
        sequenceNumber: message.sequenceNumber,
        audioData: message.audioData,
        timestamp: message.timestamp,
      });

      // Handle interim results
      if (response.data.interim) {
        await this.handleASRInterim(sessionId, response.data);
      }

      // Handle final results
      if (response.data.final) {
        await this.handleASRFinal(sessionId, response.data);
      }
    } catch (error) {
      logger.error(`ASR service error`, { sessionId, error });
      throw error;
    }
  }

  /**
   * Handle interim ASR results
   * Wire: ASR Service → WebSocket → Mobile App
   */
  private async handleASRInterim(
    sessionId: string,
    asrResult: { transcript: string; confidence?: number }
  ): Promise<void> {
    const transcriptMessage: TranscriptMessage = {
      type: 'transcript',
      sessionId,
      timestamp: Date.now(),
      transcript: asrResult.transcript,
      isFinal: false,
      confidence: asrResult.confidence || 0,
    };

    this.sendToClient(sessionId, transcriptMessage);

    logger.debug(`Interim transcript sent`, {
      sessionId,
      transcript: asrResult.transcript,
    });
  }

  /**
   * Handle final ASR results
   * Wire: ASR Service → RAG Pipeline
   */
  private async handleASRFinal(
    sessionId: string,
    asrResult: { transcript: string; confidence?: number }
  ): Promise<void> {
    const turnContext = this.activeTurns.get(sessionId);
    if (!turnContext || turnContext.cancelled) {
      return;
    }

    // Record ASR completion time
    turnContext.latencies.asrEndTime = Date.now();

    // Store transcript
    turnContext.transcript = asrResult.transcript;

    // Send final transcript to client
    const transcriptMessage: TranscriptMessage = {
      type: 'transcript',
      sessionId,
      timestamp: Date.now(),
      transcript: asrResult.transcript,
      isFinal: true,
      confidence: asrResult.confidence || 0,
    };

    this.sendToClient(sessionId, transcriptMessage);

    logger.info(`Final transcript received`, {
      sessionId,
      transcript: asrResult.transcript,
      asrLatency: turnContext.latencies.asrEndTime! - turnContext.latencies.asrStartTime!,
    });

    // Trigger RAG query
    await this.triggerRAGQuery(sessionId, asrResult.transcript);
  }

  /**
   * Trigger RAG query with transcript
   * Wire: ASR → RAG Pipeline
   */
  private async triggerRAGQuery(sessionId: string, transcript: string): Promise<void> {
    const turnContext = this.activeTurns.get(sessionId);
    if (!turnContext || turnContext.cancelled) {
      return;
    }

    try {
      // Start RAG timing
      turnContext.latencies.ragStartTime = Date.now();

      // Get conversation history (last 5 turns)
      const conversationHistory = await this.conversationSessionService.getConversationHistory(
        sessionId,
        5
      );

      // Query RAG service
      const response = await this.ragClient.post('/api/v1/rag/search', {
        query: transcript,
        knowledgeBaseId: turnContext.userId,
        maxResults: 5,
        similarityThreshold: 0.7,
        conversationHistory: conversationHistory.map((turn) => ({
          userMessage: turn.userTranscript,
          assistantMessage: turn.llmResponse,
        })),
      });

      // Record RAG completion time
      turnContext.latencies.ragEndTime = Date.now();

      // Store retrieved chunks
      turnContext.ragContext = response.data.results.map(
        (result: { content: string }) => result.content
      );

      logger.info(`RAG query completed`, {
        sessionId,
        resultsCount: response.data.results.length,
        ragLatency: turnContext.latencies.ragEndTime! - turnContext.latencies.ragStartTime!,
      });

      // Trigger LLM generation
      await this.triggerLLMGeneration(sessionId, transcript, turnContext.ragContext || []);
    } catch (error) {
      await this.handleError(sessionId, 'rag', error as Error);
    }
  }

  /**
   * Trigger LLM response generation
   * Wire: RAG → LLM Service
   */
  private async triggerLLMGeneration(
    sessionId: string,
    query: string,
    context: string[]
  ): Promise<void> {
    const turnContext = this.activeTurns.get(sessionId);
    if (!turnContext || turnContext.cancelled) {
      return;
    }

    try {
      // Start LLM timing
      turnContext.latencies.llmStartTime = Date.now();

      // Get user profile for personality traits
      const session = await this.sessionService.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Send response start message
      const responseStartMessage: ResponseStartMessage = {
        type: 'response_start',
        sessionId,
        timestamp: Date.now(),
        turnId: turnContext.turnId,
      };
      this.sendToClient(sessionId, responseStartMessage);

      // Stream LLM tokens
      const response = await this.llmClient.post(
        '/generate/stream',
        {
          query,
          context,
          userId: turnContext.userId,
          sessionId,
        },
        {
          responseType: 'stream',
        }
      );

      // Handle streaming response
      response.data.on('data', async (chunk: Buffer) => {
        if (turnContext.cancelled) {
          response.data.destroy();
          return;
        }

        const data = chunk.toString();
        const lines = data.split('\n').filter((line: string) => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonData = line.slice(6);
            if (jsonData === '[DONE]') {
              await this.handleLLMComplete(sessionId);
              return;
            }

            try {
              const parsed = JSON.parse(jsonData);
              if (parsed.token) {
                await this.handleLLMToken(sessionId, parsed.token);
              }
            } catch {
              logger.warn(`Failed to parse LLM token`, { line });
            }
          }
        }
      });

      response.data.on('error', async (error: Error) => {
        await this.handleError(sessionId, 'llm', error);
      });
    } catch (error) {
      await this.handleError(sessionId, 'llm', error as Error);
    }
  }

  /**
   * Handle LLM token
   * Buffer tokens into complete sentences for TTS
   */
  private async handleLLMToken(sessionId: string, token: string): Promise<void> {
    const turnContext = this.activeTurns.get(sessionId);
    if (!turnContext || turnContext.cancelled) {
      return;
    }

    // Record first token time
    if (!turnContext.latencies.llmFirstTokenTime) {
      turnContext.latencies.llmFirstTokenTime = Date.now();
      logger.info(`First LLM token received`, {
        sessionId,
        llmFirstTokenLatency:
          turnContext.latencies.llmFirstTokenTime! - turnContext.latencies.llmStartTime!,
      });
    }

    // Add token to buffer
    turnContext.llmTokens.push(token);
    turnContext.sentenceBuffer += token;

    // Check if we have a complete sentence
    if (this.isCompleteSentence(turnContext.sentenceBuffer)) {
      const sentence = turnContext.sentenceBuffer.trim();
      turnContext.sentenceBuffer = '';

      // Send sentence to TTS
      await this.sendToTTS(sessionId, sentence);
    }
  }

  /**
   * Check if buffer contains a complete sentence
   */
  private isCompleteSentence(buffer: string): boolean {
    const sentenceEnders = ['.', '!', '?', '。', '！', '？'];
    return sentenceEnders.some((ender) => buffer.trim().endsWith(ender));
  }

  /**
   * Handle LLM completion
   */
  private async handleLLMComplete(sessionId: string): Promise<void> {
    const turnContext = this.activeTurns.get(sessionId);
    if (!turnContext || turnContext.cancelled) {
      return;
    }

    // Record LLM completion time
    turnContext.latencies.llmEndTime = Date.now();

    // Send any remaining buffer to TTS
    if (turnContext.sentenceBuffer.trim()) {
      await this.sendToTTS(sessionId, turnContext.sentenceBuffer.trim());
    }

    logger.info(`LLM generation completed`, {
      sessionId,
      llmLatency: turnContext.latencies.llmEndTime! - turnContext.latencies.llmStartTime!,
      totalTokens: turnContext.llmTokens.length,
    });
  }

  /**
   * Send sentence to TTS service
   * Wire: LLM → TTS Service
   */
  private async sendToTTS(sessionId: string, text: string): Promise<void> {
    const turnContext = this.activeTurns.get(sessionId);
    if (!turnContext || turnContext.cancelled) {
      return;
    }

    try {
      // Start TTS timing if first sentence
      if (!turnContext.latencies.ttsStartTime) {
        turnContext.latencies.ttsStartTime = Date.now();
      }

      // Request TTS synthesis
      const response = await this.ttsClient.post(
        '/synthesize/stream',
        {
          text,
          userId: turnContext.userId,
          sessionId,
        },
        {
          responseType: 'stream',
        }
      );

      // Handle streaming audio chunks
      response.data.on('data', async (chunk: Buffer) => {
        if (turnContext.cancelled) {
          response.data.destroy();
          return;
        }

        try {
          const data = JSON.parse(chunk.toString());
          if (data.audioChunk) {
            await this.handleTTSAudioChunk(sessionId, data.audioChunk);
          }
        } catch {
          // Might be partial JSON, buffer it
          logger.debug(`Buffering TTS chunk`, { sessionId });
        }
      });

      response.data.on('error', async (error: Error) => {
        await this.handleError(sessionId, 'tts', error);
      });
    } catch (error) {
      await this.handleError(sessionId, 'tts', error as Error);
    }
  }

  /**
   * Handle TTS audio chunk
   * Wire: TTS → Lip-sync Service
   */
  private async handleTTSAudioChunk(sessionId: string, audioData: string): Promise<void> {
    const turnContext = this.activeTurns.get(sessionId);
    if (!turnContext || turnContext.cancelled) {
      return;
    }

    // Record first audio chunk time
    if (!turnContext.latencies.ttsFirstChunkTime) {
      turnContext.latencies.ttsFirstChunkTime = Date.now();
      turnContext.latencies.firstAudioChunkTime = Date.now();

      logger.info(`First TTS audio chunk received`, {
        sessionId,
        ttsFirstChunkLatency:
          turnContext.latencies.ttsFirstChunkTime! - turnContext.latencies.ttsStartTime!,
        endToEndLatency:
          turnContext.latencies.firstAudioChunkTime! - turnContext.latencies.userSpeechEndTime!,
      });
    }

    // Send audio chunk to client
    const audioMessage: ResponseAudioMessage = {
      type: 'response_audio',
      sessionId,
      timestamp: Date.now(),
      turnId: turnContext.turnId,
      audioData,
      sequenceNumber: turnContext.audioSequence++,
    };
    this.sendToClient(sessionId, audioMessage);

    // Forward to lip-sync service
    await this.sendToLipSync(sessionId, audioData);
  }

  /**
   * Send audio to lip-sync service
   * Wire: TTS → Lip-sync Service
   */
  private async sendToLipSync(sessionId: string, audioData: string): Promise<void> {
    const turnContext = this.activeTurns.get(sessionId);
    if (!turnContext || turnContext.cancelled) {
      return;
    }

    try {
      // Start lip-sync timing if first chunk
      if (!turnContext.latencies.lipsyncStartTime) {
        turnContext.latencies.lipsyncStartTime = Date.now();
      }

      // Request lip-sync generation
      const response = await this.lipsyncClient.post('/generate/stream', {
        audioData,
        userId: turnContext.userId,
        sessionId,
      });

      // Handle video frames
      if (response.data.frames) {
        for (const frame of response.data.frames) {
          await this.handleLipSyncFrame(sessionId, frame);
        }
      }
    } catch (error) {
      // Lip-sync failure is not critical - continue with audio-only
      logger.warn(`Lip-sync service error, continuing audio-only`, {
        sessionId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle lip-sync video frame
   * Wire: Lip-sync → Mobile App
   */
  private async handleLipSyncFrame(sessionId: string, frameData: string): Promise<void> {
    const turnContext = this.activeTurns.get(sessionId);
    if (!turnContext || turnContext.cancelled) {
      return;
    }

    // Record first frame time
    if (!turnContext.latencies.lipsyncFirstFrameTime) {
      turnContext.latencies.lipsyncFirstFrameTime = Date.now();

      logger.info(`First lip-sync frame received`, {
        sessionId,
        lipsyncFirstFrameLatency:
          turnContext.latencies.lipsyncFirstFrameTime! - turnContext.latencies.lipsyncStartTime!,
      });
    }

    // Send video frame to client
    const videoMessage: ResponseVideoMessage = {
      type: 'response_video',
      sessionId,
      timestamp: Date.now(),
      turnId: turnContext.turnId,
      frameData,
      sequenceNumber: turnContext.videoSequence++,
      format: 'jpeg',
    };
    this.sendToClient(sessionId, videoMessage);
  }

  /**
   * Complete conversation turn
   */
  async completeTurn(sessionId: string): Promise<void> {
    const turnContext = this.activeTurns.get(sessionId);
    if (!turnContext) {
      return;
    }

    // Calculate final metrics
    const metrics = this.calculateMetrics(turnContext);

    // Send response end message
    const responseEndMessage: ResponseEndMessage = {
      type: 'response_end',
      sessionId,
      timestamp: Date.now(),
      turnId: turnContext.turnId,
      metrics,
    };
    this.sendToClient(sessionId, responseEndMessage);

    // Store conversation turn
    await this.conversationSessionService.addConversationTurn(sessionId, {
      userAudioDurationMs: 0, // TODO: Calculate from audio chunks
      userTranscript: turnContext.transcript || '',
      transcriptConfidence: 1.0, // TODO: Get from ASR
      retrievedChunks: turnContext.ragContext || [],
      llmResponse: turnContext.llmTokens.join(''),
      responseAudioDurationMs: 0, // TODO: Calculate from TTS
      asrLatencyMs: metrics.asrLatencyMs,
      ragLatencyMs: metrics.ragLatencyMs,
      llmLatencyMs: metrics.llmLatencyMs,
      ttsLatencyMs: metrics.ttsLatencyMs,
      totalLatencyMs: metrics.totalLatencyMs,
      asrCost: 0, // TODO: Calculate costs
      llmCost: 0,
      ttsCost: 0,
      totalCost: 0,
    });

    // Clean up
    this.activeTurns.delete(sessionId);

    logger.info(`Conversation turn completed`, {
      sessionId,
      turnId: turnContext.turnId,
      metrics,
    });
  }

  /**
   * Calculate turn metrics
   */
  private calculateMetrics(turnContext: TurnContext): {
    totalLatencyMs: number;
    asrLatencyMs: number;
    ragLatencyMs: number;
    llmLatencyMs: number;
    ttsLatencyMs: number;
  } {
    const latencies = turnContext.latencies;

    return {
      totalLatencyMs: latencies.firstAudioChunkTime
        ? latencies.firstAudioChunkTime - latencies.userSpeechEndTime!
        : 0,
      asrLatencyMs:
        latencies.asrEndTime && latencies.asrStartTime
          ? latencies.asrEndTime - latencies.asrStartTime
          : 0,
      ragLatencyMs:
        latencies.ragEndTime && latencies.ragStartTime
          ? latencies.ragEndTime - latencies.ragStartTime
          : 0,
      llmLatencyMs:
        latencies.llmFirstTokenTime && latencies.llmStartTime
          ? latencies.llmFirstTokenTime - latencies.llmStartTime
          : 0,
      ttsLatencyMs:
        latencies.ttsFirstChunkTime && latencies.ttsStartTime
          ? latencies.ttsFirstChunkTime - latencies.ttsStartTime
          : 0,
    };
  }

  /**
   * Cancel active turn (for interruptions)
   */
  async cancelTurn(sessionId: string): Promise<void> {
    const turnContext = this.activeTurns.get(sessionId);
    if (!turnContext) {
      return;
    }

    // Mark as cancelled
    turnContext.cancelled = true;

    // Clean up
    this.activeTurns.delete(sessionId);

    logger.info(`Conversation turn cancelled`, {
      sessionId,
      turnId: turnContext.turnId,
    });
  }

  /**
   * Handle pipeline errors
   */
  private async handleError(sessionId: string, stage: string, error: Error): Promise<void> {
    logger.error(`Pipeline error in ${stage}`, {
      sessionId,
      stage,
      error: error.message,
      stack: error.stack,
    });

    // Implement fallback strategies
    let fallbackMessage = '';
    let recoverable = true;

    switch (stage) {
      case 'asr':
        fallbackMessage = 'Speech recognition failed. Please try speaking again.';
        break;
      case 'rag':
        fallbackMessage = 'Proceeding without knowledge base context.';
        // Continue without context
        break;
      case 'llm':
        fallbackMessage = 'Response generation failed. Trying alternative provider.';
        // TODO: Implement provider fallback
        break;
      case 'tts':
        fallbackMessage = 'Voice synthesis failed. Showing text response only.';
        break;
      case 'lipsync':
        fallbackMessage = 'Video generation failed. Continuing with audio only.';
        recoverable = true; // Not critical
        break;
      default:
        fallbackMessage = 'An error occurred. Please try again.';
        recoverable = false;
    }

    // Send error to client
    const errorMessage: ErrorMessage = {
      type: 'error',
      sessionId,
      timestamp: Date.now(),
      errorCode: `error:${stage}`,
      errorMessage: fallbackMessage,
      recoverable,
    };
    this.sendToClient(sessionId, errorMessage);

    // Clean up turn if not recoverable
    if (!recoverable) {
      this.activeTurns.delete(sessionId);
    }
  }

  /**
   * Send message to client via WebSocket
   */
  private sendToClient(
    sessionId: string,
    message:
      | TranscriptMessage
      | ResponseStartMessage
      | ResponseAudioMessage
      | ResponseVideoMessage
      | ResponseEndMessage
      | ErrorMessage
  ): void {
    const sent = this.connectionService.sendToClient(sessionId, message);
    if (!sent) {
      logger.error(`Failed to send message to client`, {
        sessionId,
        messageType: message.type,
      });
    }
  }
}
