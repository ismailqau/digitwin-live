import { initializeRAGService } from '@clone/rag-service';
import { Router, type Router as RouterType } from 'express';

import { RAGController } from '../../controllers/rag.controller';

import authRoutes from './auth.routes';
import conversationsRoutes from './conversations.routes';
import documentsRoutes from './documents.routes';
import faqsRoutes from './faqs.routes';
import knowledgeRoutes from './knowledge.routes';
import { createRAGRoutes } from './rag.routes';
import voiceRoutes from './voice.routes';

const router: RouterType = Router();

// Initialize RAG service
const ragService = initializeRAGService({
  projectId: process.env.GCP_PROJECT_ID || '',
  location: process.env.GCP_REGION || 'us-central1',
  databaseUrl: process.env.DATABASE_URL || '',
  cacheEnabled: process.env.ENABLE_CACHING !== 'false',
  cacheTtlShort: parseInt(process.env.CACHE_TTL_SHORT || '300'),
  cacheTtlMedium: parseInt(process.env.CACHE_TTL_MEDIUM || '3600'),
  cacheTtlLong: parseInt(process.env.CACHE_TTL_LONG || '86400'),
  similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.7'),
  topK: parseInt(process.env.RAG_TOP_K || '5'),
  maxConversationTurns: parseInt(process.env.MAX_CONVERSATION_TURNS || '5'),
});

const ragController = new RAGController(ragService);

router.use('/auth', authRoutes);
router.use('/conversations', conversationsRoutes);
router.use('/documents', documentsRoutes);
router.use('/faqs', faqsRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/voice', voiceRoutes);
router.use('/rag', createRAGRoutes(ragController));

export default router;
