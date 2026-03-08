// ── Resume types ────────────────────────────────────────────────────────────

export interface ResumeContactInfo {
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface ResumeExperienceBullet {
  text: string;
  metrics?: string[];    // extracted metrics like "$2M cost savings", "40% improvement"
}

export interface ResumeExperience {
  company: string;
  title: string;
  startDate: string;    // "MM/YYYY" or "YYYY"
  endDate: string;      // "MM/YYYY", "YYYY", or "Present"
  location?: string;
  bullets: ResumeExperienceBullet[];
}

export interface ResumeEducation {
  institution: string;
  degree: string;
  field?: string;
  graduationYear?: string;
  gpa?: string;
}

export interface ResumeCertification {
  name: string;
  issuer?: string;
  year?: string;
}

export interface ResumeProject {
  name: string;
  description: string;
  technologies: string[];
  url?: string;
}

export interface ParsedResume {
  contact: ResumeContactInfo;
  summary?: string;
  skills: string[];
  skillCategories?: Record<string, string[]>;  // e.g. { "Languages": ["Python"], "Cloud": ["AWS"] }
  experience: ResumeExperience[];
  education: ResumeEducation[];
  certifications: ResumeCertification[];
  projects: ResumeProject[];
}

export interface Resume {
  resumeId: string;
  userId: string;
  fileName: string;
  s3Key: string;
  fileType: 'pdf' | 'docx' | 'txt';
  fileSizeBytes: number;
  isMaster: boolean;
  parsed: ParsedResume;
  rawText: string;
  uploadedAt: string;
  updatedAt: string;
}

// ── Tailored resume change types ───────────────────────────────────────────

export type ChangeType =
  | 'rephrase'
  | 'reorder'
  | 'rename_tool'
  | 'condense'
  | 'emphasize'
  | 'add_metric_placeholder'
  | 'reorder_and_rename'
  | 'strengthen_summary';

export interface ResumeDiffSection {
  sectionName: string;
  original: string | string[];
  tailored: string | string[];
  changeType: ChangeType;
  explanation: string;
  accepted: boolean | null;   // null = pending user review
}

export interface TailoredResume {
  tailoredResumeId: string;
  userId: string;
  sourceResumeId: string;
  jobId: string;
  status: 'generating' | 'ready' | 'error' | 'exported';
  diff: ResumeDiffSection[];
  missingSkillsWarning: string[];   // skills in JD not in resume — NOT added
  tailoredParsed?: ParsedResume;    // final merged parsed resume after user acceptance
  aiAuditId: string;
  generatedAt: string;
  acceptedAt?: string;
  s3Key?: string;                   // exported PDF/DOCX location
}

// ── AI audit log ───────────────────────────────────────────────────────────

export interface AIAuditEntry {
  auditId: string;
  userId: string;
  operation: 'tailor_resume' | 'score_job' | 'outreach_message' | 'screening_qa' | 'cover_letter';
  inputSummary: string;
  promptHash: string;
  fullPrompt?: string;     // stored in S3, not DynamoDB
  outputSummary: string;
  modelId: string;
  tokensUsed: number;
  createdAt: string;
}
