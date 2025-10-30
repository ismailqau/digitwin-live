import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create test users
  const user1 = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test User',
      personalityTraits: ['friendly', 'professional', 'helpful'],
      speakingStyle: 'casual and conversational',
      preferredLLMProvider: 'gemini-flash',
      preferredTTSProvider: 'xtts-v2',
      subscriptionTier: 'pro',
      settings: {
        enableConversationHistory: true,
        autoLanguageDetection: true,
        videoQuality: 'auto',
        interruptionSensitivity: 0.7,
      },
    },
  });

  console.log('✅ Created user:', user1.email);

  const user2 = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      personalityTraits: ['enthusiastic', 'technical', 'concise'],
      speakingStyle: 'technical and precise',
      preferredLLMProvider: 'gpt4-turbo',
      preferredTTSProvider: 'openai-tts',
      subscriptionTier: 'free',
      settings: {
        enableConversationHistory: false,
        autoLanguageDetection: false,
        videoQuality: 'medium',
        interruptionSensitivity: 0.5,
      },
    },
  });

  console.log('✅ Created user:', user2.email);

  // Create voice models
  const voiceModel1 = await prisma.voiceModel.create({
    data: {
      userId: user1.id,
      provider: 'xtts-v2',
      modelPath: 'gs://clone-voice-models/test-user/model-v1.pth',
      sampleRate: 22050,
      qualityScore: 0.92,
      isActive: true,
      metadata: {
        trainingDuration: 300,
        sampleCount: 50,
      },
    },
  });

  console.log('✅ Created voice model for:', user1.email);

  // Create face models
  const faceModel1 = await prisma.faceModel.create({
    data: {
      userId: user1.id,
      modelPath: 'gs://clone-face-models/test-user/model-v1',
      resolution: { width: 512, height: 512 },
      qualityScore: 0.88,
      isActive: true,
      metadata: {
        photoCount: 8,
        processingTime: 180,
      },
    },
  });

  console.log('✅ Created face model for:', user1.email);

  // Create knowledge documents
  const doc1 = await prisma.knowledgeDocument.create({
    data: {
      userId: user1.id,
      filename: 'company-handbook.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024000,
      textContent: 'This is a sample company handbook with policies and procedures...',
      chunkCount: 25,
      title: 'Company Handbook',
      tags: ['company', 'policies', 'hr'],
      status: 'completed',
      processedAt: new Date(),
      storagePath: 'gs://clone-documents/test-user/handbook.pdf',
      vectorIds: Array.from({ length: 25 }, (_, i) => `vec-${i + 1}`),
    },
  });

  console.log('✅ Created knowledge document:', doc1.filename);

  const doc2 = await prisma.knowledgeDocument.create({
    data: {
      userId: user1.id,
      filename: 'product-specs.md',
      contentType: 'text/markdown',
      sizeBytes: 512000,
      textContent: 'Product specifications and technical details...',
      chunkCount: 15,
      title: 'Product Specifications',
      tags: ['product', 'technical', 'specs'],
      status: 'completed',
      processedAt: new Date(),
      storagePath: 'gs://clone-documents/test-user/specs.md',
      vectorIds: Array.from({ length: 15 }, (_, i) => `vec-${i + 26}`),
    },
  });

  console.log('✅ Created knowledge document:', doc2.filename);

  // Create a conversation session
  const session1 = await prisma.conversationSession.create({
    data: {
      userId: user1.id,
      state: 'completed',
      llmProvider: 'gemini-flash',
      ttsProvider: 'xtts-v2',
      voiceModelId: voiceModel1.id,
      faceModelId: faceModel1.id,
      totalTurns: 5,
      averageLatencyMs: 1850,
      totalCost: 0.12,
      durationSeconds: 180,
      endedAt: new Date(),
    },
  });

  console.log('✅ Created conversation session');

  // Create conversation turns
  const turns = [
    {
      userTranscript: 'What are the company vacation policies?',
      llmResponse:
        'According to the company handbook, employees receive 15 days of paid vacation per year.',
      userAudioDurationMs: 2500,
      responseAudioDurationMs: 4000,
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
      userTranscript: 'How do I request time off?',
      llmResponse:
        'You can request time off through the HR portal by submitting a leave request form at least 2 weeks in advance.',
      userAudioDurationMs: 2000,
      responseAudioDurationMs: 5000,
      transcriptConfidence: 0.97,
      retrievedChunks: ['chunk-3', 'chunk-4'],
      asrLatencyMs: 260,
      ragLatencyMs: 170,
      llmLatencyMs: 920,
      ttsLatencyMs: 480,
      totalLatencyMs: 1830,
      asrCost: 0.012,
      llmCost: 0.009,
      ttsCost: 0.015,
      totalCost: 0.036,
    },
  ];

  for (const turn of turns) {
    await prisma.conversationTurn.create({
      data: {
        sessionId: session1.id,
        ...turn,
      },
    });
  }

  console.log('✅ Created conversation turns');

  // Create audit logs
  await prisma.auditLog.create({
    data: {
      userId: user1.id,
      action: 'user.login',
      resource: 'authentication',
      result: 'success',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      metadata: {
        method: 'email',
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user1.id,
      action: 'document.upload',
      resource: doc1.id,
      result: 'success',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      metadata: {
        filename: doc1.filename,
        size: doc1.sizeBytes,
      },
    },
  });

  console.log('✅ Created audit logs');

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
