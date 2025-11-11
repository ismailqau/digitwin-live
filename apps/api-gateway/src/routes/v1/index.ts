import { Router, type Router as RouterType } from 'express';

import authRoutes from './auth.routes';
import conversationsRoutes from './conversations.routes';
import documentsRoutes from './documents.routes';
import faqsRoutes from './faqs.routes';
import knowledgeRoutes from './knowledge.routes';
import voiceRoutes from './voice.routes';

const router: RouterType = Router();

router.use('/auth', authRoutes);
router.use('/conversations', conversationsRoutes);
router.use('/documents', documentsRoutes);
router.use('/faqs', faqsRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/voice', voiceRoutes);

export default router;
