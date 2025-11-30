import * as crypto from 'crypto';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to generate mock embedding vector (768 dimensions for text-embedding-004)
// Format: [0.1,0.2,...] for pgvector
function generateMockEmbedding(): string {
  const embedding = Array.from({ length: 768 }, () => (Math.random() * 2 - 1).toFixed(4));
  return `[${embedding.join(',')}]`;
}

// Helper to generate hash
function generateHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 32);
}

async function main() {
  console.log('🌱 Starting comprehensive database seeding...\n');

  // ============================================================================
  // 1. USERS - Different subscription tiers and configurations
  // ============================================================================
  console.log('👤 Creating users...');

  const users = await Promise.all([
    // Pro user with full setup
    prisma.user.upsert({
      where: { email: 'pro@example.com' },
      update: {},
      create: {
        email: 'pro@example.com',
        name: 'Pro User',
        personalityTraits: ['professional', 'friendly', 'knowledgeable'],
        speakingStyle: 'professional and articulate',
        preferredLLMProvider: 'gemini-flash',
        preferredTTSProvider: 'xtts-v2',
        subscriptionTier: 'pro',
        conversationMinutesUsed: 450,
        settings: {
          enableConversationHistory: true,
          autoLanguageDetection: true,
          videoQuality: 'high',
          interruptionSensitivity: 0.7,
          theme: 'dark',
          notifications: true,
        },
      },
    }),
    // Free tier user
    prisma.user.upsert({
      where: { email: 'free@example.com' },
      update: {},
      create: {
        email: 'free@example.com',
        name: 'Free User',
        personalityTraits: ['casual', 'helpful'],
        speakingStyle: 'casual and conversational',
        preferredLLMProvider: 'groq',
        preferredTTSProvider: 'openai-tts',
        subscriptionTier: 'free',
        conversationMinutesUsed: 25,
        settings: {
          enableConversationHistory: false,
          autoLanguageDetection: false,
          videoQuality: 'medium',
          interruptionSensitivity: 0.5,
        },
      },
    }),
    // Enterprise user
    prisma.user.upsert({
      where: { email: 'enterprise@example.com' },
      update: {},
      create: {
        email: 'enterprise@example.com',
        name: 'Enterprise Admin',
        personalityTraits: ['technical', 'precise', 'efficient'],
        speakingStyle: 'technical and concise',
        preferredLLMProvider: 'gpt4-turbo',
        preferredTTSProvider: 'google-cloud-tts',
        subscriptionTier: 'enterprise',
        conversationMinutesUsed: 2500,
        settings: {
          enableConversationHistory: true,
          autoLanguageDetection: true,
          videoQuality: 'ultra',
          interruptionSensitivity: 0.8,
          customBranding: true,
          apiAccess: true,
        },
      },
    }),
    // Test user (for automated testing)
    prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        email: 'test@example.com',
        name: 'Test User',
        personalityTraits: ['friendly'],
        speakingStyle: 'neutral',
        subscriptionTier: 'pro',
        settings: {},
      },
    }),
    // Soft-deleted user (for testing deletion scenarios)
    prisma.user.upsert({
      where: { email: 'deleted@example.com' },
      update: {},
      create: {
        email: 'deleted@example.com',
        name: 'Deleted User',
        personalityTraits: [],
        subscriptionTier: 'free',
        deletedAt: new Date('2024-01-15'),
        settings: {},
      },
    }),
  ]);

  const [proUser, freeUser, enterpriseUser, _testUser] = users;
  console.log(`  ✅ Created ${users.length} users\n`);

  // ============================================================================
  // 2. VOICE SAMPLES - Various states and qualities
  // ============================================================================
  console.log('🎤 Creating voice samples...');

  const voiceSamples = await Promise.all([
    // Completed high-quality samples
    prisma.voiceSample.create({
      data: {
        userId: proUser.id,
        filename: 'sample-001.wav',
        originalFilename: 'recording_intro.wav',
        contentType: 'audio/wav',
        sizeBytes: 2456000,
        duration: 45.5,
        sampleRate: 44100,
        channels: 1,
        qualityScore: 0.95,
        storagePath: 'gs://clone-uploads/pro-user/sample-001.wav',
        processedPath: 'gs://clone-uploads/pro-user/processed/sample-001.wav',
        status: 'completed',
        metadata: { noiseLevel: 'low', clarity: 'excellent' },
      },
    }),
    prisma.voiceSample.create({
      data: {
        userId: proUser.id,
        filename: 'sample-002.wav',
        originalFilename: 'recording_conversation.wav',
        contentType: 'audio/wav',
        sizeBytes: 3200000,
        duration: 62.3,
        sampleRate: 44100,
        channels: 1,
        qualityScore: 0.92,
        storagePath: 'gs://clone-uploads/pro-user/sample-002.wav',
        processedPath: 'gs://clone-uploads/pro-user/processed/sample-002.wav',
        status: 'completed',
        metadata: { noiseLevel: 'low', clarity: 'good' },
      },
    }),
    // Processing sample
    prisma.voiceSample.create({
      data: {
        userId: proUser.id,
        filename: 'sample-003.wav',
        originalFilename: 'new_recording.wav',
        contentType: 'audio/wav',
        sizeBytes: 1800000,
        duration: 35.0,
        sampleRate: 44100,
        channels: 1,
        qualityScore: 0,
        storagePath: 'gs://clone-uploads/pro-user/sample-003.wav',
        status: 'processing',
        metadata: {},
      },
    }),
    // Failed sample (low quality)
    prisma.voiceSample.create({
      data: {
        userId: freeUser.id,
        filename: 'sample-bad.wav',
        originalFilename: 'noisy_recording.wav',
        contentType: 'audio/wav',
        sizeBytes: 500000,
        duration: 10.0,
        sampleRate: 22050,
        channels: 1,
        qualityScore: 0.35,
        storagePath: 'gs://clone-uploads/free-user/sample-bad.wav',
        status: 'failed',
        metadata: { noiseLevel: 'high', errorReason: 'Quality below threshold' },
      },
    }),
  ]);

  console.log(`  ✅ Created ${voiceSamples.length} voice samples\n`);

  // ============================================================================
  // 3. VOICE MODELS - Different providers and states
  // ============================================================================
  console.log('🗣️ Creating voice models...');

  const voiceModels = await Promise.all([
    // Active XTTS model
    prisma.voiceModel.create({
      data: {
        userId: proUser.id,
        provider: 'xtts-v2',
        modelPath: 'gs://clone-voice-models/pro-user/xtts-v1.pth',
        sampleRate: 22050,
        qualityScore: 0.94,
        isActive: true,
        status: 'completed',
        metadata: {
          trainingDuration: 3600,
          sampleCount: 50,
          version: '1.0',
          language: 'en',
        },
      },
    }),
    // Inactive older model
    prisma.voiceModel.create({
      data: {
        userId: proUser.id,
        provider: 'xtts-v2',
        modelPath: 'gs://clone-voice-models/pro-user/xtts-v0.pth',
        sampleRate: 22050,
        qualityScore: 0.85,
        isActive: false,
        status: 'completed',
        metadata: { trainingDuration: 2400, sampleCount: 30, version: '0.9' },
      },
    }),
    // OpenAI TTS model
    prisma.voiceModel.create({
      data: {
        userId: enterpriseUser.id,
        provider: 'openai-tts',
        modelPath: 'openai://voice-clone/enterprise-v1',
        sampleRate: 24000,
        qualityScore: 0.91,
        isActive: true,
        status: 'completed',
        metadata: { voice: 'custom', style: 'professional' },
      },
    }),
    // Training in progress
    prisma.voiceModel.create({
      data: {
        userId: freeUser.id,
        provider: 'xtts-v2',
        modelPath: '',
        sampleRate: 22050,
        qualityScore: 0,
        isActive: false,
        status: 'training',
        metadata: { progress: 45, estimatedCompletion: '2024-12-01T10:00:00Z' },
      },
    }),
  ]);

  const [activeVoiceModel, , enterpriseVoiceModel] = voiceModels;
  console.log(`  ✅ Created ${voiceModels.length} voice models\n`);

  // ============================================================================
  // 4. TRAINING JOBS - Various states
  // ============================================================================
  console.log('🏋️ Creating training jobs...');

  const trainingJobs = await Promise.all([
    // Completed job
    prisma.trainingJob.create({
      data: {
        userId: proUser.id,
        voiceModelId: activeVoiceModel.id,
        provider: 'xtts-v2',
        status: 'completed',
        progress: 100,
        estimatedCost: 2.5,
        actualCost: 2.35,
        estimatedTimeMs: 3600000,
        actualTimeMs: 3420000,
        startedAt: new Date('2024-11-01T10:00:00Z'),
        completedAt: new Date('2024-11-01T10:57:00Z'),
        priority: 50,
        gpuNodeId: 'gpu-node-1',
        jobData: { epochs: 100, batchSize: 16, learningRate: 0.0001 },
        logs: [
          { timestamp: '2024-11-01T10:00:00Z', message: 'Training started' },
          { timestamp: '2024-11-01T10:30:00Z', message: 'Epoch 50/100 completed' },
          { timestamp: '2024-11-01T10:57:00Z', message: 'Training completed' },
        ],
        qualityMetrics: { mos: 4.2, similarity: 0.94, naturalness: 0.91 },
      },
    }),
    // Running job
    prisma.trainingJob.create({
      data: {
        userId: freeUser.id,
        provider: 'xtts-v2',
        status: 'running',
        progress: 45,
        estimatedCost: 1.5,
        estimatedTimeMs: 2400000,
        startedAt: new Date(),
        priority: 30,
        gpuNodeId: 'gpu-node-2',
        jobData: { epochs: 50, batchSize: 8, learningRate: 0.0001 },
        logs: [{ timestamp: new Date().toISOString(), message: 'Training in progress' }],
      },
    }),
    // Queued job
    prisma.trainingJob.create({
      data: {
        userId: enterpriseUser.id,
        provider: 'openai-tts',
        status: 'queued',
        progress: 0,
        estimatedCost: 5.0,
        estimatedTimeMs: 7200000,
        priority: 80,
        jobData: { quality: 'high', style: 'professional' },
        logs: [],
      },
    }),
    // Failed job
    prisma.trainingJob.create({
      data: {
        userId: freeUser.id,
        provider: 'xtts-v2',
        status: 'failed',
        progress: 23,
        estimatedCost: 1.0,
        estimatedTimeMs: 1800000,
        startedAt: new Date('2024-10-15T14:00:00Z'),
        failedAt: new Date('2024-10-15T14:25:00Z'),
        errorMessage: 'Insufficient voice sample quality',
        retryCount: 2,
        maxRetries: 3,
        priority: 40,
        jobData: { epochs: 50 },
        logs: [
          { timestamp: '2024-10-15T14:00:00Z', message: 'Training started' },
          { timestamp: '2024-10-15T14:25:00Z', message: 'Error: Quality check failed' },
        ],
      },
    }),
  ]);

  console.log(`  ✅ Created ${trainingJobs.length} training jobs\n`);

  // Link voice samples to training jobs
  await prisma.trainingJobVoiceSample.createMany({
    data: [
      { trainingJobId: trainingJobs[0].id, voiceSampleId: voiceSamples[0].id },
      { trainingJobId: trainingJobs[0].id, voiceSampleId: voiceSamples[1].id },
    ],
  });

  // ============================================================================
  // 5. FACE MODELS
  // ============================================================================
  console.log('😊 Creating face models...');

  const faceModels = await Promise.all([
    prisma.faceModel.create({
      data: {
        userId: proUser.id,
        modelPath: 'gs://clone-face-models/pro-user/face-v1',
        resolution: { width: 512, height: 512 },
        qualityScore: 0.92,
        isActive: true,
        metadata: { photoCount: 12, processingTime: 240, style: 'realistic' },
      },
    }),
    prisma.faceModel.create({
      data: {
        userId: enterpriseUser.id,
        modelPath: 'gs://clone-face-models/enterprise/face-hd',
        resolution: { width: 1024, height: 1024 },
        qualityScore: 0.96,
        isActive: true,
        metadata: { photoCount: 25, processingTime: 600, style: 'professional' },
      },
    }),
  ]);

  const [proFaceModel, enterpriseFaceModel] = faceModels;
  console.log(`  ✅ Created ${faceModels.length} face models\n`);

  // ============================================================================
  // 6. KNOWLEDGE DOCUMENTS - Various types and states
  // ============================================================================
  console.log('📚 Creating knowledge documents...');

  const documents = await Promise.all([
    // Completed PDF document
    prisma.knowledgeDocument.create({
      data: {
        userId: proUser.id,
        filename: 'company-handbook.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2048000,
        textContent: `Company Handbook - Employee Guidelines

Chapter 1: Introduction
Welcome to our company. This handbook outlines policies and procedures.

Chapter 2: Vacation Policy
Employees receive 15 days of paid vacation per year. Vacation requests must be submitted 2 weeks in advance through the HR portal.

Chapter 3: Remote Work
Employees may work remotely up to 3 days per week with manager approval.

Chapter 4: Benefits
Health insurance, 401k matching, and professional development allowances are provided.`,
        chunkCount: 8,
        title: 'Company Handbook 2024',
        author: 'HR Department',
        tags: ['company', 'policies', 'hr', 'handbook'],
        status: 'completed',
        processedAt: new Date('2024-10-01'),
        storagePath: 'gs://clone-documents/pro-user/handbook.pdf',
        vectorIds: Array.from({ length: 8 }, (_, i) => `vec-handbook-${i + 1}`),
        metadata: { pages: 45, language: 'en' },
      },
    }),
    // Completed markdown document
    prisma.knowledgeDocument.create({
      data: {
        userId: proUser.id,
        filename: 'product-specs.md',
        contentType: 'text/markdown',
        sizeBytes: 512000,
        textContent: `# Product Specifications

## Overview
Our flagship product provides real-time conversational AI capabilities.

## Features
- Voice cloning with XTTS-v2
- Real-time speech recognition
- Natural language understanding
- Multi-language support

## Technical Requirements
- Node.js 20+
- PostgreSQL 15+
- GPU for voice training`,
        chunkCount: 5,
        title: 'Product Technical Specifications',
        tags: ['product', 'technical', 'specs'],
        status: 'completed',
        processedAt: new Date('2024-10-15'),
        storagePath: 'gs://clone-documents/pro-user/specs.md',
        vectorIds: Array.from({ length: 5 }, (_, i) => `vec-specs-${i + 1}`),
        metadata: { format: 'markdown' },
      },
    }),
    // Processing document
    prisma.knowledgeDocument.create({
      data: {
        userId: enterpriseUser.id,
        filename: 'api-documentation.pdf',
        contentType: 'application/pdf',
        sizeBytes: 3500000,
        textContent: '',
        chunkCount: 0,
        title: 'API Documentation',
        tags: ['api', 'technical', 'documentation'],
        status: 'processing',
        storagePath: 'gs://clone-documents/enterprise/api-docs.pdf',
        vectorIds: [],
        metadata: { estimatedChunks: 25 },
      },
    }),
    // Failed document
    prisma.knowledgeDocument.create({
      data: {
        userId: freeUser.id,
        filename: 'corrupted-file.pdf',
        contentType: 'application/pdf',
        sizeBytes: 100000,
        textContent: '',
        chunkCount: 0,
        tags: [],
        status: 'failed',
        errorMessage: 'Unable to extract text from PDF - file may be corrupted',
        storagePath: 'gs://clone-documents/free-user/corrupted.pdf',
        vectorIds: [],
        metadata: {},
      },
    }),
  ]);

  const [handbookDoc, specsDoc] = documents;
  console.log(`  ✅ Created ${documents.length} knowledge documents\n`);

  // ============================================================================
  // 7. DOCUMENT CHUNKS with embeddings (using raw SQL for vector type)
  // ============================================================================
  console.log('📄 Creating document chunks with embeddings...');

  const handbookChunks = [
    'Welcome to our company. This handbook outlines policies and procedures for all employees.',
    'Employees receive 15 days of paid vacation per year. Vacation requests must be submitted 2 weeks in advance.',
    'Remote work is permitted up to 3 days per week with prior manager approval.',
    'Health insurance coverage begins on the first day of employment.',
    '401k matching is provided at 50% up to 6% of salary.',
  ];

  const specsChunks = [
    'Our flagship product provides real-time conversational AI capabilities with voice cloning.',
    'Voice cloning uses XTTS-v2 technology for high-quality voice synthesis.',
    'Technical requirements include Node.js 20+, PostgreSQL 15+, and GPU for training.',
  ];

  // Insert chunks using raw SQL to handle vector type properly
  let chunkCount = 0;
  for (let i = 0; i < handbookChunks.length; i++) {
    const embedding = generateMockEmbedding();
    const metadata = JSON.stringify({
      section: `Chapter ${i + 1}`,
      wordCount: handbookChunks[i].split(' ').length,
    });
    await prisma.$executeRawUnsafe(
      `INSERT INTO document_chunks (id, document_id, user_id, chunk_index, content, embedding, metadata)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::vector, $6::jsonb)`,
      handbookDoc.id,
      proUser.id,
      i,
      handbookChunks[i],
      embedding,
      metadata
    );
    chunkCount++;
  }

  for (let i = 0; i < specsChunks.length; i++) {
    const embedding = generateMockEmbedding();
    const metadata = JSON.stringify({
      section: 'Technical',
      wordCount: specsChunks[i].split(' ').length,
    });
    await prisma.$executeRawUnsafe(
      `INSERT INTO document_chunks (id, document_id, user_id, chunk_index, content, embedding, metadata)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::vector, $6::jsonb)`,
      specsDoc.id,
      proUser.id,
      i,
      specsChunks[i],
      embedding,
      metadata
    );
    chunkCount++;
  }

  console.log(`  ✅ Created ${chunkCount} document chunks\n`);

  // ============================================================================
  // 8. FAQs
  // ============================================================================
  console.log('❓ Creating FAQs...');

  const faqs = await Promise.all([
    prisma.fAQ.create({
      data: {
        userId: proUser.id,
        question: 'What are the business hours?',
        answer:
          'Our business hours are Monday through Friday, 9 AM to 6 PM EST. Customer support is available 24/7 via chat.',
        priority: 90,
        tags: ['hours', 'support', 'general'],
      },
    }),
    prisma.fAQ.create({
      data: {
        userId: proUser.id,
        question: 'How do I reset my password?',
        answer:
          'Click on "Forgot Password" on the login page, enter your email, and follow the instructions sent to your inbox.',
        priority: 85,
        tags: ['account', 'password', 'security'],
      },
    }),
    prisma.fAQ.create({
      data: {
        userId: proUser.id,
        question: 'What payment methods do you accept?',
        answer:
          'We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and bank transfers for enterprise accounts.',
        priority: 80,
        tags: ['payment', 'billing'],
      },
    }),
    prisma.fAQ.create({
      data: {
        userId: enterpriseUser.id,
        question: 'How do I integrate the API?',
        answer:
          'API documentation is available at /api-docs. You will need an API key from your dashboard. See our quickstart guide for examples.',
        priority: 95,
        tags: ['api', 'integration', 'technical'],
      },
    }),
    prisma.fAQ.create({
      data: {
        userId: enterpriseUser.id,
        question: 'What is the API rate limit?',
        answer:
          'Free tier: 100 requests/minute. Pro tier: 1000 requests/minute. Enterprise: Custom limits available.',
        priority: 75,
        tags: ['api', 'limits', 'technical'],
      },
    }),
  ]);

  console.log(`  ✅ Created ${faqs.length} FAQs\n`);

  // ============================================================================
  // 9. CONVERSATION SESSIONS - Various states
  // ============================================================================
  console.log('💬 Creating conversation sessions...');

  const sessions = await Promise.all([
    // Completed session with turns
    prisma.conversationSession.create({
      data: {
        userId: proUser.id,
        state: 'idle',
        llmProvider: 'gemini-flash',
        ttsProvider: 'xtts-v2',
        voiceModelId: activeVoiceModel.id,
        faceModelId: proFaceModel.id,
        totalTurns: 5,
        averageLatencyMs: 1850,
        totalCost: 0.15,
        durationSeconds: 300,
        endedAt: new Date(),
      },
    }),
    // Active session
    prisma.conversationSession.create({
      data: {
        userId: enterpriseUser.id,
        state: 'listening',
        llmProvider: 'gpt4-turbo',
        ttsProvider: 'openai-tts',
        voiceModelId: enterpriseVoiceModel.id,
        faceModelId: enterpriseFaceModel.id,
        totalTurns: 2,
        averageLatencyMs: 1200,
        totalCost: 0.08,
        durationSeconds: 120,
      },
    }),
    // Error state session
    prisma.conversationSession.create({
      data: {
        userId: freeUser.id,
        state: 'error',
        llmProvider: 'groq',
        ttsProvider: 'openai-tts',
        totalTurns: 1,
        averageLatencyMs: 0,
        totalCost: 0.01,
        durationSeconds: 30,
        endedAt: new Date(),
      },
    }),
  ]);

  console.log(`  ✅ Created ${sessions.length} conversation sessions\n`);

  // ============================================================================
  // 10. CONVERSATION TURNS
  // ============================================================================
  console.log('🔄 Creating conversation turns...');

  const turnData = [
    {
      sessionId: sessions[0].id,
      userTranscript: 'What are the company vacation policies?',
      llmResponse:
        'According to the company handbook, employees receive 15 days of paid vacation per year. Vacation requests must be submitted at least 2 weeks in advance through the HR portal.',
      userAudioDurationMs: 2500,
      responseAudioDurationMs: 5000,
      transcriptConfidence: 0.95,
      retrievedChunks: ['chunk-1', 'chunk-2'],
      asrLatencyMs: 280,
      ragLatencyMs: 180,
      llmLatencyMs: 950,
      ttsLatencyMs: 440,
      totalLatencyMs: 1850,
      asrCost: 0.015,
      llmCost: 0.008,
      ttsCost: 0.012,
      totalCost: 0.035,
    },
    {
      sessionId: sessions[0].id,
      userTranscript: 'How do I request time off?',
      llmResponse:
        'You can request time off through the HR portal. Navigate to "Leave Requests", select your dates, and submit for manager approval.',
      userAudioDurationMs: 2000,
      responseAudioDurationMs: 4500,
      transcriptConfidence: 0.97,
      retrievedChunks: ['chunk-2', 'chunk-3'],
      asrLatencyMs: 260,
      ragLatencyMs: 170,
      llmLatencyMs: 920,
      ttsLatencyMs: 450,
      totalLatencyMs: 1800,
      asrCost: 0.012,
      llmCost: 0.009,
      ttsCost: 0.014,
      totalCost: 0.035,
    },
    {
      sessionId: sessions[0].id,
      userTranscript: 'Can I work remotely?',
      llmResponse:
        'Yes, remote work is permitted up to 3 days per week with prior manager approval. Please coordinate with your team to ensure coverage.',
      userAudioDurationMs: 1500,
      responseAudioDurationMs: 4000,
      transcriptConfidence: 0.98,
      retrievedChunks: ['chunk-4'],
      asrLatencyMs: 240,
      ragLatencyMs: 150,
      llmLatencyMs: 880,
      ttsLatencyMs: 420,
      totalLatencyMs: 1690,
      asrCost: 0.01,
      llmCost: 0.008,
      ttsCost: 0.012,
      totalCost: 0.03,
    },
  ];

  for (const turn of turnData) {
    await prisma.conversationTurn.create({ data: turn });
  }

  console.log(`  ✅ Created ${turnData.length} conversation turns\n`);

  // ============================================================================
  // 11. WEBSOCKET SESSIONS
  // ============================================================================
  console.log('🔌 Creating WebSocket sessions...');

  const futureDate = new Date();
  futureDate.setHours(futureDate.getHours() + 2);

  await Promise.all([
    prisma.webSocketSession.create({
      data: {
        userId: proUser.id,
        connectionId: 'ws-conn-001',
        state: 'idle',
        conversationHistory: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi! How can I help you today?' },
        ],
        expiresAt: futureDate,
      },
    }),
    prisma.webSocketSession.create({
      data: {
        userId: enterpriseUser.id,
        connectionId: 'ws-conn-002',
        state: 'listening',
        conversationHistory: [],
        expiresAt: futureDate,
      },
    }),
  ]);

  console.log(`  ✅ Created 2 WebSocket sessions\n`);

  // ============================================================================
  // 12. CACHE ENTRIES
  // ============================================================================
  console.log('💾 Creating cache entries...');

  const cacheExpiry = new Date();
  cacheExpiry.setHours(cacheExpiry.getHours() + 24);

  // Embedding cache
  await prisma.embeddingCache.create({
    data: {
      queryHash: generateHash('vacation policy'),
      embedding: Array.from({ length: 768 }, () => Math.random() * 2 - 1),
      expiresAt: cacheExpiry,
    },
  });

  // Vector search cache
  await prisma.vectorSearchCache.create({
    data: {
      queryHash: generateHash('vacation policy search'),
      userId: proUser.id,
      results: {
        hits: [
          { id: 'chunk-1', score: 0.95, content: 'Vacation policy content...' },
          { id: 'chunk-2', score: 0.87, content: 'Time off procedures...' },
        ],
        totalHits: 2,
      },
      expiresAt: cacheExpiry,
    },
  });

  // LLM response cache
  await prisma.lLMResponseCache.create({
    data: {
      promptHash: generateHash('What is the vacation policy?'),
      response: 'Employees receive 15 days of paid vacation per year.',
      provider: 'gemini-flash',
      expiresAt: cacheExpiry,
      hitCount: 5,
    },
  });

  // Audio chunk cache
  await prisma.audioChunkCache.create({
    data: {
      cacheKey: generateHash('audio-greeting-001'),
      audioData: Buffer.from('mock audio data'),
      format: 'opus',
      durationMs: 2500,
      sampleRate: 16000,
      channels: 1,
      compression: 'opus',
      metadata: { voiceModel: activeVoiceModel.id, text: 'Hello, how can I help?' },
      expiresAt: cacheExpiry,
      hitCount: 12,
    },
  });

  console.log(`  ✅ Created cache entries\n`);

  // ============================================================================
  // 13. RATE LIMITS
  // ============================================================================
  console.log('🚦 Creating rate limit entries...');

  const windowStart = new Date();
  windowStart.setMinutes(0, 0, 0);

  await Promise.all([
    prisma.rateLimit.create({
      data: {
        userId: proUser.id,
        endpoint: '/api/v1/conversations',
        windowStart,
        requestCount: 45,
      },
    }),
    prisma.rateLimit.create({
      data: {
        userId: freeUser.id,
        endpoint: '/api/v1/conversations',
        windowStart,
        requestCount: 95, // Near limit
      },
    }),
    prisma.rateLimit.create({
      data: {
        userId: enterpriseUser.id,
        endpoint: '/api/v1/documents',
        windowStart,
        requestCount: 150,
      },
    }),
  ]);

  console.log(`  ✅ Created 3 rate limit entries\n`);

  // ============================================================================
  // 14. QUERY ANALYTICS
  // ============================================================================
  console.log('📊 Creating query analytics...');

  const analyticsData = [
    { query: 'vacation policy', resultsCount: 5, avgRelevanceScore: 0.92, hasLowConfidence: false },
    {
      query: 'remote work guidelines',
      resultsCount: 3,
      avgRelevanceScore: 0.88,
      hasLowConfidence: false,
    },
    { query: 'salary information', resultsCount: 0, avgRelevanceScore: 0, hasLowConfidence: true },
    {
      query: 'benefits enrollment',
      resultsCount: 2,
      avgRelevanceScore: 0.75,
      hasLowConfidence: false,
    },
    { query: 'xyz123 unknown', resultsCount: 0, avgRelevanceScore: 0, hasLowConfidence: true },
  ];

  for (const data of analyticsData) {
    await prisma.queryAnalytics.create({
      data: {
        ...data,
        userId: proUser.id,
      },
    });
  }

  console.log(`  ✅ Created ${analyticsData.length} query analytics entries\n`);

  // ============================================================================
  // 15. AUDIT LOGS - Various actions
  // ============================================================================
  console.log('📝 Creating audit logs...');

  const auditActions = [
    {
      action: 'user.login',
      resource: 'authentication',
      result: 'success',
      metadata: { method: 'email' },
    },
    {
      action: 'user.login',
      resource: 'authentication',
      result: 'failure',
      metadata: { reason: 'invalid_password' },
    },
    {
      action: 'document.upload',
      resource: handbookDoc.id,
      result: 'success',
      metadata: { filename: 'handbook.pdf' },
    },
    { action: 'document.delete', resource: 'doc-123', result: 'success', metadata: {} },
    {
      action: 'voice_model.train',
      resource: activeVoiceModel.id,
      result: 'success',
      metadata: { duration: 3600 },
    },
    { action: 'conversation.start', resource: sessions[0].id, result: 'success', metadata: {} },
    {
      action: 'api.rate_limit_exceeded',
      resource: '/api/v1/conversations',
      result: 'failure',
      metadata: { limit: 100 },
    },
    {
      action: 'settings.update',
      resource: 'user_settings',
      result: 'success',
      metadata: { changed: ['theme', 'notifications'] },
    },
  ];

  for (const audit of auditActions) {
    await prisma.auditLog.create({
      data: {
        userId: proUser.id,
        ...audit,
        ipAddress: '192.168.1.' + Math.floor(Math.random() * 255),
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
    });
  }

  // Add some audit logs for other users
  await prisma.auditLog.create({
    data: {
      userId: freeUser.id,
      action: 'user.signup',
      resource: 'authentication',
      result: 'success',
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
      metadata: { tier: 'free' },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: enterpriseUser.id,
      action: 'api.key_generated',
      resource: 'api_keys',
      result: 'success',
      ipAddress: '172.16.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      metadata: { keyName: 'production-key' },
    },
  });

  console.log(`  ✅ Created ${auditActions.length + 2} audit logs\n`);

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('═'.repeat(60));
  console.log('🎉 Database seeding completed successfully!');
  console.log('═'.repeat(60));
  console.log('\nSeeded data summary:');
  console.log('  • 5 Users (pro, free, enterprise, test, deleted)');
  console.log('  • 4 Voice Samples (completed, processing, failed)');
  console.log('  • 4 Voice Models (active, inactive, training)');
  console.log('  • 4 Training Jobs (completed, running, queued, failed)');
  console.log('  • 2 Face Models');
  console.log('  • 4 Knowledge Documents (completed, processing, failed)');
  console.log('  • 8 Document Chunks with embeddings');
  console.log('  • 5 FAQs');
  console.log('  • 3 Conversation Sessions (idle, active, error)');
  console.log('  • 3 Conversation Turns');
  console.log('  • 2 WebSocket Sessions');
  console.log('  • 4 Cache Entries (embedding, vector, LLM, audio)');
  console.log('  • 3 Rate Limit Entries');
  console.log('  • 5 Query Analytics');
  console.log('  • 10 Audit Logs');
  console.log('\nTest accounts:');
  console.log('  • pro@example.com (Pro tier)');
  console.log('  • free@example.com (Free tier)');
  console.log('  • enterprise@example.com (Enterprise tier)');
  console.log('  • test@example.com (Testing)');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
