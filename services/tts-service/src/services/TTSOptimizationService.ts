import { createLogger } from '@clone/logger';
import { TTSProvider } from '@clone/shared-types';
import winston from 'winston';

import { TTSRequest, TTSOptions } from '../types';

export interface TTSQualityConfig {
  mode: 'speed' | 'balanced' | 'quality';
  maxLatency: number; // milliseconds
  minQualityScore: number; // 0-1
  enableStreaming: boolean;
  enableCompression: boolean;
  targetSampleRate: number;
}

export interface TTSOptimizationResult {
  optimizedRequest: TTSRequest;
  selectedProvider: TTSProvider;
  estimatedLatency: number;
  estimatedQuality: number;
  estimatedCost: number;
  optimizations: string[];
}

export interface ProviderCapabilities {
  provider: TTSProvider;
  supportsStreaming: boolean;
  averageLatency: number;
  qualityScore: number;
  costPerCharacter: number;
  maxConcurrentRequests: number;
  supportedFormats: string[];
  supportedSampleRates: number[];
}

export class TTSOptimizationService {
  private logger: winston.Logger;
  private providerCapabilities: Map<TTSProvider, ProviderCapabilities> = new Map();

  constructor(logger?: winston.Logger) {
    this.logger = logger || createLogger('tts-optimization');
    this.initializeProviderCapabilities();
  }

  /**
   * Optimize TTS request based on quality configuration
   */
  async optimizeRequest(
    request: TTSRequest,
    qualityConfig: TTSQualityConfig
  ): Promise<TTSOptimizationResult> {
    const optimizations: string[] = [];
    const optimizedRequest = { ...request };

    // Select optimal provider based on requirements
    const selectedProvider = this.selectOptimalProvider(request, qualityConfig);
    optimizedRequest.provider = selectedProvider;

    // Optimize options based on quality mode
    optimizedRequest.options = this.optimizeOptions(
      request.options || {},
      qualityConfig,
      optimizations
    );

    // Get provider capabilities for estimates
    const capabilities = this.providerCapabilities.get(selectedProvider);
    const estimatedLatency = capabilities?.averageLatency || 1000;
    const estimatedQuality = capabilities?.qualityScore || 0.8;
    const estimatedCost = this.estimateCost(request.text, selectedProvider);

    this.logger.debug('TTS request optimized', {
      originalProvider: request.provider,
      selectedProvider,
      qualityMode: qualityConfig.mode,
      optimizations,
      estimatedLatency,
      estimatedQuality,
    });

    return {
      optimizedRequest,
      selectedProvider,
      estimatedLatency,
      estimatedQuality,
      estimatedCost,
      optimizations,
    };
  }

  /**
   * Select optimal provider based on criteria
   */
  selectOptimalProvider(request: TTSRequest, qualityConfig: TTSQualityConfig): TTSProvider {
    const candidates = Array.from(this.providerCapabilities.entries()).filter(
      ([, capabilities]) => {
        // Filter by basic requirements
        if (qualityConfig.enableStreaming && !capabilities.supportsStreaming) {
          return false;
        }
        if (capabilities.averageLatency > qualityConfig.maxLatency) {
          return false;
        }
        if (capabilities.qualityScore < qualityConfig.minQualityScore) {
          return false;
        }
        return true;
      }
    );

    if (candidates.length === 0) {
      // Fallback to original provider or default
      return request.provider || TTSProvider.OPENAI_TTS;
    }

    // Score providers based on quality mode
    const scoredProviders = candidates.map(([provider, capabilities]) => {
      let score = 0;

      switch (qualityConfig.mode) {
        case 'speed':
          // Prioritize low latency
          score = 1000 - capabilities.averageLatency;
          score += capabilities.supportsStreaming ? 100 : 0;
          break;

        case 'quality':
          // Prioritize high quality
          score = capabilities.qualityScore * 1000;
          score -= capabilities.costPerCharacter * 100; // Consider cost
          break;

        case 'balanced':
        default:
          // Balance latency, quality, and cost
          score = capabilities.qualityScore * 400;
          score += (1000 - capabilities.averageLatency) * 0.3;
          score -= capabilities.costPerCharacter * 200;
          break;
      }

      return { provider, score, capabilities };
    });

    // Sort by score and return best provider
    scoredProviders.sort((a, b) => b.score - a.score);
    return scoredProviders[0].provider;
  }

  /**
   * Optimize TTS options based on quality configuration
   */
  private optimizeOptions(
    originalOptions: TTSOptions,
    qualityConfig: TTSQualityConfig,
    optimizations: string[]
  ): TTSOptions {
    const optimized: TTSOptions = { ...originalOptions };

    // Optimize sample rate
    if (!optimized.sampleRate || optimized.sampleRate !== qualityConfig.targetSampleRate) {
      optimized.sampleRate = qualityConfig.targetSampleRate;
      optimizations.push(`Sample rate set to ${qualityConfig.targetSampleRate}Hz`);
    }

    // Optimize format based on quality mode
    if (!optimized.format) {
      switch (qualityConfig.mode) {
        case 'speed':
          optimized.format = qualityConfig.enableCompression ? 'opus' : 'pcm';
          optimizations.push('Format optimized for speed');
          break;
        case 'quality':
          optimized.format = 'wav';
          optimizations.push('Format optimized for quality');
          break;
        case 'balanced':
        default:
          optimized.format = 'mp3';
          optimizations.push('Format optimized for balance');
          break;
      }
    }

    // Enable streaming if requested and not set
    if (qualityConfig.enableStreaming && !originalOptions.streaming) {
      optimized.streaming = true;
      optimizations.push('Streaming enabled');
    }

    // Optimize speed/pitch for latency
    if (qualityConfig.mode === 'speed') {
      if (!optimized.speed || optimized.speed < 1.1) {
        optimized.speed = 1.1; // Slightly faster for reduced latency
        optimizations.push('Speed increased for lower latency');
      }
    }

    return optimized;
  }

  /**
   * Get provider performance metrics
   */
  getProviderMetrics(): Map<TTSProvider, ProviderCapabilities> {
    return new Map(this.providerCapabilities);
  }

  /**
   * Update provider capabilities based on real performance
   */
  updateProviderCapabilities(
    provider: TTSProvider,
    latency: number,
    qualityScore: number,
    cost: number
  ): void {
    const capabilities = this.providerCapabilities.get(provider);
    if (capabilities) {
      // Update with exponential moving average
      const alpha = 0.1; // Smoothing factor
      capabilities.averageLatency = capabilities.averageLatency * (1 - alpha) + latency * alpha;
      capabilities.qualityScore = capabilities.qualityScore * (1 - alpha) + qualityScore * alpha;
      capabilities.costPerCharacter = capabilities.costPerCharacter * (1 - alpha) + cost * alpha;

      this.logger.debug('Provider capabilities updated', {
        provider,
        latency: capabilities.averageLatency,
        quality: capabilities.qualityScore,
        cost: capabilities.costPerCharacter,
      });
    }
  }

  /**
   * Get recommended quality configuration based on use case
   */
  getRecommendedQualityConfig(
    useCase: 'conversation' | 'narration' | 'announcement'
  ): TTSQualityConfig {
    switch (useCase) {
      case 'conversation':
        return {
          mode: 'speed',
          maxLatency: 500, // 500ms for real-time conversation
          minQualityScore: 0.7,
          enableStreaming: true,
          enableCompression: true,
          targetSampleRate: 16000, // Lower sample rate for speed
        };

      case 'narration':
        return {
          mode: 'quality',
          maxLatency: 2000, // 2s acceptable for narration
          minQualityScore: 0.9,
          enableStreaming: false,
          enableCompression: false,
          targetSampleRate: 44100, // High quality sample rate
        };

      case 'announcement':
        return {
          mode: 'balanced',
          maxLatency: 1000, // 1s for announcements
          minQualityScore: 0.8,
          enableStreaming: true,
          enableCompression: true,
          targetSampleRate: 22050, // Balanced sample rate
        };

      default:
        return {
          mode: 'balanced',
          maxLatency: 1000,
          minQualityScore: 0.8,
          enableStreaming: true,
          enableCompression: true,
          targetSampleRate: 22050,
        };
    }
  }

  /**
   * Analyze text for optimization hints
   */
  analyzeTextForOptimization(text: string): {
    isShortPhrase: boolean;
    hasSpecialCharacters: boolean;
    estimatedDuration: number;
    complexity: 'low' | 'medium' | 'high';
    suggestions: string[];
  } {
    const suggestions: string[] = [];
    const wordCount = text.split(/\s+/).length;
    const charCount = text.length;

    // Estimate duration (rough: ~150 words per minute)
    const estimatedDuration = (wordCount / 150) * 60 * 1000; // milliseconds

    // Check for short phrases (good for caching)
    const isShortPhrase = charCount < 100;
    if (isShortPhrase) {
      suggestions.push('Short phrase - good candidate for caching');
    }

    // Check for special characters that might affect synthesis
    const hasSpecialCharacters = /[^\w\s.,!?;:'"()-]/.test(text);
    if (hasSpecialCharacters) {
      suggestions.push('Contains special characters - may need preprocessing');
    }

    // Determine complexity
    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (wordCount > 50 || hasSpecialCharacters) {
      complexity = 'medium';
    }
    if (wordCount > 200 || /[^\x20-\x7E]/.test(text)) {
      complexity = 'high';
      suggestions.push('Complex text - consider chunking for streaming');
    }

    // Check for numbers that might need special handling
    if (/\d+/.test(text)) {
      suggestions.push('Contains numbers - ensure proper pronunciation');
    }

    return {
      isShortPhrase,
      hasSpecialCharacters,
      estimatedDuration,
      complexity,
      suggestions,
    };
  }

  private initializeProviderCapabilities(): void {
    // Initialize with default capabilities (these would be updated with real metrics)
    this.providerCapabilities.set(TTSProvider.OPENAI_TTS, {
      provider: TTSProvider.OPENAI_TTS,
      supportsStreaming: true,
      averageLatency: 800,
      qualityScore: 0.85,
      costPerCharacter: 0.000015,
      maxConcurrentRequests: 50,
      supportedFormats: ['mp3', 'opus', 'aac', 'flac'],
      supportedSampleRates: [22050, 24000, 44100, 48000],
    });

    this.providerCapabilities.set(TTSProvider.GOOGLE_CLOUD_TTS, {
      provider: TTSProvider.GOOGLE_CLOUD_TTS,
      supportsStreaming: true,
      averageLatency: 600,
      qualityScore: 0.82,
      costPerCharacter: 0.000016,
      maxConcurrentRequests: 100,
      supportedFormats: ['mp3', 'wav', 'ogg'],
      supportedSampleRates: [8000, 16000, 22050, 24000, 32000, 44100, 48000],
    });

    this.providerCapabilities.set(TTSProvider.XTTS_V2, {
      provider: TTSProvider.XTTS_V2,
      supportsStreaming: true,
      averageLatency: 1200,
      qualityScore: 0.9,
      costPerCharacter: 0.00001, // Lower cost for self-hosted
      maxConcurrentRequests: 10, // Limited by GPU
      supportedFormats: ['wav', 'mp3'],
      supportedSampleRates: [16000, 22050, 24000],
    });

    this.providerCapabilities.set(TTSProvider.ELEVENLABS, {
      provider: TTSProvider.ELEVENLABS,
      supportsStreaming: true,
      averageLatency: 900,
      qualityScore: 0.92,
      costPerCharacter: 0.00003, // Higher cost but better quality
      maxConcurrentRequests: 20,
      supportedFormats: ['mp3', 'wav', 'pcm'],
      supportedSampleRates: [16000, 22050, 24000, 44100],
    });
  }

  private estimateCost(text: string, provider: TTSProvider): number {
    const capabilities = this.providerCapabilities.get(provider);
    if (!capabilities) return 0;

    return text.length * capabilities.costPerCharacter;
  }
}
