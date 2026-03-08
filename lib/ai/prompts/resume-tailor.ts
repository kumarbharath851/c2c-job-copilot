/**
 * Resume tailoring prompt templates
 *
 * SAFETY CONTRACT:
 * - Never invent experience, tools, employers, dates, education, or metrics
 * - Only rephrase, reorder, condense, and emphasize what already exists
 * - Mirror JD terminology only when the underlying skill is the same tool
 * - Flag missing skills as gaps, don't fill them in
 * - Every edit must include a plain-English explanation
 */

import type { ParsedResume } from '@/lib/types/resume';
import type { Job } from '@/lib/types/job';

const SAFETY_RULES = `
ABSOLUTE RULES — NEVER VIOLATE:
1. Do NOT invent any new skills, tools, technologies, certifications, or experience.
2. Do NOT change any employer names, job titles, or employment dates.
3. Do NOT fabricate metrics (numbers, percentages, dollar amounts). Only include metrics already present.
4. Do NOT add education or certifications that are not in the original resume.
5. Only rename a tool when the JD uses a different name for the EXACT SAME tool (e.g., "Spark" → "Apache Spark").
6. Every change must have a plain-English explanation a hiring manager can read.
`;

export function buildResumeTailoringPrompt(
  resume: ParsedResume,
  job: Job,
  section: 'summary' | 'skills' | 'experience' | 'all'
): string {
  return `You are a careful, experienced professional resume editor working for the job applicant.

${SAFETY_RULES}

YOUR TASK:
Tailor the applicant's resume for the job description below. Focus on section: ${section}.

Return a JSON object with this structure:
{
  "sections": [
    {
      "sectionName": "summary" | "skills" | "experience_<company>",
      "original": "<original text>",
      "tailored": "<improved text>",
      "changeType": "rephrase" | "reorder" | "rename_tool" | "condense" | "emphasize" | "add_metric_placeholder" | "reorder_and_rename" | "strengthen_summary",
      "explanation": "<brief human-readable explanation of what changed and why — no jargon>"
    }
  ],
  "missingSkillsWarning": ["<skill from JD not found in resume>"],
  "overallGuidance": "<2-3 sentence overall assessment for the applicant>"
}

IMPORTANT: missingSkillsWarning should list skills that appear as REQUIRED in the JD but are NOT present anywhere in the resume. Do NOT add these to the tailored resume.

---

JOB DESCRIPTION:
Title: ${job.title}
Company: ${job.company}
Required Skills: ${job.requiredSkills.map(s => s.name).join(', ')}
Preferred Skills: ${job.preferredSkills.map(s => s.name).join(', ')}
Employment Type: ${job.employmentType}
C2C Status: ${job.c2cStatus}

Full JD (excerpt):
${job.rawDescription.slice(0, 2000)}

---

APPLICANT'S CURRENT RESUME:

Summary:
${resume.summary || '(None)'}

Skills:
${resume.skills.join(', ')}

Experience:
${resume.experience.map(exp =>
  `${exp.title} at ${exp.company} (${exp.startDate} – ${exp.endDate})\n` +
  exp.bullets.map(b => `  • ${b.text}`).join('\n')
).join('\n\n')}

Education:
${resume.education.map(e => `${e.degree} in ${e.field || 'N/A'} from ${e.institution} (${e.graduationYear || 'N/A'})`).join('\n')}

Certifications:
${resume.certifications.map(c => c.name).join(', ') || 'None'}

---

Now produce the JSON output. Be conservative. Prefer minimal targeted changes over sweeping rewrites.`;
}

export function buildJobScoringPrompt(resume: ParsedResume, job: Job): string {
  return `You are an expert technical recruiter specializing in Data Engineering contract roles.

Analyze the fit between this candidate's resume and the job description.

Return JSON:
{
  "overall": <0-100>,
  "mustHaveMatch": <0-100>,
  "preferredMatch": <0-100>,
  "missingRequirements": ["<skill or requirement from JD not present in resume>"],
  "c2cConfidence": <0-100, based on C2C signals in JD and candidate's LLC/contract experience>,
  "recommendation": "Apply" | "Maybe" | "Skip",
  "explanation": "<3-5 sentence explanation of the score, what's strong, what's missing, and why the recommendation>"
}

Scoring rubric:
- 80–100: Strong match. Apply immediately.
- 60–79: Decent match with gaps. Maybe apply.
- Below 60: Significant gaps. Skip or invest in skill gap first.

---

JOB:
Title: ${job.title} at ${job.company}
Required: ${job.requiredSkills.map(s => s.name).join(', ')}
Preferred: ${job.preferredSkills.map(s => s.name).join(', ')}
C2C Status (classified): ${job.c2cStatus} (confidence: ${job.c2cConfidence}%)
JD excerpt: ${job.rawDescription.slice(0, 1500)}

---

CANDIDATE RESUME:
Summary: ${resume.summary || 'None'}
Skills: ${resume.skills.join(', ')}
Experience titles: ${resume.experience.map(e => `${e.title} at ${e.company}`).join(' | ')}
Recent experience (bullets):
${resume.experience.slice(0, 2).flatMap(e => e.bullets.slice(0, 4).map(b => `• ${b.text}`)).join('\n')}

Return only valid JSON.`;
}

export function buildOutreachPrompt(
  resume: ParsedResume,
  job: Job,
  recruiterName?: string
): string {
  const greeting = recruiterName ? `Hi ${recruiterName}` : 'Hi';

  return `You are writing a professional recruiter outreach message on behalf of a Data Engineering contractor.

Rules:
- Sound natural and human — NOT like a template or bot
- Be specific — reference the actual role and 2-3 specific skills
- Keep it under 150 words
- Include a clear call to action (discuss C2C terms, schedule a call)
- Do NOT oversell or fabricate credentials
- Do NOT use generic phrases like "I am writing to express my interest"

Candidate profile:
Name: ${resume.contact.name}
Current title (latest): ${resume.experience[0]?.title || 'Senior Data Engineer'}
Years of experience: ${resume.experience.length > 0 ? '~' + resume.experience.length * 2 + ' years' : 'Several years'}
Top skills: ${resume.skills.slice(0, 6).join(', ')}

Target job:
Title: ${job.title}
Company: ${job.company}
Key requirements: ${job.requiredSkills.slice(0, 3).map(s => s.name).join(', ')}
C2C status: ${job.c2cStatus}

Opening greeting to use: "${greeting},"

Write only the message body (no subject line). Keep it conversational.`;
}
