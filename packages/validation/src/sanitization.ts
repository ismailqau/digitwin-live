/**
 * Input sanitization utilities to prevent injection attacks
 */

/**
 * Sanitize string input to prevent XSS attacks
 * Removes HTML tags and dangerous characters
 */
export function sanitizeString(input: string): string {
  if (!input) return '';

  return (
    input
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Remove script tags and content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove event handlers
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      // Remove javascript: protocol
      .replace(/javascript:/gi, '')
      // Remove data: protocol (can be used for XSS)
      .replace(/data:text\/html/gi, '')
      // Trim whitespace
      .trim()
  );
}

/**
 * Sanitize HTML content while preserving safe tags
 * Allows basic formatting tags only
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  const allowedTags = ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'code', 'pre'];
  const allowedAttributes = ['href', 'title'];

  let sanitized = input;

  // Remove all tags except allowed ones
  sanitized = sanitized.replace(/<(\/?)([\w]+)([^>]*)>/gi, (_match, slash, tag, attrs) => {
    if (!allowedTags.includes(tag.toLowerCase())) {
      return '';
    }

    // For allowed tags, sanitize attributes
    if (attrs) {
      attrs = attrs.replace(
        /(\w+)\s*=\s*["']([^"']*)["']/gi,
        (_attrMatch: string, name: string, value: string) => {
          if (!allowedAttributes.includes(name.toLowerCase())) {
            return '';
          }
          // Prevent javascript: and data: protocols in href
          if (name.toLowerCase() === 'href' && /^(javascript|data):/i.test(value)) {
            return '';
          }
          return ` ${name}="${sanitizeString(value)}"`;
        }
      );
    }

    return `<${slash}${tag}${attrs}>`;
  });

  return sanitized;
}

/**
 * Sanitize SQL input to prevent SQL injection
 * Note: This is a basic sanitizer. Always use parameterized queries!
 */
export function sanitizeSql(input: string): string {
  if (!input) return '';

  return (
    input
      // Remove SQL comments
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Escape single quotes
      .replace(/'/g, "''")
      // Remove dangerous SQL keywords at the start
      .replace(/^\s*(DROP|DELETE|TRUNCATE|ALTER|CREATE|INSERT|UPDATE|EXEC|EXECUTE)\s+/gi, '')
      .trim()
  );
}

/**
 * Sanitize file path to prevent directory traversal attacks
 */
export function sanitizeFilePath(input: string): string {
  if (!input) return '';

  return (
    input
      // Remove directory traversal attempts
      .replace(/\.\./g, '')
      .replace(/\\/g, '/')
      // Remove leading slashes
      .replace(/^\/+/, '')
      // Remove null bytes
      .replace(/\0/g, '')
      .trim()
  );
}

/**
 * Sanitize filename to prevent malicious file names
 */
export function sanitizeFilename(input: string): string {
  if (!input) return '';

  return (
    input
      // Remove path separators
      .replace(/[/\\]/g, '')
      // Remove null bytes
      .replace(/\0/g, '')
      // Remove control characters
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, '')
      // Remove dangerous characters
      .replace(/[<>:"|?*]/g, '')
      // Limit length
      .substring(0, 255)
      .trim()
  );
}

/**
 * Sanitize URL to prevent open redirect and SSRF attacks
 */
export function sanitizeUrl(input: string): string {
  if (!input) return '';

  try {
    const url = new URL(input);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return '';
    }

    // Prevent localhost and private IP ranges (basic SSRF protection)
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.')
    ) {
      return '';
    }

    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(input: string): string {
  if (!input) return '';

  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w.@+-]/g, '');
}

/**
 * Sanitize object by applying sanitization to all string values
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  sanitizer: (value: string) => string = sanitizeString
): T {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizer(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item: unknown) =>
        typeof item === 'string' ? sanitizer(item) : item
      );
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, sanitizer);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}
