import { Router, type Router as RouterType } from 'express';
import authRoutes from './auth.routes';
import documentsRoutes from './documents.routes';

const router: RouterType = Router();

router.use('/auth', authRoutes);
router.use('/documents', documentsRoutes);

export default router;
