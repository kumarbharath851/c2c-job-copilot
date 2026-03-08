/**
 * POST /api/jobs/[jobId]/score   — Score a job against a resume
 */

import { NextRequest, NextResponse } from 'next/server';
import { ScoreJobSchema } from '@/lib/schemas';
import { dbGet, dbUpdate } from '@/lib/dynamo/client';
import { invokeClaude } from '@/lib/ai/bedrock';
import { buildJobScoringPrompt } from '@/lib/ai/prompts/resume-tailor';
import type { Job, JobScore } from '@/lib/types/job';
import type { Resume } from '@/lib/types/resume';

const getUserId = (req: NextRequest): string | null => req.headers.get('x-user-id');

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();

    const validation = ScoreJobSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.message }, { status: 400 });
    }

    const { resumeId } = validation.data;

    const [job, resume] = await Promise.all([
      dbGet<Job>(`USER#${userId}`, `JOB#${params.jobId}`),
      dbGet<Resume>(`USER#${userId}`, `RESUME#${resumeId}`),
    ]);

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });

    const prompt = buildJobScoringPrompt(resume.parsed, job);
    const responseText = await invokeClaude(
      [{ role: 'user', content: prompt }],
      { maxTokens: 1024, temperature: 0.1 }
    );

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse AI scoring response' }, { status: 500 });
    }

    const aiScore = JSON.parse(jsonMatch[0]);

    const score: JobScore = {
      overall: Math.max(0, Math.min(100, aiScore.overall || 0)),
      mustHaveMatch: Math.max(0, Math.min(100, aiScore.mustHaveMatch || 0)),
      preferredMatch: Math.max(0, Math.min(100, aiScore.preferredMatch || 0)),
      missingRequirements: aiScore.missingRequirements || [],
      c2cConfidence: aiScore.c2cConfidence ?? job.c2cConfidence,
      recommendation: aiScore.recommendation || 'Maybe',
      explanation: aiScore.explanation || '',
      scoredAt: new Date().toISOString(),
      resumeId,
    };

    // Persist score inline on job record
    await dbUpdate(`USER#${userId}`, `JOB#${params.jobId}`, { score });

    return NextResponse.json(score);
  } catch (err) {
    console.error('[jobs/[jobId]/score] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
