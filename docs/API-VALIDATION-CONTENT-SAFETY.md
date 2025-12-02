# API Validation and Content Safety

This document describes the validation and content safety mechanisms implemented in the Real-Time Conversational Clone system.

## Overview

The system implements comprehensive validation and content safety measures to:

- Prevent injection attacks (XSS, SQL injection)
- Validate file uploads (size, type, content)
- Filter inappropriate content
- Protect user privacy
- Ensure data integrity

## Validation Package (@clone/validation)

The validation package provides utilities for request validation, input sanitization, content safety, and file validation.

### Installation

```bash
pnpm add @clone/validation
```

### Zod Schemas

All API requests are validated using Zod schemas:

```typescript
import { documentUploadSchema, validateRequest } from '@clone/validation';

// In your route
router.post('/documents', validateRequest(documentUploadSchema), uploadHandler);
```

Available schemas:

- `userProfileSchema` - User profile data
- `audioChunkSchema` - Audio streaming data
- `documentUploadSchema` - Document upload metadata
- `documentUpdateSchema` - Document updates
- `documentSearchSchema` - Document search queries
- `faqCreateSchema` - FAQ creation
- `faqUpdateSchema` - FAQ updates
- `voiceConfigSchema` - Voice configuration
- `faceModelUploadSchema` - Face model upload
- `userSettingsSchema` - User settings

## Input Sanitization

### String Sanitization

Removes HTML tags, script content, and dangerous characters:

```typescript
import { sanitizeString } from '@clone/validation';

const clean = sanitizeString(userInput);
// Removes: <script>, event handlers, javascript:, data: protocols
```

### HTML Sanitization

Preserves safe HTML tags while removing dangerous content:

```typescript
import { sanitizeHtml } from '@clone/validation';

const clean = sanitizeHtml(htmlContent);
// Allows: p, br, strong, em, u, ul, ol, li, a, code, pre
// Removes: script, iframe, event handlers
```

### SQL Sanitization

Basic SQL injection prevention (always use parameterized queries!):

```typescript
import { sanitizeSql } from '@clone/validation';

const clean = sanitizeSql(userInput);
// Removes: SQL comments, dangerous keywords, escapes quotes
```

### File Path Sanitization

Prevents directory traversal attacks:

```typescript
import { sanitizeFilePath, sanitizeFilename } from '@clone/validation';

const safePath = sanitizeFilePath(userPath);
// Removes: ../, \, leading slashes, null bytes

const safeFilename = sanitizeFilename(userFilename);
// Removes: path separators, control characters, dangerous chars
```

### URL Sanitization

Prevents open redirect and SSRF attacks:

```typescript
import { sanitizeUrl } from '@clone/validation';

const safeUrl = sanitizeUrl(userUrl);
// Only allows: http:, https:
// Blocks: localhost, private IPs, javascript:, data:
```

### Object Sanitization

Recursively sanitizes all string values in an object:

```typescript
import { sanitizeObject } from '@clone/validation';

const clean = sanitizeObject(requestBody);
// Applies sanitization to all string values
```

## Content Safety

### Content Safety Check

Checks content for inappropriate keywords:

```typescript
import { checkContentSafety } from '@clone/validation';

const result = checkContentSafety(userMessage);
// Returns: { isSafe, flaggedTerms, category, confidence }
```

Categories:

- `profanity` - Profane language
- `hate_speech` - Hate speech
- `violence` - Violent content
- `sexual` - Sexual content
- `spam` - Spam indicators

### Content Filtering

Filters inappropriate content by replacing with asterisks:

```typescript
import { filterInappropriateContent } from '@clone/validation';

const filtered = filterInappropriateContent(userMessage);
// Replaces flagged terms with asterisks
```

### Spam Detection

Detects spam based on multiple indicators:

```typescript
import { isSpam } from '@clone/validation';

if (isSpam(userMessage)) {
  // Handle spam
}
// Checks: spam keywords, excessive caps, punctuation, URLs
```

### PII Detection and Redaction

Detects and redacts personally identifiable information:

```typescript
import { containsPII, redactPII } from '@clone/validation';

if (containsPII(content)) {
  const redacted = redactPII(content);
  // Redacts: emails, phone numbers, SSN, credit cards
}
```

### Privacy-Preserving Logging

Logs flagged content without storing actual content:

```typescript
import { createFlaggedContentLog } from '@clone/validation';

const log = createFlaggedContentLog(userId, safetyResult, contentLength);
// Logs: timestamp, hashed userId, category, count, length
// Does NOT log: actual content (maintains privacy)
```

## File Validation

### Document Validation

Validates document uploads:

```typescript
import { validateDocumentFile } from '@clone/validation';

const result = validateDocumentFile(filename, mimeType, sizeBytes);
// Validates: type (PDF, DOCX, TXT, HTML, MD), size (max 50MB)
```

### Image Validation

Validates image uploads for face models:

```typescript
import { validateImageFile } from '@clone/validation';

const result = validateImageFile(filename, mimeType, sizeBytes);
// Validates: type (JPEG, PNG, WebP), size (max 10MB)
```

### Video Validation

Validates video uploads for face models:

```typescript
import { validateVideoFile } from '@clone/validation';

const result = validateVideoFile(filename, mimeType, sizeBytes);
// Validates: type (MP4, MOV, WebM), size (max 100MB)
```

### Audio Validation

Validates audio uploads for voice samples:

```typescript
import { validateAudioFile } from '@clone/validation';

const result = validateAudioFile(filename, mimeType, sizeBytes);
// Validates: type (WAV, MP3, M4A, OGG), size (max 50MB)
```

### Malicious Content Scanning

Scans file content for malicious patterns:

```typescript
import { scanForMaliciousContent } from '@clone/validation';

const result = scanForMaliciousContent(fileBuffer);
// Checks: executable signatures, suspicious patterns
// Detects: MZ, ELF, scripts, eval(), exec(), iframes
```

### Batch Upload Validation

Validates multiple file uploads:

```typescript
import { validateBatchUpload } from '@clone/validation';

const result = validateBatchUpload(files, maxFiles, maxTotalSize);
// Validates: file count, total size, duplicate filenames
```

## Middleware Usage

### Validation Middleware

Use Zod schemas for request validation:

```typescript
import { validateRequest, validateAndSanitize } from './middleware/validation.middleware';
import { documentUploadSchema } from '@clone/validation';

// Basic validation
router.post('/documents', validateRequest(documentUploadSchema), handler);

// Validation + sanitization
router.post('/documents', validateAndSanitize(documentUploadSchema), handler);

// Validation + sanitization + content safety
router.post(
  '/messages',
  validateAndSanitize(messageSchema, {
    checkContentSafety: true,
    contentFields: ['message', 'content'],
  }),
  handler
);
```

### File Upload Middleware

Use pre-configured file upload middleware:

```typescript
import {
  uploadDocument,
  uploadDocuments,
  uploadImage,
  uploadImages,
  uploadVideo,
  uploadAudio,
} from './middleware/fileUpload.middleware';

// Single document upload
router.post('/documents', uploadDocument, handler);

// Multiple document uploads
router.post('/documents/batch', uploadDocuments, handler);

// Image upload for face models
router.post('/face-models', uploadImages, handler);

// Video upload for face models
router.post('/face-models/video', uploadVideo, handler);

// Audio upload for voice samples
router.post('/voice-samples', uploadAudio, handler);
```

### Content Safety Middleware

Check content safety for specific fields:

```typescript
import { checkContentSafetyMiddleware } from './middleware/validation.middleware';

router.post('/messages', checkContentSafetyMiddleware(['message', 'content', 'query']), handler);
```

## Error Responses

### Validation Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format",
        "code": "invalid_string"
      }
    ]
  }
}
```

### Content Policy Violations

```json
{
  "error": {
    "code": "CONTENT_POLICY_VIOLATION",
    "message": "Your message contains content that violates our content policy. Please rephrase and try again. Please avoid using profanity in your messages.",
    "category": "profanity"
  }
}
```

### File Validation Errors

```json
{
  "error": {
    "code": "FILE_VALIDATION_FAILED",
    "message": "One or more files failed validation",
    "details": [
      {
        "filename": "document.exe",
        "errors": ["File type 'application/x-msdownload' is not allowed"]
      }
    ],
    "warnings": [
      {
        "filename": "large-file.pdf",
        "warnings": ["File size is close to the maximum limit"]
      }
    ]
  }
}
```

## Security Best Practices

### Always Use Parameterized Queries

Never concatenate user input into SQL queries:

```typescript
// ❌ BAD - Vulnerable to SQL injection
const query = `SELECT * FROM users WHERE email = '${userEmail}'`;

// ✅ GOOD - Use parameterized queries
const user = await prisma.user.findUnique({
  where: { email: userEmail },
});
```

### Sanitize Before Validation

Apply sanitization before validation to prevent bypasses:

```typescript
// ✅ GOOD - Sanitize then validate
router.post('/endpoint', sanitizeRequest('body'), validateRequest(schema), handler);
```

### Validate File Content, Not Just Extension

Always validate MIME type and scan content:

```typescript
// ✅ GOOD - Validates type, size, and content
const result = validateDocumentFile(filename, mimeType, sizeBytes);
const scanResult = scanForMaliciousContent(fileBuffer);
```

### Log Security Events

Log all security-related events for monitoring:

```typescript
logger.warn('Content safety violation detected', {
  userId: hashedUserId,
  category: result.category,
  endpoint: req.path,
});
```

### Maintain User Privacy

Never log actual content, only metadata:

```typescript
// ❌ BAD - Logs actual content
logger.warn('Flagged content', { content: userMessage });

// ✅ GOOD - Logs metadata only
const log = createFlaggedContentLog(userId, result, contentLength);
logger.warn('Flagged content', log);
```

## Configuration

### Environment Variables

```bash
# Content safety (optional)
ENABLE_CONTENT_SAFETY=true
CONTENT_SAFETY_THRESHOLD=0.7

# File upload limits
MAX_FILE_SIZE_MB=50
MAX_BATCH_FILES=10
MAX_BATCH_SIZE_MB=100
```

## Future Enhancements

### Advanced Content Moderation

For production, consider integrating:

- **Perspective API** (Google) - Advanced toxicity detection
- **Azure Content Moderator** - Multi-language moderation
- **AWS Comprehend** - Sentiment and entity analysis
- **OpenAI Moderation API** - GPT-powered content filtering

### Machine Learning Models

- Train custom models for domain-specific content
- Implement context-aware filtering
- Add multi-language support

### Real-time Monitoring

- Dashboard for content safety metrics
- Alerts for unusual patterns
- Automated response to threats

## Related Documentation

- [Error Handling](./ERROR-HANDLING.md)
- [Rate Limiting](./RATE-LIMITING.md)
- [Database Architecture](./DATABASE-ARCHITECTURE.md)
- [API Gateway](./GETTING-STARTED.md#api-gateway)

## Support

For questions or issues:

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review [Known Issues](./KNOWN-ISSUES.md)
3. Contact the development team
