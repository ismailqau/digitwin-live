/**
 * File validation utilities for upload security
 */

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Allowed file types for document uploads
 */
export const ALLOWED_DOCUMENT_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'text/plain': ['.txt'],
  'text/html': ['.html', '.htm'],
  'text/markdown': ['.md', '.markdown'],
} as const;

/**
 * Allowed file types for image uploads (face models)
 */
export const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
} as const;

/**
 * Allowed file types for video uploads (face models)
 */
export const ALLOWED_VIDEO_TYPES = {
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/webm': ['.webm'],
} as const;

/**
 * Allowed file types for audio uploads (voice samples)
 */
export const ALLOWED_AUDIO_TYPES = {
  'audio/wav': ['.wav'],
  'audio/mpeg': ['.mp3'],
  'audio/mp4': ['.m4a'],
  'audio/ogg': ['.ogg'],
  'audio/webm': ['.webm'],
} as const;

/**
 * File size limits (in bytes)
 */
export const FILE_SIZE_LIMITS = {
  document: 50 * 1024 * 1024, // 50MB
  image: 10 * 1024 * 1024, // 10MB
  video: 100 * 1024 * 1024, // 100MB
  audio: 50 * 1024 * 1024, // 50MB
} as const;

/**
 * Validate file size
 */
export function validateFileSize(
  sizeBytes: number,
  maxSize: number,
  filename?: string
): FileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (sizeBytes <= 0) {
    errors.push('File is empty');
  } else if (sizeBytes > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
    const actualSizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
    errors.push(
      `File size (${actualSizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB)${
        filename ? ` for ${filename}` : ''
      }`
    );
  } else if (sizeBytes > maxSize * 0.8) {
    // Warning if file is close to limit
    warnings.push('File size is close to the maximum limit');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate file type by MIME type and extension
 */
export function validateFileType(
  mimeType: string,
  filename: string,
  allowedTypes: Record<string, readonly string[]>
): FileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get file extension
  const extension = filename.toLowerCase().match(/\.[^.]+$/)?.[0] || '';

  // Check if MIME type is allowed
  const allowedExtensions = allowedTypes[mimeType];
  if (!allowedExtensions) {
    errors.push(
      `File type '${mimeType}' is not allowed. Allowed types: ${Object.keys(allowedTypes).join(', ')}`
    );
    return { isValid: false, errors, warnings };
  }

  // Check if extension matches MIME type
  if (!allowedExtensions.includes(extension)) {
    errors.push(
      `File extension '${extension}' does not match MIME type '${mimeType}'. Expected: ${allowedExtensions.join(', ')}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate document file
 */
export function validateDocumentFile(
  filename: string,
  mimeType: string,
  sizeBytes: number
): FileValidationResult {
  const typeResult = validateFileType(mimeType, filename, ALLOWED_DOCUMENT_TYPES);
  const sizeResult = validateFileSize(sizeBytes, FILE_SIZE_LIMITS.document, filename);

  return {
    isValid: typeResult.isValid && sizeResult.isValid,
    errors: [...typeResult.errors, ...sizeResult.errors],
    warnings: [...typeResult.warnings, ...sizeResult.warnings],
  };
}

/**
 * Validate image file
 */
export function validateImageFile(
  filename: string,
  mimeType: string,
  sizeBytes: number
): FileValidationResult {
  const typeResult = validateFileType(mimeType, filename, ALLOWED_IMAGE_TYPES);
  const sizeResult = validateFileSize(sizeBytes, FILE_SIZE_LIMITS.image, filename);

  return {
    isValid: typeResult.isValid && sizeResult.isValid,
    errors: [...typeResult.errors, ...sizeResult.errors],
    warnings: [...typeResult.warnings, ...sizeResult.warnings],
  };
}

/**
 * Validate video file
 */
export function validateVideoFile(
  filename: string,
  mimeType: string,
  sizeBytes: number
): FileValidationResult {
  const typeResult = validateFileType(mimeType, filename, ALLOWED_VIDEO_TYPES);
  const sizeResult = validateFileSize(sizeBytes, FILE_SIZE_LIMITS.video, filename);

  return {
    isValid: typeResult.isValid && sizeResult.isValid,
    errors: [...typeResult.errors, ...sizeResult.errors],
    warnings: [...typeResult.warnings, ...sizeResult.warnings],
  };
}

/**
 * Validate audio file
 */
export function validateAudioFile(
  filename: string,
  mimeType: string,
  sizeBytes: number
): FileValidationResult {
  const typeResult = validateFileType(mimeType, filename, ALLOWED_AUDIO_TYPES);
  const sizeResult = validateFileSize(sizeBytes, FILE_SIZE_LIMITS.audio, filename);

  return {
    isValid: typeResult.isValid && sizeResult.isValid,
    errors: [...typeResult.errors, ...sizeResult.errors],
    warnings: [...typeResult.warnings, ...sizeResult.warnings],
  };
}

/**
 * Check for malicious file content patterns
 * Basic checks for common malware signatures
 */
export function scanForMaliciousContent(content: Buffer): FileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Convert buffer to string for pattern matching
  const contentStr = content.toString('utf8', 0, Math.min(content.length, 10000)); // Check first 10KB

  // Check for executable signatures
  const executableSignatures = [
    'MZ', // Windows executable
    '\x7fELF', // Linux executable
    '#!', // Shell script
    '<?php', // PHP script
    '<script', // JavaScript in HTML
  ];

  for (const signature of executableSignatures) {
    if (contentStr.startsWith(signature)) {
      errors.push('File contains executable code and may be malicious');
      break;
    }
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /eval\s*\(/gi, // eval() function
    /exec\s*\(/gi, // exec() function
    /system\s*\(/gi, // system() function
    /<iframe/gi, // iframe tags
    /javascript:/gi, // javascript: protocol
    /vbscript:/gi, // vbscript: protocol
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(contentStr)) {
      warnings.push('File contains potentially suspicious patterns');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate batch file upload
 */
export function validateBatchUpload(
  files: Array<{ filename: string; mimeType: string; sizeBytes: number }>,
  maxFiles: number = 10,
  maxTotalSize: number = 100 * 1024 * 1024 // 100MB total
): FileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file count
  if (files.length === 0) {
    errors.push('No files provided');
  } else if (files.length > maxFiles) {
    errors.push(`Too many files. Maximum ${maxFiles} files allowed, got ${files.length}`);
  }

  // Check total size
  const totalSize = files.reduce((sum, file) => sum + file.sizeBytes, 0);
  if (totalSize > maxTotalSize) {
    const maxSizeMB = (maxTotalSize / (1024 * 1024)).toFixed(2);
    const actualSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    errors.push(`Total size (${actualSizeMB}MB) exceeds maximum (${maxSizeMB}MB)`);
  }

  // Check for duplicate filenames
  const filenames = files.map((f) => f.filename);
  const duplicates = filenames.filter((name, index) => filenames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    warnings.push(`Duplicate filenames detected: ${duplicates.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
