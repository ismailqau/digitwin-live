import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

/**
 * Middleware to check if user has required permission
 */
export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const hasPermission = req.user.permissions.includes(permission) || 
                         req.user.roles?.includes('admin');

    if (!hasPermission) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Permission denied. Required permission: ${permission}`
        }
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check if user has required role
 */
export const requireRole = (role: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const hasRole = req.user.roles?.includes(role);

    if (!hasRole) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required role: ${role}`
        }
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check if user has any of the required roles
 */
export const requireAnyRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const hasAnyRole = roles.some(role => req.user?.roles?.includes(role));

    if (!hasAnyRole) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required roles: ${roles.join(', ')}`
        }
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check if user has all required permissions
 */
export const requireAllPermissions = (permissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const isAdmin = req.user.roles?.includes('admin');
    const hasAllPermissions = permissions.every(permission => 
      req.user?.permissions.includes(permission)
    );

    if (!hasAllPermissions && !isAdmin) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Permission denied. Required permissions: ${permissions.join(', ')}`
        }
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check subscription tier
 */
export const requireSubscriptionTier = (minTier: 'free' | 'pro' | 'enterprise') => {
  const tierLevels = { free: 0, pro: 1, enterprise: 2 };

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const userTierLevel = tierLevels[req.user.subscriptionTier];
    const requiredTierLevel = tierLevels[minTier];

    if (userTierLevel < requiredTierLevel) {
      res.status(403).json({
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: `This feature requires ${minTier} subscription or higher`,
          requiredTier: minTier,
          currentTier: req.user.subscriptionTier
        }
      });
      return;
    }

    next();
  };
};
