import { Router, type Router as RouterType } from 'express';
import { body } from 'express-validator';
import { 
  register, 
  login, 
  refreshToken, 
  loginWithGoogle, 
  loginWithApple, 
  logout,
  getCurrentUser 
} from '../../controllers/auth.controller';
import { validate } from '../../middleware/validation.middleware';
import { authLimiter } from '../../middleware/rateLimit.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';

const router: RouterType = Router();

// Apply rate limiting to all auth routes
router.use(authLimiter);

// Registration and login
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

// OAuth endpoints
router.post(
  '/oauth/google',
  validate([
    body('token').notEmpty()
  ]),
  loginWithGoogle
);

router.post(
  '/oauth/apple',
  validate([
    body('token').notEmpty()
  ]),
  loginWithApple
);

// Token management
router.post(
  '/refresh',
  validate([
    body('refreshToken').notEmpty()
  ]),
  refreshToken
);

router.post(
  '/logout',
  validate([
    body('refreshToken').notEmpty()
  ]),
  logout
);

// User profile
router.get('/me', authMiddleware, getCurrentUser);

export default router;
