/**
 * POST /api/resumes/[resumeId]/tailor    — Tailor resume for a job
 * GET  /api/resumes/[resumeId]/tailor    — Get tailoring status and diff
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { TailorResumeSchema } from '@/lib/schemas';
import { dbGet, dbPut, dbUpdate } from '@/lib/dynamo/client';
import { invokeClaude } from '@/lib/ai/bedrock';
import { buildResumeTailoringPrompt } from '@/lib/ai/prompts/resume-tailor';
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

    const tailoredResumeId = `tres-${uuidv4().split('-')[0]}`;
    const auditId = `audit-${uuidv4().split('-')[0]}`;
    const now = new Date().toISOString();

    // Store pending record immediately for polling
    const pending: TailoredResume & { PK: string; SK: string } = {
      PK: `USER#${userId}`,
      SK: `TAILORED#${tailoredResumeId}`,
      tailoredResumeId,
      userId,
      sourceResumeId: params.resumeId,
      jobId,
      status: 'generating',
      diff: [],
      missingSkillsWarning: [],
      aiAuditId: auditId,
      generatedAt: now,
    };
    await dbPut(pending);

    // Fire async AI tailoring (fire-and-forget, update record when done)
    tailorAsync(userId, tailoredResumeId, resume, job, options?.section || 'all', auditId, now).catch(
      err => console.error('[tailor async]', err)
    );

    return NextResponse.json(
      {
        tailoredResumeId,
        status: 'generating',
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
  auditId: string,
  startedAt: string
) {
  try {
    const prompt = buildResumeTailoringPrompt(resume.parsed, job, section);

    const responseText = await invokeClaude(
      [{ role: 'user', content: prompt }],
      { maxTokens: 4096, temperature: 0.2 }
    );

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in AI response');

    const aiResult = JSON.parse(jsonMatch[0]);

    await dbUpdate(`USER#${userId}`, `TAILORED#${tailoredResumeId}`, {
      status: 'ready',
      diff: aiResult.sections || [],
      missingSkillsWarning: aiResult.missingSkillsWarning || [],
      overallGuidance: aiResult.overallGuidance || '',
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[tailorAsync] Error:', err);
    await dbUpdate(`USER#${userId}`, `TAILORED#${tailoredResumeId}`, {
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
      updatedAt: new Date().toISOString(),
    });
  }
}
