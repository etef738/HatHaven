/**
 * PII Redaction Utility for Voice Chat Transcripts
 * Removes or masks personally identifiable information from text
 */

// Enhanced PII patterns with improved accuracy
const PII_PATTERNS = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // Phone numbers (various formats)
  phone: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
  
  // Social Security Numbers
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  
  // Credit card numbers (basic pattern)
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  
  // Addresses (basic street address pattern)
  address: /\b\d+\s+([A-Za-z]+\s*)+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl)\b/gi,
  
  // Names (enhanced patterns with more identifiers)
  names: /\b(?:my name is|i'm|i am|call me|name's|this is|hi i'm|hello i'm|i go by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
  
  // Birth dates (various formats)
  birthDate: /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/g,
  
  // Bank account numbers (8-17 digits)
  bankAccount: /\b\d{8,17}\b/g,
};

export interface RedactionResult {
  redactedText: string;
  redactionCount: number;
  detectedPiiTypes: string[];
}

/**
 * Redacts PII from text and returns redacted version with metadata
 */
export function redactPII(text: string): RedactionResult {
  if (!text || typeof text !== 'string') {
    return {
      redactedText: text || '',
      redactionCount: 0,
      detectedPiiTypes: []
    };
  }

  let redactedText = text;
  let redactionCount = 0;
  const detectedPiiTypes: string[] = [];

  // Apply each redaction pattern
  Object.entries(PII_PATTERNS).forEach(([piiType, pattern]) => {
    const matches = redactedText.match(pattern);
    if (matches && matches.length > 0) {
      detectedPiiTypes.push(piiType);
      redactionCount += matches.length;
      
      // Replace with appropriate placeholder
      const placeholder = getPlaceholder(piiType);
      redactedText = redactedText.replace(pattern, placeholder);
    }
  });

  return {
    redactedText,
    redactionCount,
    detectedPiiTypes
  };
}

/**
 * Get appropriate placeholder for different PII types
 */
function getPlaceholder(piiType: string): string {
  const placeholders: Record<string, string> = {
    email: '[EMAIL_REDACTED]',
    phone: '[PHONE_REDACTED]',
    ssn: '[SSN_REDACTED]',
    creditCard: '[CARD_REDACTED]',
    address: '[ADDRESS_REDACTED]',
    names: '[NAME_REDACTED]',
    birthDate: '[BIRTHDATE_REDACTED]',
    bankAccount: '[ACCOUNT_REDACTED]'
  };
  
  return placeholders[piiType] || '[PII_REDACTED]';
}

/**
 * Additional security function to redact common sensitive terms
 */
export function redactSensitiveTerms(text: string): string {
  const sensitiveTerms = [
    /\bpassword\b/gi,
    /\bpin\b/gi,
    /\btoken\b/gi,
    /\bapi[_\s]*key\b/gi,
    /\bsecret\b/gi,
    /\bcredit\s+card\b/gi,
    /\bbank\s+account\b/gi,
    /\bdebit\s+card\b/gi,
  ];

  let result = text;
  sensitiveTerms.forEach(pattern => {
    result = result.replace(pattern, '[SENSITIVE_REDACTED]');
  });

  return result;
}

/**
 * Full PII redaction that combines both pattern-based and term-based redaction
 */
export function fullPiiRedaction(text: string): RedactionResult {
  // First apply pattern-based redaction
  const piiResult = redactPII(text);
  
  // Then apply sensitive term redaction
  const finalText = redactSensitiveTerms(piiResult.redactedText);
  
  return {
    redactedText: finalText,
    redactionCount: piiResult.redactionCount,
    detectedPiiTypes: piiResult.detectedPiiTypes
  };
}

// Non-global patterns for testing (to avoid lastIndex issues)
const PII_TEST_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  phone: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/,
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/,
  creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/,
  address: /\b\d+\s+([A-Za-z]+\s*)+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl)\b/i,
  names: /\b(?:my name is|i'm|i am|call me|name's|this is|hi i'm|hello i'm|i go by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
  birthDate: /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/,
  bankAccount: /\b\d{8,17}\b/,
};

/**
 * Check if text contains potential PII without redacting
 */
export function containsPII(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  return Object.values(PII_TEST_PATTERNS).some(pattern => pattern.test(text));
}

// =============================================================================
// ML-ENHANCED PII DETECTION STUBS
// =============================================================================

export interface MLRedactionResult extends RedactionResult {
  confidence: number;
  mlDetectedTypes: string[];
  positionData: Array<{
    type: string;
    start: number;
    end: number;
    confidence: number;
    maskedPreview: string; // Safe masked preview instead of originalText
    replacement: string;
  }>;
}

/**
 * Create safe masked preview of detected PII without exposing original text
 */
function createMaskedPreview(text: string, type: string): string {
  // Create a safe preview that doesn't expose PII
  const length = text.length;
  const typePrefix = type.toUpperCase().split('_')[0];
  return `[${typePrefix}_${length}chars]`;
}

/**
 * Common stoplist to prevent false positives in name detection
 */
const NAME_STOPLIST = new Set([
  // Geographic locations
  'New York', 'Los Angeles', 'San Francisco', 'Las Vegas', 'New Orleans',
  'South Park', 'North Carolina', 'West Virginia', 'East Coast',
  // Companies and brands
  'Customer Support', 'Customer Service', 'Tech Support', 'Sales Team',
  'Microsoft Office', 'Google Drive', 'Apple Store', 'Amazon Prime',
  // Common phrases
  'Thank You', 'Good Morning', 'Good Evening', 'Best Regards',
  'Dear Sir', 'Dear Madam', 'To Whom', 'Kind Regards',
  // Days and months
  'Monday Morning', 'Friday Night', 'Sunday School', 'Christmas Day',
  // Generic titles
  'Vice President', 'General Manager', 'Project Manager', 'Team Lead'
]);

/**
 * Check if detected text is likely a false positive
 */
function isLikelyFalsePositive(text: string, type: string): boolean {
  if (type === 'name_ml') {
    // Check against stoplist
    if (NAME_STOPLIST.has(text)) return true;
    
    // Additional heuristics for names
    const words = text.split(/\s+/);
    
    // Skip single words that are likely not names
    if (words.length === 1 && text.length < 3) return true;
    
    // Skip if contains numbers (likely not a person's name)
    if (/\d/.test(text)) return true;
    
    // Skip common non-name patterns
    if (/^(Mr|Ms|Mrs|Dr|Prof)\s/.test(text)) return true;
  }
  
  return false;
}

/**
 * Stub: ML-enhanced name detection using NER (Named Entity Recognition)
 * Future: Integrate with spaCy, transformers, or custom NER models
 */
export function detectNamesML(text: string): MLRedactionResult {
  // Check if name detection is enabled
  if (!ML_PII_CONFIG.enabledDetectors.names) {
    return {
      redactedText: text,
      redactionCount: 0,
      detectedPiiTypes: [],
      confidence: 1.0,
      mlDetectedTypes: [],
      positionData: []
    };
  }

  // STUB: Advanced name detection that catches names not preceded by identifiers
  const advancedNamePatterns = [
    // Capitalized words that follow name patterns
    /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/g, // John Smith
    /\b[A-Z][a-z]+\s+[A-Z]\.[A-Z][a-z]+\b/g, // John A. Smith
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g, // John Michael Smith
  ];
  
  let redactedText = text;
  let detectionCount = 0;
  const positionData: MLRedactionResult['positionData'] = [];
  const threshold = ML_PII_CONFIG.confidenceThresholds.name_ml;
  
  advancedNamePatterns.forEach((pattern, patternIndex) => {
    const matches = Array.from(text.matchAll(pattern));
    matches.forEach(match => {
      if (match.index !== undefined) {
        const matchedText = match[0];
        
        // Skip false positives
        if (isLikelyFalsePositive(matchedText, 'name_ml')) {
          return;
        }
        
        // Simple heuristic: higher confidence for longer names
        const confidence = Math.min(0.95, 0.6 + (matchedText.split(' ').length * 0.15));
        
        // Apply confidence threshold
        if (confidence < threshold) {
          return;
        }
        
        positionData.push({
          type: 'name_ml',
          start: match.index,
          end: match.index + matchedText.length,
          confidence,
          maskedPreview: createMaskedPreview(matchedText, 'name_ml'),
          replacement: '[NAME_ML_REDACTED]'
        });
        
        detectionCount++;
        redactedText = redactedText.replace(matchedText, '[NAME_ML_REDACTED]');
      }
    });
  });
  
  return {
    redactedText,
    redactionCount: detectionCount,
    detectedPiiTypes: detectionCount > 0 ? ['name_ml'] : [],
    confidence: detectionCount > 0 ? 0.75 : 1.0,
    mlDetectedTypes: detectionCount > 0 ? ['name_ml'] : [],
    positionData
  };
}

/**
 * Stub: ML-enhanced address detection using geocoding patterns
 * Future: Integrate with geocoding APIs or address validation services
 */
export function detectAddressesML(text: string): MLRedactionResult {
  // Check if address detection is enabled
  if (!ML_PII_CONFIG.enabledDetectors.addresses) {
    return {
      redactedText: text,
      redactionCount: 0,
      detectedPiiTypes: [],
      confidence: 1.0,
      mlDetectedTypes: [],
      positionData: []
    };
  }

  // STUB: More sophisticated address patterns
  const advancedAddressPatterns = [
    // Full addresses with city, state, zip
    /\b\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl),?\s*[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?\b/gi,
    // Apartment/unit numbers
    /\b\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl)\s*(?:Apt|Unit|#)\s*[A-Za-z0-9]+/gi,
    // PO Box addresses
    /\bP\.?O\.?\s*Box\s+\d+/gi
  ];
  
  let redactedText = text;
  let detectionCount = 0;
  const positionData: MLRedactionResult['positionData'] = [];
  const threshold = ML_PII_CONFIG.confidenceThresholds.address_ml;
  
  advancedAddressPatterns.forEach(pattern => {
    const matches = Array.from(text.matchAll(pattern));
    matches.forEach(match => {
      if (match.index !== undefined) {
        const matchedText = match[0];
        const confidence = 0.85; // High confidence for structured addresses
        
        // Apply confidence threshold
        if (confidence < threshold) {
          return;
        }
        
        positionData.push({
          type: 'address_ml',
          start: match.index,
          end: match.index + matchedText.length,
          confidence,
          maskedPreview: createMaskedPreview(matchedText, 'address_ml'),
          replacement: '[ADDRESS_ML_REDACTED]'
        });
        
        detectionCount++;
        redactedText = redactedText.replace(matchedText, '[ADDRESS_ML_REDACTED]');
      }
    });
  });
  
  return {
    redactedText,
    redactionCount: detectionCount,
    detectedPiiTypes: detectionCount > 0 ? ['address_ml'] : [],
    confidence: detectionCount > 0 ? 0.85 : 1.0,
    mlDetectedTypes: detectionCount > 0 ? ['address_ml'] : [],
    positionData
  };
}

/**
 * Stub: ML-enhanced phone number detection with international formats
 * Future: Integrate with libphonenumber or similar validation libraries
 */
export function detectPhonesML(text: string): MLRedactionResult {
  // Check if phone detection is enabled
  if (!ML_PII_CONFIG.enabledDetectors.phones) {
    return {
      redactedText: text,
      redactionCount: 0,
      detectedPiiTypes: [],
      confidence: 1.0,
      mlDetectedTypes: [],
      positionData: []
    };
  }

  // STUB: International phone number patterns
  const internationalPhonePatterns = [
    // International format with country codes
    /\+\d{1,3}[-\s]?\(?\d{1,4}\)?[-\s]?\d{1,4}[-\s]?\d{1,9}/g,
    // European formats
    /\b0\d{1,4}[-\s]?\d{2,4}[-\s]?\d{2,4}[-\s]?\d{2,4}\b/g,
    // Various bracketed formats
    /\([0-9]{3}\)\s*[0-9]{3}[-\s]?[0-9]{4}/g
  ];
  
  let redactedText = text;
  let detectionCount = 0;
  const positionData: MLRedactionResult['positionData'] = [];
  const threshold = ML_PII_CONFIG.confidenceThresholds.phone_ml;
  
  internationalPhonePatterns.forEach(pattern => {
    const matches = Array.from(text.matchAll(pattern));
    matches.forEach(match => {
      if (match.index !== undefined) {
        const matchedText = match[0];
        // Higher confidence for international format
        const confidence = matchedText.startsWith('+') ? 0.9 : 0.75;
        
        // Apply confidence threshold
        if (confidence < threshold) {
          return;
        }
        
        positionData.push({
          type: 'phone_ml',
          start: match.index,
          end: match.index + matchedText.length,
          confidence,
          maskedPreview: createMaskedPreview(matchedText, 'phone_ml'),
          replacement: '[PHONE_ML_REDACTED]'
        });
        
        detectionCount++;
        redactedText = redactedText.replace(matchedText, '[PHONE_ML_REDACTED]');
      }
    });
  });
  
  return {
    redactedText,
    redactionCount: detectionCount,
    detectedPiiTypes: detectionCount > 0 ? ['phone_ml'] : [],
    confidence: detectionCount > 0 ? 0.8 : 1.0,
    mlDetectedTypes: detectionCount > 0 ? ['phone_ml'] : [],
    positionData
  };
}

/**
 * Stub: ML-enhanced email detection with domain validation
 * Future: Integrate with email validation APIs
 */
export function detectEmailsML(text: string): MLRedactionResult {
  // Check if email detection is enabled
  if (!ML_PII_CONFIG.enabledDetectors.emails) {
    return {
      redactedText: text,
      redactionCount: 0,
      detectedPiiTypes: [],
      confidence: 1.0,
      mlDetectedTypes: [],
      positionData: []
    };
  }

  // STUB: More sophisticated email patterns with domain validation
  const advancedEmailPatterns = [
    // Standard emails with common TLDs
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.(?:com|org|net|edu|gov|mil|co|io|ai|ly|me|us|uk|de|fr|jp|cn|ru|br|in|au|ca)\b/gi,
    // Catch potential emails even with unusual domains
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi
  ];
  
  let redactedText = text;
  let detectionCount = 0;
  const positionData: MLRedactionResult['positionData'] = [];
  const threshold = ML_PII_CONFIG.confidenceThresholds.email_ml;
  
  advancedEmailPatterns.forEach((pattern, index) => {
    const matches = Array.from(text.matchAll(pattern));
    matches.forEach(match => {
      if (match.index !== undefined) {
        const matchedText = match[0];
        // Higher confidence for common TLDs
        const confidence = index === 0 ? 0.95 : 0.8;
        
        // Apply confidence threshold
        if (confidence < threshold) {
          return;
        }
        
        positionData.push({
          type: 'email_ml',
          start: match.index,
          end: match.index + matchedText.length,
          confidence,
          maskedPreview: createMaskedPreview(matchedText, 'email_ml'),
          replacement: '[EMAIL_ML_REDACTED]'
        });
        
        detectionCount++;
        redactedText = redactedText.replace(matchedText, '[EMAIL_ML_REDACTED]');
      }
    });
  });
  
  return {
    redactedText,
    redactionCount: detectionCount,
    detectedPiiTypes: detectionCount > 0 ? ['email_ml'] : [],
    confidence: detectionCount > 0 ? 0.9 : 1.0,
    mlDetectedTypes: detectionCount > 0 ? ['email_ml'] : [],
    positionData
  };
}

/**
 * Combined ML-enhanced PII redaction using all ML detection methods
 */
export function mlEnhancedPiiRedaction(text: string): MLRedactionResult {
  if (!text || typeof text !== 'string') {
    return {
      redactedText: text || '',
      redactionCount: 0,
      detectedPiiTypes: [],
      confidence: 1.0,
      mlDetectedTypes: [],
      positionData: []
    };
  }
  
  // Apply all ML detection methods sequentially
  const nameResult = detectNamesML(text);
  const addressResult = detectAddressesML(nameResult.redactedText);
  const phoneResult = detectPhonesML(addressResult.redactedText);
  const emailResult = detectEmailsML(phoneResult.redactedText);
  
  // Combine results
  const allPositionData = [
    ...nameResult.positionData,
    ...addressResult.positionData,
    ...phoneResult.positionData,
    ...emailResult.positionData
  ];
  
  const allDetectedTypes = [
    ...nameResult.detectedPiiTypes,
    ...addressResult.detectedPiiTypes,
    ...phoneResult.detectedPiiTypes,
    ...emailResult.detectedPiiTypes
  ];
  
  const allMlTypes = [
    ...nameResult.mlDetectedTypes,
    ...addressResult.mlDetectedTypes,
    ...phoneResult.mlDetectedTypes,
    ...emailResult.mlDetectedTypes
  ];
  
  const totalRedactions = nameResult.redactionCount + addressResult.redactionCount + 
                         phoneResult.redactionCount + emailResult.redactionCount;
  
  // Calculate overall confidence as weighted average
  const confidences = [nameResult, addressResult, phoneResult, emailResult]
    .filter(result => result.redactionCount > 0)
    .map(result => result.confidence);
  
  const overallConfidence = confidences.length > 0 
    ? confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length
    : 1.0;
  
  return {
    redactedText: emailResult.redactedText,
    redactionCount: totalRedactions,
    detectedPiiTypes: Array.from(new Set(allDetectedTypes)), // Remove duplicates
    confidence: overallConfidence,
    mlDetectedTypes: Array.from(new Set(allMlTypes)),
    positionData: allPositionData
  };
}

/**
 * Production-ready PII redaction combining regex patterns and ML detection
 */
export function fullPiiRedactionWithML(text: string): MLRedactionResult {
  // First apply traditional regex-based redaction
  const traditionalResult = fullPiiRedaction(text);
  
  // Then apply ML-enhanced detection on the pre-redacted text
  const mlResult = mlEnhancedPiiRedaction(traditionalResult.redactedText);
  
  // Combine traditional sensitive term redaction
  const finalText = redactSensitiveTerms(mlResult.redactedText);
  
  return {
    redactedText: finalText,
    redactionCount: traditionalResult.redactionCount + mlResult.redactionCount,
    detectedPiiTypes: Array.from(new Set([...traditionalResult.detectedPiiTypes, ...mlResult.detectedPiiTypes])),
    confidence: mlResult.confidence,
    mlDetectedTypes: mlResult.mlDetectedTypes,
    positionData: mlResult.positionData
  };
}

/**
 * Stub: Future integration point for external ML services
 * Future: Connect to Azure Cognitive Services, AWS Comprehend, or Google DLP API
 */
export async function detectPiiWithExternalML(text: string): Promise<MLRedactionResult> {
  // Check if external ML is enabled
  if (!ML_PII_CONFIG.enabledDetectors.externalML) {
    // Fall back to local ML detection
    return mlEnhancedPiiRedaction(text);
  }

  // STUB: This would integrate with external ML services
  // For now, return the enhanced local ML detection
  
  // TODO: Integrate with:
  // - Azure Cognitive Services Text Analytics PII Detection
  // - AWS Comprehend PII Detection
  // - Google Cloud Data Loss Prevention API
  // - Custom trained models for dating/relationship context
  
  console.log('[STUB] External ML PII detection not yet implemented - using local ML detection');
  return mlEnhancedPiiRedaction(text);
}

/**
 * Configuration for ML-based PII detection thresholds
 */
export const ML_PII_CONFIG = {
  // Confidence thresholds for different PII types
  confidenceThresholds: {
    name_ml: 0.7,
    email_ml: 0.8,
    phone_ml: 0.75,
    address_ml: 0.8
  },
  
  // Enable/disable specific ML detection methods
  enabledDetectors: {
    names: true,
    emails: true,
    phones: true,
    addresses: true,
    externalML: false // Enable when external services are configured
  },
  
  // Logging configuration for ML detection events
  logging: {
    logDetections: true,
    logConfidenceScores: true,
    logPositionData: false // Disable in production to avoid logging positions
  }
} as const;