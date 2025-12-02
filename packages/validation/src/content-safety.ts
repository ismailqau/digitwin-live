/**
 * Content safety filtering utilities
 * Implements basic keyword-based filtering for inappropriate content
 */

export interface ContentSafetyResult {
  isSafe: boolean;
  flaggedTerms: string[];
  category?: 'profanity' | 'hate_speech' | 'violence' | 'sexual' | 'spam';
  confidence: number;
}

/**
 * Inappropriate content categories with keyword lists
 * Note: This is a basic implementation. For production, consider using
 * services like Perspective API, Azure Content Moderator, or AWS Comprehend
 */
const INAPPROPRIATE_KEYWORDS = {
  profanity: [
    // Basic profanity list (sanitized for code)
    'damn',
    'hell',
    'crap',
    // Add more as needed
  ],
  hate_speech: [
    // Hate speech indicators
    'hate',
    'racist',
    'bigot',
    // Add more as needed
  ],
  violence: [
    // Violence indicators
    'kill',
    'murder',
    'attack',
    'bomb',
    'weapon',
    // Add more as needed
  ],
  sexual: [
    // Sexual content indicators
    'porn',
    'xxx',
    'sex',
    // Add more as needed
  ],
  spam: [
    // Spam indicators
    'click here',
    'buy now',
    'limited time',
    'act now',
    'free money',
    // Add more as needed
  ],
};

/**
 * Check if content contains inappropriate keywords
 */
export function checkContentSafety(content: string): ContentSafetyResult {
  if (!content) {
    return {
      isSafe: true,
      flaggedTerms: [],
      confidence: 1.0,
    };
  }

  const lowerContent = content.toLowerCase();
  const flaggedTerms: string[] = [];
  let category: ContentSafetyResult['category'] | undefined;

  // Check each category
  for (const [cat, keywords] of Object.entries(INAPPROPRIATE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        flaggedTerms.push(keyword);
        if (!category) {
          category = cat as ContentSafetyResult['category'];
        }
      }
    }
  }

  const isSafe = flaggedTerms.length === 0;
  const confidence = isSafe ? 1.0 : Math.max(0.5, 1.0 - flaggedTerms.length * 0.1);

  return {
    isSafe,
    flaggedTerms,
    category,
    confidence,
  };
}

/**
 * Filter inappropriate content from text
 * Replaces flagged terms with asterisks
 */
export function filterInappropriateContent(content: string): string {
  if (!content) return '';

  let filtered = content;

  for (const keywords of Object.values(INAPPROPRIATE_KEYWORDS)) {
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      filtered = filtered.replace(regex, '*'.repeat(keyword.length));
    }
  }

  return filtered;
}

/**
 * Check if content is spam
 */
export function isSpam(content: string): boolean {
  if (!content) return false;

  const lowerContent = content.toLowerCase();

  // Check for spam keywords
  const spamKeywordCount = INAPPROPRIATE_KEYWORDS.spam.filter((keyword) =>
    lowerContent.includes(keyword.toLowerCase())
  ).length;

  // Check for excessive capitalization
  const upperCaseRatio = (content.match(/[A-Z]/g) || []).length / content.length;

  // Check for excessive punctuation
  const punctuationRatio = (content.match(/[!?]{2,}/g) || []).length / content.length;

  // Check for excessive URLs
  const urlCount = (content.match(/https?:\/\//g) || []).length;

  return spamKeywordCount >= 2 || upperCaseRatio > 0.5 || punctuationRatio > 0.1 || urlCount > 3;
}

/**
 * Check if content contains personal information (basic PII detection)
 */
export function containsPII(content: string): boolean {
  if (!content) return false;

  // Email pattern
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;

  // Phone pattern (US format)
  const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;

  // SSN pattern (US format)
  const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/;

  // Credit card pattern (basic)
  const creditCardPattern = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/;

  return (
    emailPattern.test(content) ||
    phonePattern.test(content) ||
    ssnPattern.test(content) ||
    creditCardPattern.test(content)
  );
}

/**
 * Redact PII from content
 */
export function redactPII(content: string): string {
  if (!content) return '';

  let redacted = content;

  // Redact emails
  redacted = redacted.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    '[EMAIL_REDACTED]'
  );

  // Redact phone numbers
  redacted = redacted.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]');

  // Redact SSN
  redacted = redacted.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]');

  // Redact credit cards
  redacted = redacted.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD_REDACTED]');

  return redacted;
}

/**
 * Get content safety policy message
 */
export function getContentPolicyMessage(category?: ContentSafetyResult['category']): string {
  const baseMessage =
    'Your message contains content that violates our content policy. Please rephrase and try again.';

  if (!category) return baseMessage;

  const categoryMessages: Record<string, string> = {
    profanity: 'Please avoid using profanity in your messages.',
    hate_speech: 'Hate speech is not allowed. Please be respectful.',
    violence: 'Content promoting violence is not allowed.',
    sexual: 'Sexual content is not appropriate for this service.',
    spam: 'Your message appears to be spam. Please send genuine queries only.',
  };

  return `${baseMessage} ${categoryMessages[category] || ''}`;
}

/**
 * Log flagged content for review (maintains user privacy)
 */
export interface FlaggedContentLog {
  timestamp: Date;
  userId: string; // Hashed or anonymized
  category?: string;
  flaggedTermsCount: number;
  contentLength: number;
  // Note: Do NOT log actual content to maintain privacy
}

export function createFlaggedContentLog(
  userId: string,
  result: ContentSafetyResult,
  contentLength: number
): FlaggedContentLog {
  return {
    timestamp: new Date(),
    userId: hashUserId(userId), // Hash for privacy
    category: result.category,
    flaggedTermsCount: result.flaggedTerms.length,
    contentLength,
  };
}

/**
 * Simple hash function for user ID (for privacy)
 */
function hashUserId(userId: string): string {
  // Simple hash - in production, use a proper hashing algorithm
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}
