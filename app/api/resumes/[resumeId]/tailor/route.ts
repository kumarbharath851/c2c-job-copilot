/**
 * POST /api/resumes/[resumeId]/tailor    — Tailor resume for a job
 * GET  /api/resumes/[resumeId]/tailor    — Get tailoring status, diff, and ATS scores
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { TailorResumeSchema } from '@/lib/schemas';
import { dbGet, dbPut, dbUpdate } from '@/lib/dynamo/client';
import { invokeClaude } from '@/lib/ai/bedrock';
import { buildResumeTailoringPrompt } from '@/lib/ai/prompts/resume-tailor';
import { computeATSScore } from '@/lib/ai/scoring';
import type { Resume, TailoredResume } from '@/lib/types/resume';
import type { Job } from '@/lib/types/job';

const getUserId = (req: NextRequest) => req.headers.get('x-user-id') || 'demo-user';

export async function POST(
  request: NextRequest,
  { params }: { params: { resumeId: string } }
) {
  try {
    const userId = getUserId(request);
    const body = await request.json();

    const validation = TailorResumeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.message }, { status: 400 });
    }

    const { jobId, options } = validation.data;

    const [resume, job] = await Promise.all([
      dbGet<Resume>(`USER#${userId}`, `RESUME#${params.resumeId}`),
      dbGet<Job>(`USER#${userId}`, `JOB#${jobId}`),
    ]);

    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    // Compute ORIGINAL ATS score before tailoring (baseline)
    const originalATS = computeATSScore(resume.parsed, resume.rawText, job, 'original');

    const tailoredResumeId = `tres-${uuidv4().split('-')[0]}`;
    const auditId = `audit-${uuidv4().split('-')[0]}`;
    const now = new Date().toISOString();

    // Store pending record immediately for polling — includes baseline ATS
    const pending: TailoredResume & { PK: string; SK: string; originalAtsScore: typeof originalATS } = {
      PK: `USER#${userId}`,
      SK: `TAILORED#${tailoredResumeId}`,
      tailoredResumeId,
      userId,
      sourceResumeId: params.resumeId,
      jobId,
      status: 'generating',
      diff: [],
      missingSkillsWarning: [],
      originalAtsScore: originalATS,   // before tailoring
      aiAuditId: auditId,
      generatedAt: now,
    };
    await dbPut(pending);

    // Fire async AI tailoring
    tailorAsync(userId, tailoredResumeId, resume, job, options?.section || 'all', auditId).catch(
      err => console.error('[tailor async]', err)
    );

    return NextResponse.json(
      {
        tailoredResumeId,
        status: 'generating',
        originalAtsScore: originalATS,
        pollUrl: `/api/resumes/${tailoredResumeId}/tailor`,
        message: 'Resume tailoring started. Poll status endpoint for results.',
      },
      { status: 202 }
    );
  } catch (err) {
    console.error('[resumes/tailor] POST Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { resumeId: string } }
) {
  const userId = getUserId(request);
  // params.resumeId acts as tailoredResumeId for GET polling
  const tailored = await dbGet<TailoredResume>(`USER#${userId}`, `TAILORED#${params.resumeId}`);
  if (!tailored) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(tailored);
}

async function tailorAsync(
  userId: string,
  tailoredResumeId: string,
  resume: Resume,
  job: Job,
  section: 'summary' | 'skills' | 'experience' | 'all',
  auditId: string
) {
  try {
    const prompt = buildResumeTailoringPrompt(resume.parsed, job, section);

    const responseText = await invokeClaude(
      [{ role: 'user', content: prompt }],
      { maxTokens: 4096, temperature: 0.2 }
    );

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in AI response');

    const aiResult = JSON.parse(jsonMatch[0]);

    // Build a combined text of the tailored resume for ATS re-scoring
    // Merge accepted tailored sections back into the resume text
    const acceptedSections: string[] = aiResult.sections
      ? aiResult.sections.map((s: { tailored: string | string[] }) =>
          Array.isArray(s.tailored) ? s.tailored.join(', ') : s.tailored
        )
      : [];
    const tailoredText =
      acceptedSections.join('\n') +
      '\n' +
      resume.rawText;   // Append original for context keywords not changed

    // Compute ATS score on the TAILORED version
    const tailoredATS = computeATSScore(resume.parsed, tailoredText, job, 'tailored');

    await dbUpdate(`USER#${userId}`, `TAILORED#${tailoredResumeId}`, {
      status: 'ready',
      diff: aiResult.sections || [],
      missingSkillsWarning: aiResult.missingSkillsWarning || [],
      overallGuidance: aiResult.overallGuidance || '',
      atsScore: tailoredATS,
      updatedAt: new Date().toISOString(),
    });

    // Suppress unused parameter warning
    void auditId;
  } catch (err) {
    console.error('[tailorAsync] Error:', err);
    await dbUpdate(`USER#${userId}`, `TAILORED#${tailoredResumeId}`, {
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
      updatedAt: new Date().toISOString(),
    });
  }
}
