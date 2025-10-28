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
  redis: {
    url: string;
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
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
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
