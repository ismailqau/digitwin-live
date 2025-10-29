import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export interface Config {
  env: string;
  port: number;
  gcp: {
    projectId: string;
    region: string;
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
  };
  cache: {
    enabled: boolean;
    ttlShort: number;
    ttlMedium: number;
    ttlLong: number;
  };
  database: {
    url: string;
  };
  ai: {
    googleApiKey: string;
    openaiApiKey: string;
    groqApiKey: string;
  };
  vectorDb: {
    pineconeApiKey: string;
    pineconeEnvironment: string;
  };
  storage: {
    bucket: string;
  };
}

export function loadConfig(): Config {
  return {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    gcp: {
      projectId: process.env.GCP_PROJECT_ID || '',
      region: process.env.GCP_REGION || 'us-central1',
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET || 'dev-secret',
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
    cache: {
      enabled: process.env.ENABLE_CACHING === 'true',
      ttlShort: parseInt(process.env.CACHE_TTL_SHORT || '300', 10),
      ttlMedium: parseInt(process.env.CACHE_TTL_MEDIUM || '3600', 10),
      ttlLong: parseInt(process.env.CACHE_TTL_LONG || '86400', 10),
    },
    database: {
      url: process.env.DATABASE_URL || '',
    },
    ai: {
      googleApiKey: process.env.GOOGLE_CLOUD_API_KEY || '',
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      groqApiKey: process.env.GROQ_API_KEY || '',
    },
    vectorDb: {
      pineconeApiKey: process.env.PINECONE_API_KEY || '',
      pineconeEnvironment: process.env.PINECONE_ENVIRONMENT || '',
    },
    storage: {
      bucket: process.env.CLOUD_STORAGE_BUCKET || '',
    },
  };
}

export const config = loadConfig();
