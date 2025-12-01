/**
 * Field filtering middleware for partial responses
 * Implements GraphQL-style field selection for REST APIs
 * Example: GET /api/v1/documents?fields=id,title,uploadedAt
 */

import { logger } from '@clone/logger';
import { Request, Response, NextFunction } from 'express';

/**
 * Filter object fields based on requested fields
 */
function filterFields(obj: unknown, fields: string[]): unknown {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => filterFields(item, fields));
  }

  const objRecord = obj as Record<string, unknown>;
  const filtered: Record<string, unknown> = {};

  for (const field of fields) {
    // Support nested fields with dot notation (e.g., "user.name")
    if (field.includes('.')) {
      const [parent, ...rest] = field.split('.');
      if (objRecord[parent]) {
        if (!filtered[parent]) {
          filtered[parent] = {};
        }
        const nestedFiltered = filterFields(objRecord[parent], [rest.join('.')]);
        const currentParent = filtered[parent] as Record<string, unknown>;
        filtered[parent] = { ...currentParent, ...(nestedFiltered as Record<string, unknown>) };
      }
    } else if (Object.prototype.hasOwnProperty.call(objRecord, field)) {
      filtered[field] = objRecord[field];
    }
  }

  return filtered;
}

/**
 * Parse fields parameter from query string
 * Supports comma-separated fields: ?fields=id,title,author
 */
function parseFieldsParam(fieldsParam: string | undefined): string[] | null {
  if (!fieldsParam) {
    return null;
  }

  return fieldsParam
    .split(',')
    .map((f) => f.trim())
    .filter((f) => f.length > 0);
}

/**
 * Field filtering middleware
 * Intercepts JSON responses and filters fields based on query parameter
 */
export function fieldFilteringMiddleware(req: Request, res: Response, next: NextFunction): void {
  const fieldsParam = req.query.fields as string | undefined;
  const fields = parseFieldsParam(fieldsParam);

  // If no fields specified, pass through
  if (!fields || fields.length === 0) {
    return next();
  }

  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method to filter fields
  res.json = function (body: unknown): Response {
    try {
      // Filter the response body
      const filtered = filterFields(body, fields);

      logger.debug('Response fields filtered', {
        path: req.path,
        requestedFields: fields,
        originalSize: JSON.stringify(body).length,
        filteredSize: JSON.stringify(filtered).length,
      });

      // Send filtered response
      return originalJson(filtered);
    } catch (error) {
      logger.error('Field filtering error', {
        error: (error as Error).message,
        fields,
      });

      // On error, send original response
      return originalJson(body);
    }
  };

  next();
}

/**
 * Validate fields parameter
 * Ensures requested fields are allowed
 */
export function validateFieldsMiddleware(allowedFields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const fieldsParam = req.query.fields as string | undefined;
    const fields = parseFieldsParam(fieldsParam);

    if (!fields) {
      return next();
    }

    // Check if all requested fields are allowed
    const invalidFields = fields.filter((field) => {
      // Support nested fields
      const rootField = field.split('.')[0];
      return !allowedFields.includes(rootField);
    });

    if (invalidFields.length > 0) {
      res.status(400).json({
        error: 'Invalid fields parameter',
        message: `Invalid fields: ${invalidFields.join(', ')}`,
        allowedFields,
      });
      return;
    }

    next();
  };
}

/**
 * Create field filtering middleware with allowed fields
 */
export function createFieldFilteringMiddleware(allowedFields: string[]) {
  return [validateFieldsMiddleware(allowedFields), fieldFilteringMiddleware];
}
