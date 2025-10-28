import { Router, type Router as RouterType } from 'express';
import { body } from 'express-validator';
import { register, login, refreshToken } from '../../controllers/auth.controller';
import { validate } from '../../middleware/validation.middleware';
import { authLimiter } from '../../middleware/rateLimit.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';

const router: RouterType = Router();

// Apply rate limiting to all auth routes
router.use(authLimiter);

router.post(
  '/register',
  validate([
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().notEmpty()
  ]),
  register
);

router.post(
  '/login',
  validate([
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ]),
  login
);

router.post('/refresh', authMiddleware, refreshToken);

export default router;
