import { Router, type Router as RouterType } from 'express';

import authRoutes from './auth.routes';
import documentsRoutes from './documents.routes';
import faqsRoutes from './faqs.routes';
import knowledgeRoutes from './knowledge.routes';

const router: RouterType = Router();

router.use('/auth', authRoutes);
router.use('/documents', documentsRoutes);
router.use('/faqs', faqsRoutes);
router.use('/knowledge', knowledgeRoutes);

export default router;
