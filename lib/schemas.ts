import { z } from 'zod';

// ── Job schemas ─────────────────────────────────────────────────────────────

export const IngestJobSchema = z.object({
  url: z.string().url().optional(),
  rawText: z.string().min(50).optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
}).refine(d => d.url || d.rawText, {
  message: 'Either url or rawText is required',
});

export const JobFiltersSchema = z.object({
  c2c: z.enum(['confirmed', 'likely', 'unclear', 'w2only', 'any']).optional().default('any'),
  workMode: z.enum(['remote', 'hybrid', 'onsite', 'any']).optional().default('any'),
  skills: z.string().optional(),      // comma-separated
  minRate: z.coerce.number().optional(),
  maxRate: z.coerce.number().optional(),
  keyword: z.string().optional(),
  status: z.string().optional(),
  sort: z.enum(['matchScore', 'datePosted', 'rate', 'ingestedAt']).optional().default('ingestedAt'),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});

export const ScoreJobSchema = z.object({
  resumeId: z.string().min(1),
});

// ── Resume schemas ──────────────────────────────────────────────────────────

export const TailorResumeSchema = z.object({
  jobId: z.string().min(1),
  options: z.object({
    rewriteSummary: z.boolean().default(true),
    reorderSkills: z.boolean().default(true),
    improveExperienceBullets: z.boolean().default(true),
    section: z.enum(['summary', 'skills', 'experience', 'all']).default('all'),
  }).optional().default({}),
});

export const AcceptDiffSchema = z.object({
  sectionName: z.string(),
  accepted: z.boolean(),
});

// ── Application schemas ─────────────────────────────────────────────────────

export const CreateApplicationSchema = z.object({
  jobId: z.string().min(1),
  resumeId: z.string().optional(),
  tailoredResumeId: z.string().optional(),
  status: z.enum(['Saved', 'Reviewing', 'Tailored', 'Applied', 'Interview', 'Rejected', 'Offer']).default('Saved'),
  notes: z.string().optional(),
  recruiterContactId: z.string().optional(),
});

export const UpdateApplicationSchema = z.object({
  status: z.enum(['Saved', 'Reviewing', 'Tailored', 'Applied', 'Interview', 'Rejected', 'Offer']).optional(),
  notes: z.string().optional(),
  appliedAt: z.string().optional(),
  followUpAt: z.string().optional(),
  salary: z.string().optional(),
  offerAmount: z.coerce.number().optional(),
  rejectionReason: z.string().optional(),
});

// ── Alert schemas ───────────────────────────────────────────────────────────

export const CreateAlertSchema = z.object({
  name: z.string().min(1).max(100),
  keyword: z.string().optional(),
  c2cFilter: z.enum(['confirmed', 'likely', 'confirmed_or_likely', 'any']).optional().default('any'),
  workMode: z.enum(['remote', 'hybrid', 'onsite', 'any']).optional().default('any'),
  skills: z.array(z.string()).optional(),
  minRate: z.coerce.number().optional(),
  emailDigest: z.boolean().default(false),
  digestFrequency: z.enum(['daily', 'weekly']).default('daily'),
});

// ── Outreach schemas ────────────────────────────────────────────────────────

export const OutreachSchema = z.object({
  jobId: z.string().min(1),
  resumeId: z.string().min(1),
  recruiterName: z.string().optional(),
});

export type IngestJobInput = z.infer<typeof IngestJobSchema>;
export type JobFiltersInput = z.infer<typeof JobFiltersSchema>;
export type TailorResumeInput = z.infer<typeof TailorResumeSchema>;
export type CreateApplicationInput = z.infer<typeof CreateApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof UpdateApplicationSchema>;
export type CreateAlertInput = z.infer<typeof CreateAlertSchema>;
export type OutreachInput = z.infer<typeof OutreachSchema>;
