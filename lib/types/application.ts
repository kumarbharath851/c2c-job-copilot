// ── Application tracker types ───────────────────────────────────────────────

export type ApplicationStatus =
  | 'Saved'
  | 'Reviewing'
  | 'Tailored'
  | 'Applied'
  | 'Interview'
  | 'Rejected'
  | 'Offer';

export interface ApplicationNote {
  noteId: string;
  text: string;
  createdAt: string;
}

export interface Application {
  applicationId: string;
  userId: string;
  jobId: string;
  resumeId?: string;
  tailoredResumeId?: string;
  status: ApplicationStatus;
  appliedAt?: string;
  notes: ApplicationNote[];
  recruiterContactId?: string;
  outreachMessageId?: string;
  followUpAt?: string;
  salary?: string;
  interviewDates?: string[];
  offerAmount?: number;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Alert/saved search ──────────────────────────────────────────────────────

export interface JobAlert {
  alertId: string;
  userId: string;
  name: string;
  keyword?: string;
  c2cFilter?: 'confirmed' | 'likely' | 'confirmed_or_likely' | 'any';
  workMode?: 'remote' | 'hybrid' | 'onsite' | 'any';
  skills?: string[];
  minRate?: number;
  emailDigest: boolean;
  digestFrequency: 'daily' | 'weekly';
  isActive: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
}

// ── User profile ────────────────────────────────────────────────────────────

export interface UserProfile {
  userId: string;
  email: string;
  name?: string;
  targetTitle: string;
  targetC2CRate?: number;
  targetWorkMode?: WorkMode[];
  targetSkills?: string[];
  llcName?: string;
  visaStatus?: string;
  createdAt: string;
  updatedAt: string;
}

import type { WorkMode } from './job';
