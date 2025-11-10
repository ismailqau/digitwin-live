import { config as baseConfig } from '@clone/config';

export interface ASRServiceConfig {
  port: number;
  gcpProjectId: string;
  gcpRegion: string;
  chirpModel: string;
  defaultLanguageCode: string;
  enableAutomaticPunctuation: boolean;
  enableInterimResults: boolean;
  interimResultsInterval: number;
  maxStreamDuration: number;
  enableCaching: boolean;
  cacheTTL: number;
  enableProfanityFilter: boolean;
  enableLanguageDetection: boolean;
  maxConcurrentStreams: number;
  quotaLimit: {
    requestsPerMinute: number;
    audioMinutesPerDay: number;
  };
  retryConfig: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
  monitoring: {
    enableMetrics: boolean;
    metricsInterval: number;
    enableCostTracking: boolean;
  };
}

export function loadASRConfig(): ASRServiceConfig {
  return {
    port: parseInt(process.env.ASR_SERVICE_PORT || '3001', 10),
    gcpProjectId: baseConfig.gcp.projectId,
    gcpRegion: baseConfig.gcp.region,
    chirpModel: process.env.ASR_MODEL || 'chirp',
    defaultLanguageCode: process.env.ASR_DEFAULT_LANGUAGE || 'en-US',
    enableAutomaticPunctuation: process.env.ASR_ENABLE_PUNCTUATION !== 'false',
    enableInterimResults: process.env.ASR_ENABLE_INTERIM_RESULTS !== 'false',
    interimResultsInterval: parseInt(process.env.ASR_INTERIM_INTERVAL || '300', 10),
    maxStreamDuration: parseInt(process.env.ASR_MAX_STREAM_DURATION || '300000', 10), // 5 minutes
    enableCaching: baseConfig.cache.enabled,
    cacheTTL: baseConfig.cache.ttlShort,
    enableProfanityFilter: process.env.ASR_PROFANITY_FILTER === 'true',
    enableLanguageDetection: process.env.ASR_LANGUAGE_DETECTION === 'true',
    maxConcurrentStreams: parseInt(process.env.ASR_MAX_CONCURRENT_STREAMS || '100', 10),
    quotaLimit: {
      requestsPerMinute: parseInt(process.env.ASR_QUOTA_RPM || '1000', 10),
      audioMinutesPerDay: parseInt(process.env.ASR_QUOTA_MINUTES_PER_DAY || '10000', 10),
    },
    retryConfig: {
      maxRetries: parseInt(process.env.ASR_MAX_RETRIES || '3', 10),
      initialDelayMs: parseInt(process.env.ASR_RETRY_INITIAL_DELAY || '1000', 10),
      maxDelayMs: parseInt(process.env.ASR_RETRY_MAX_DELAY || '10000', 10),
      backoffMultiplier: parseFloat(process.env.ASR_RETRY_BACKOFF || '2'),
    },
    monitoring: {
      enableMetrics: process.env.ASR_ENABLE_METRICS !== 'false',
      metricsInterval: parseInt(process.env.ASR_METRICS_INTERVAL || '60000', 10),
      enableCostTracking: process.env.ASR_ENABLE_COST_TRACKING !== 'false',
    },
  };
}

export const asrConfig = loadASRConfig();
