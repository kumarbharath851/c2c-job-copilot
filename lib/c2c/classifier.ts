/**
 * C2C Classification Rules Engine
 *
 * Deterministic, pattern-based classifier.
 * Does NOT use AI — cheap, fast, auditable.
 *
 * Confidence score 0–100 based on weighted signal counts.
 */

import type { C2CStatus } from '@/lib/types/job';

export interface C2CClassificationResult {
  status: C2CStatus;
  confidence: number;       // 0–100
  signals: string[];        // text snippets that drove the result
  positiveCount: number;
  negativeCount: number;
}

// ── Signal patterns ────────────────────────────────────────────────────────

const POSITIVE_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /\bc2c\b/i,                                      weight: 40, label: 'Explicit "C2C"' },
  { pattern: /corp[\s-]?to[\s-]?corp/i,                       weight: 40, label: 'Corp-to-Corp mentioned' },
  { pattern: /corp2corp/i,                                     weight: 40, label: 'Corp2Corp mentioned' },
  { pattern: /\binc\b.*\bllc\b|\bllc\b.*\binc\b/i,            weight: 15, label: 'LLC/Inc entity structure mentioned' },
  { pattern: /independent\s+contractor/i,                      weight: 20, label: 'Independent contractor' },
  { pattern: /1099/i,                                          weight: 25, label: '1099 contractor' },
  { pattern: /own\s+(your\s+)?corp(oration)?/i,                weight: 20, label: 'Must own corporation' },
  { pattern: /through\s+(your\s+)?company/i,                   weight: 15, label: 'Work through your company' },
  { pattern: /vendor[\s-]?payroll/i,                           weight: 10, label: 'Vendor payroll' },
  { pattern: /contract.*rate.*\$\d+/i,                         weight: 10, label: 'Contract rate specified' },
  { pattern: /\$\d+[\s-]*(?:\/|\s+per\s+)hr/i,                weight: 8,  label: 'Hourly rate mentioned' },
  { pattern: /business\s+entity/i,                             weight: 15, label: 'Business entity required' },
  { pattern: /tax\s+(forms?|docs?)/i,                          weight: 8,  label: 'Tax documentation mentioned' },
  { pattern: /invoice/i,                                       weight: 5,  label: 'Invoicing mentioned' },
  { pattern: /we\s+work\s+with\s+(vendors?|agencies)/i,        weight: 15, label: 'Works with vendors/agencies' },
];

const NEGATIVE_PATTERNS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /w[\s-]?2\s+only/i,                              weight: 50, label: 'W2 only stated' },
  { pattern: /must\s+be\s+w[\s-]?2/i,                         weight: 50, label: 'Must be W2' },
  { pattern: /no\s+(?:third[\s-]?party|third\s+parties)/i,    weight: 40, label: 'No third parties' },
  { pattern: /no\s+(?:corp[\s-]?to[\s-]?corp|c2c)/i,          weight: 50, label: 'No C2C stated' },
  { pattern: /not?\s+(?:accept|work)\s+.*?c2c/i,              weight: 50, label: 'C2C not accepted' },
  { pattern: /w[\s-]?2\s+employee/i,                           weight: 30, label: 'W2 employee position' },
  { pattern: /benefits?\s+(?:include|package|provided)/i,      weight: 15, label: 'Benefits package mentioned' },
  { pattern: /(?:401k|pto|paid\s+time\s+off)\s+(?:provided|included|offered)/i,
                                                                weight: 20, label: 'FTE benefits included' },
  { pattern: /direct\s+hire/i,                                 weight: 20, label: 'Direct hire' },
  { pattern: /full[\s-]?time\s+(?:employee|position|role)/i,   weight: 15, label: 'Full-time employee role' },
  { pattern: /no\s+(?:vendors?|staffing|agencies)/i,            weight: 40, label: 'No vendors/agencies' },
];

// ── Classifier function ────────────────────────────────────────────────────

export function classifyC2C(text: string): C2CClassificationResult {
  let positiveScore = 0;
  let negativeScore = 0;
  const signals: string[] = [];

  for (const { pattern, weight, label } of POSITIVE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      positiveScore += weight;
      signals.push(`[+${weight}] ${label}: "${match[0].trim()}"`);
    }
  }

  for (const { pattern, weight, label } of NEGATIVE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      negativeScore += weight;
      signals.push(`[-${weight}] ${label}: "${match[0].trim()}"`);
    }
  }

  // Determine status and confidence
  const netScore = positiveScore - negativeScore;
  let status: C2CStatus;
  let confidence: number;

  if (negativeScore >= 50) {
    status = 'w2only';
    confidence = Math.min(95, 50 + negativeScore);
  } else if (positiveScore >= 40 && negativeScore < 20) {
    status = 'confirmed';
    confidence = Math.min(95, 40 + positiveScore);
  } else if (positiveScore >= 15 && negativeScore < 30) {
    status = 'likely';
    confidence = Math.min(80, 30 + positiveScore);
  } else if (netScore < -10) {
    status = 'w2only';
    confidence = Math.min(85, 40 + negativeScore);
  } else {
    status = 'unclear';
    confidence = Math.max(10, 50 - Math.abs(netScore));
  }

  return {
    status,
    confidence,
    signals,
    positiveCount: positiveScore,
    negativeCount: negativeScore,
  };
}
