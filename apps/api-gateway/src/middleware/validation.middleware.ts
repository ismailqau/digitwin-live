import { logger } from '@clone/logger';
import {
  sanitizeObject,
  checkContentSafety,
  getContentPolicyMessage,
  createFlaggedContentLog,
} from '@clone/validation';
import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validation middleware using Zod schemas
 */
export const validateRequest = (
  schema: ZodSchema,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get data from specified source
      const data = req[source];

      // Validate with Zod schema
      const validated = await schema.parseAsync(data);

      // Replace request data with validated data
      req[source] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: error.errors.map((err) => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })),
          },
        });
      } else {
        next(error);
      }
    }
  };
};

/**
 * Sanitization middleware to prevent injection attacks
 */
export const sanitizeRequest = (source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = req[source];

      if (data && typeof data === 'object') {
        // Sanitize all string values in the object
        req[source] = sanitizeObject(data);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Content safety middleware to filter inappropriate content
 */
export const checkContentSafetyMiddleware = (
  fields: string[] = ['content', 'message', 'text', 'query']
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req.body;

      if (!data || typeof data !== 'object') {
        next();
        return;
      }

      // Check specified fields for inappropriate content
      for (const field of fields) {
        const value = data[field];

        if (typeof value === 'string' && value.length > 0) {
          const safetyResult = checkContentSafety(value);

          if (!safetyResult.isSafe) {
            // Log flagged content (maintains privacy)
            const userId = (req as { user?: { id: string } }).user?.id || 'anonymous';
            const log = createFlaggedContentLog(userId, safetyResult, value.length);

            logger.warn('Content safety violation detected', {
              ...log,
              field,
              endpoint: req.path,
            });

            // Return policy violation message
            res.status(400).json({
              error: {
                code: 'CONTENT_POLICY_VIOLATION',
                message: getContentPolicyMessage(safetyResult.category),
                category: safetyResult.category,
              },
            });
            return;
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Combined validation middleware: sanitize + validate + content safety
 */
export const validateAndSanitize = (
  schema: ZodSchema,
  options: {
    source?: 'body' | 'query' | 'params';
    checkContentSafety?: boolean;
    contentFields?: string[];
  } = {}
) => {
  const { source = 'body', checkContentSafety: checkSafety = false, contentFields } = options;

  return [
    sanitizeRequest(source),
    validateRequest(schema, source),
    ...(checkSafety ? [checkContentSafetyMiddleware(contentFields)] : []),
  ];
};

/**
 * Legacy validate function for backward compatibility with express-validator
 * @deprecated Use validateRequest with Zod schemas instead
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      next();
      return;
    }

    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors.array(),
      },
    });
  };
};
