/**
 * ATS (Applicant Tracking System) Scoring Engine
 *
 * Deterministic scoring — no AI cost.
 * Runs on the tailored resume text against the job description.
 *
 * Score breakdown (total 100 pts):
 *   Keyword match rate      — 40 pts  (required skills found in resume)
 *   Preferred skill match   — 20 pts  (preferred skills found)
 *   Section structure       — 15 pts  (named sections present)
 *   Contact completeness    — 10 pts  (name, email, phone, LinkedIn)
 *   Quantified achievements — 10 pts  (numbers/metrics in bullets)
 *   Format signals          — 5 pts   (dates, bullet consistency)
 */

import type { ParsedResume } from '@/lib/types/resume';
import type { Job } from '@/lib/types/job';

export type ATSGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface ATSScoreBreakdown {
  keywordMatch:            number;   // 0–40
  preferredMatch:          number;   // 0–20
  sectionStructure:        number;   // 0–15
  contactCompleteness:     number;   // 0–10
  quantifiedAchievements:  number;   // 0–10
  formatSignals:           number;   // 0–5
}

export interface ATSSuggestion {
  category: 'keyword' | 'structure' | 'contact' | 'metrics' | 'format' | 'preferred';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
}

export interface ATSScore {
  overall: number;            // 0–100
  grade: ATSGrade;
  breakdown: ATSScoreBreakdown;
  keywordsFound: string[];
  keywordsMissing: string[];
  preferredFound: string[];
  preferredMissing: string[];
  suggestions: ATSSuggestion[];
  passLikelihood: 'High' | 'Medium' | 'Low';
  scoredAt: string;
  resumeVersion: 'original' | 'tailored';
}

// ── Scoring functions ──────────────────────────────────────────────────────

function scoreKeywords(resumeText: string, job: Job): {
  score: number;
  found: string[];
  missing: string[];
} {
  const text = resumeText.toLowerCase();
  const found: string[] = [];
  const missing: string[] = [];

  for (const skill of job.requiredSkills) {
    const aliases = [
      skill.name.toLowerCase(),
      skill.name.toLowerCase().replace(/\s+/g, ''),   // "apache spark" → "apachespark"
      skill.name.toLowerCase().replace(/apache\s+/i, ''), // "apache spark" → "spark"
    ];
    if (aliases.some(a => text.includes(a))) {
      found.push(skill.name);
    } else {
      missing.push(skill.name);
    }
  }

  const total = job.requiredSkills.length;
  const score = total > 0 ? Math.round((found.length / total) * 40) : 40;
  return { score, found, missing };
}

function scorePreferred(resumeText: string, job: Job): {
  score: number;
  found: string[];
  missing: string[];
} {
  const text = resumeText.toLowerCase();
  const found: string[] = [];
  const missing: string[] = [];

  for (const skill of job.preferredSkills) {
    if (text.includes(skill.name.toLowerCase())) {
      found.push(skill.name);
    } else {
      missing.push(skill.name);
    }
  }

  const total = job.preferredSkills.length;
  const score = total > 0 ? Math.round((found.length / total) * 20) : 20;
  return { score, found, missing };
}

function scoreSectionStructure(resume: ParsedResume): { score: number; suggestions: ATSSuggestion[] } {
  let score = 0;
  const suggestions: ATSSuggestion[] = [];

  if (resume.summary && resume.summary.length > 30) {
    score += 3;
  } else {
    suggestions.push({
      category: 'structure',
      severity: 'high',
      message: 'Missing professional summary. ATS systems expect a summary/objective section at the top.',
    });
  }

  if (resume.skills.length >= 5) {
    score += 4;
  } else {
    suggestions.push({
      category: 'structure',
      severity: 'critical',
      message: `Only ${resume.skills.length} skills detected. ATS systems look for a dedicated skills section with 8+ technologies.`,
    });
  }

  if (resume.experience.length >= 1) {
    score += 4;
    // Check for bullet points in experience
    const totalBullets = resume.experience.reduce((s, e) => s + e.bullets.length, 0);
    if (totalBullets >= resume.experience.length * 2) {
      score += 2;
    } else {
      suggestions.push({
        category: 'structure',
        severity: 'medium',
        message: 'Experience bullets are thin. ATS parsers prefer 3–5 bullets per role.',
      });
    }
  } else {
    suggestions.push({
      category: 'structure',
      severity: 'critical',
      message: 'No structured experience entries detected. Ensure your resume has a clear Experience section.',
    });
  }

  if (resume.education.length >= 1) {
    score += 2;
  } else {
    suggestions.push({
      category: 'structure',
      severity: 'low',
      message: 'No education section detected.',
    });
  }

  return { score: Math.min(15, score), suggestions };
}

function scoreContact(resume: ParsedResume): { score: number; suggestions: ATSSuggestion[] } {
  let score = 0;
  const suggestions: ATSSuggestion[] = [];

  if (resume.contact.name && resume.contact.name !== 'Unknown') score += 2;

  if (resume.contact.email) {
    score += 3;
  } else {
    suggestions.push({
      category: 'contact',
      severity: 'critical',
      message: 'Email not detected. ATS systems require a valid email address.',
    });
  }

  if (resume.contact.phone) {
    score += 2;
  } else {
    suggestions.push({
      category: 'contact',
      severity: 'high',
      message: 'Phone number not detected. Most ATS systems require a US phone number.',
    });
  }

  if (resume.contact.linkedin) {
    score += 3;
  } else {
    suggestions.push({
      category: 'contact',
      severity: 'medium',
      message: 'LinkedIn URL missing. Recruiters and ATS systems often check this field.',
    });
  }

  return { score: Math.min(10, score), suggestions };
}

function scoreQuantifiedAchievements(resume: ParsedResume): { score: number; suggestions: ATSSuggestion[] } {
  const suggestions: ATSSuggestion[] = [];
  const allBullets = resume.experience.flatMap(e => e.bullets.map(b => b.text));

  if (allBullets.length === 0) return { score: 0, suggestions };

  const numbersRegex = /\d+%|\$\d+[KMB]?|\d+\+?\s*(TB|GB|PB|records|jobs|pipelines|users|requests|seconds|hours)/i;
  const quantified = allBullets.filter(b => numbersRegex.test(b));
  const ratio = quantified.length / allBullets.length;

  let score: number;
  if (ratio >= 0.5) {
    score = 10;
  } else if (ratio >= 0.3) {
    score = 7;
    suggestions.push({
      category: 'metrics',
      severity: 'medium',
      message: `${Math.round(ratio * 100)}% of bullets have metrics. Target 50%+ with numbers (throughput, cost savings, scale).`,
    });
  } else if (ratio >= 0.1) {
    score = 4;
    suggestions.push({
      category: 'metrics',
      severity: 'high',
      message: 'Very few quantified achievements detected. Add metrics like "processed 5TB daily", "reduced latency by 40%", or "$2M cost savings".',
    });
  } else {
    score = 0;
    suggestions.push({
      category: 'metrics',
      severity: 'critical',
      message: 'No quantified achievements found. ATS systems and recruiters strongly prefer metrics-backed bullet points.',
    });
  }

  return { score, suggestions };
}

function scoreFormat(resume: ParsedResume, rawText: string): { score: number; suggestions: ATSSuggestion[] } {
  let score = 0;
  const suggestions: ATSSuggestion[] = [];

  // Check for consistent date formats (YYYY or MM/YYYY)
  const datePatterns = rawText.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4}\s*[-–]\s*\d{4}/gi);
  if (datePatterns && datePatterns.length > 0) {
    score += 3;
  } else {
    suggestions.push({
      category: 'format',
      severity: 'medium',
      message: 'No parseable date formats found in experience. Use "MM/YYYY – MM/YYYY" or "Jan 2021 – Present" format.',
    });
  }

  // No tables / special characters (proxy: raw text should be reasonably clean)
  const specialCharRatio = (rawText.match(/[|│┃▶►◆●•·]/g) || []).length / (rawText.length || 1);
  if (specialCharRatio < 0.01) {
    score += 2;
  } else {
    suggestions.push({
      category: 'format',
      severity: 'high',
      message: 'Special formatting characters detected. Tables and icons often break ATS parsers — use plain bullet points.',
    });
  }

  return { score: Math.min(5, score), suggestions };
}

// ── Grade calculator ───────────────────────────────────────────────────────

function calcGrade(score: number): ATSGrade {
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

function calcPassLikelihood(score: number): ATSScore['passLikelihood'] {
  if (score >= 75) return 'High';
  if (score >= 55) return 'Medium';
  return 'Low';
}

// ── Main ATS scorer ────────────────────────────────────────────────────────

export function computeATSScore(
  resume: ParsedResume,
  rawText: string,
  job: Job,
  version: 'original' | 'tailored' = 'original'
): ATSScore {
  const keywords   = scoreKeywords(rawText, job);
  const preferred  = scorePreferred(rawText, job);
  const structure  = scoreSectionStructure(resume);
  const contact    = scoreContact(resume);
  const metrics    = scoreQuantifiedAchievements(resume);
  const format     = scoreFormat(resume, rawText);

  const overall = Math.min(100,
    keywords.score + preferred.score + structure.score + contact.score + metrics.score + format.score
  );

  const allSuggestions: ATSSuggestion[] = [
    ...structure.suggestions,
    ...contact.suggestions,
    ...metrics.suggestions,
    ...format.suggestions,
  ];

  // Add keyword gap suggestion if missing many requirements
  if (keywords.missing.length > 0) {
    allSuggestions.unshift({
      category: 'keyword',
      severity: keywords.missing.length >= 3 ? 'critical' : 'high',
      message: `Missing required keywords: ${keywords.missing.slice(0, 5).join(', ')}${keywords.missing.length > 5 ? ` +${keywords.missing.length - 5} more` : ''}. These exact terms must appear in your resume to pass ATS filters.`,
    });
  }

  if (preferred.missing.length > 2) {
    allSuggestions.push({
      category: 'preferred',
      severity: 'low',
      message: `${preferred.missing.length} preferred skills not found: ${preferred.missing.slice(0, 3).join(', ')}. Adding truthful experience with these tools could improve ranking.`,
    });
  }

  // Sort by severity
  const order: Record<ATSSuggestion['severity'], number> = { critical: 0, high: 1, medium: 2, low: 3 };
  allSuggestions.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    overall,
    grade: calcGrade(overall),
    breakdown: {
      keywordMatch:           keywords.score,
      preferredMatch:         preferred.score,
      sectionStructure:       structure.score,
      contactCompleteness:    contact.score,
      quantifiedAchievements: metrics.score,
      formatSignals:          format.score,
    },
    keywordsFound:    keywords.found,
    keywordsMissing:  keywords.missing,
    preferredFound:   preferred.found,
    preferredMissing: preferred.missing,
    suggestions:      allSuggestions.slice(0, 8),   // cap at 8 actionable items
    passLikelihood:   calcPassLikelihood(overall),
    scoredAt:         new Date().toISOString(),
    resumeVersion:    version,
  };
}
