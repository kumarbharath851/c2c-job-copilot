/**
 * GET  /api/jobs/[jobId]         — Get single job
 * POST /api/jobs/[jobId]/score   — Score job against resume
 */

import { NextRequest, NextResponse } from 'next/server';
import { ScoreJobSchema } from '@/lib/schemas';
import { dbGet, dbUpdate } from '@/lib/dynamo/client';
import { invokeClaude } from '@/lib/ai/bedrock';
import { buildJobScoringPrompt } from '@/lib/ai/prompts/resume-tailor';
import type { Job, JobScore } from '@/lib/types/job';
import type { Resume } from '@/lib/types/resume';

const getUserId = (req: NextRequest): string | null => req.headers.get('x-user-id');

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const job = await dbGet<Job>(`USER#${userId}`, `JOB#${params.jobId}`);

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    return NextResponse.json(job);
  } catch (err) {
    console.error('[jobs/[jobId]] GET Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  // POST /api/jobs/[jobId]/score — handled in separate route
  // This endpoint is for future use (patch job status etc.)
  return NextResponse.json({ error: 'Use /api/jobs/[jobId]/score for scoring' }, { status: 405 });
}
