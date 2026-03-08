// ── C2C Status types ───────────────────────────────────────────────────────

export type C2CStatus = 'confirmed' | 'likely' | 'unclear' | 'w2only' | 'unknown';
export type EmploymentType = 'contract' | 'contract_to_hire' | 'fulltime' | 'parttime' | 'internship';
export type WorkMode = 'remote' | 'hybrid' | 'onsite';
export type ScoreRecommendation = 'Apply' | 'Maybe' | 'Skip';

// ── Job entity ─────────────────────────────────────────────────────────────

export interface ParsedSkill {
  name: string;
  category: 'language' | 'framework' | 'platform' | 'database' | 'cloud' | 'tool' | 'soft' | 'other';
  yearsRequired?: number;
}

export interface JobScore {
  overall: number;          // 0–100
  mustHaveMatch: number;    // 0–100
  preferredMatch: number;   // 0–100
  missingRequirements: string[];
  c2cConfidence: number;    // 0–100
  recommendation: ScoreRecommendation;
  explanation: string;
  scoredAt: string;         // ISO timestamp
  resumeId: string;
}

export interface Job {
  jobId: string;
  userId: string;

  // Parsed JD fields
  title: string;
  company: string;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  contractDuration?: string;       // e.g. "6 months", "12+ months"
  rateMin?: number;                // $/hr
  rateMax?: number;
  salaryMin?: number;              // if FTE in thousands
  salaryMax?: number;

  // C2C classification
  c2cStatus: C2CStatus;
  c2cConfidence: number;           // 0–100
  c2cSignals: string[];            // raw text signals that drove classification
  c2cNotes?: string;               // e.g. "Must have own Corp entity"

  // Skills
  requiredSkills: ParsedSkill[];
  preferredSkills: ParsedSkill[];
  visaWording?: string;            // raw visa/C2C paragraph extracted from JD

  // Meta
  sourceUrl: string;
  sourceName?: string;             // e.g. "Greenhouse", "Lever", "LinkedIn", "Direct"
  rawDescription: string;
  fingerprint: string;             // dedup hash: title+company+location+JD hash
  isDuplicate: boolean;
  duplicateOf?: string;            // jobId of canonical posting

  // Status / tracking
  status: 'new' | 'saved' | 'reviewing' | 'tailored' | 'applied' | 'archived';
  postedAt?: string;
  ingestedAt: string;
  updatedAt: string;

  // Scoring (latest result stored inline)
  score?: JobScore;
}

// ── Job source ─────────────────────────────────────────────────────────────

export interface JobSource {
  sourceId: string;
  userId: string;
  name: string;
  type: 'greenhouse' | 'lever' | 'url' | 'manual' | 'rss';
  url: string;
  isActive: boolean;
  lastSyncAt?: string;
  syncFrequencyHours: number;
  createdAt: string;
}

// ── Recruiter contact ──────────────────────────────────────────────────────

export interface RecruiterContact {
  contactId: string;
  userId: string;
  name?: string;
  email?: string;
  linkedin?: string;
  company?: string;
  phone?: string;
  credibilityScore?: number;   // 0–100, V2 feature
  notes?: string;
  createdAt: string;
}
