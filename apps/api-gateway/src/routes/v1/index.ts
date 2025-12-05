// TODO: RAG service should be called via gRPC/HTTP, not imported directly
// import { initializeRAGService } from '@clone/rag-service';
import { Router, type Router as RouterType } from 'express';

// import { RAGController } from '../../controllers/rag.controller';

import authRoutes from './auth.routes';
import conversationsRoutes from './conversations.routes';
import documentsRoutes from './documents.routes';
import faqsRoutes from './faqs.routes';
import knowledgeRoutes from './knowledge.routes';
// import { createRAGRoutes } from './rag.routes';
import usageRoutes from './usage.routes';
import voiceRoutes from './voice.routes';

const router: RouterType = Router();

// TODO: Initialize RAG service via gRPC client instead
// const ragService = initializeRAGService({...});
// const ragController = new RAGController(ragService);

router.use('/auth', authRoutes);
router.use('/conversations', conversationsRoutes);
router.use('/documents', documentsRoutes);
router.use('/faqs', faqsRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/usage', usageRoutes);
router.use('/voice', voiceRoutes);
// router.use('/rag', createRAGRoutes(ragController));

export default router;
