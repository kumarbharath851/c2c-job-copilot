/**
 * POST /api/outreach   — Generate recruiter outreach message
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { OutreachSchema } from '@/lib/schemas';
import { dbGet } from '@/lib/dynamo/client';
import { invokeClaude } from '@/lib/ai/bedrock';
import { buildOutreachPrompt } from '@/lib/ai/prompts/resume-tailor';
import type { Job } from '@/lib/types/job';
import type { Resume } from '@/lib/types/resume';

const getUserId = (req: NextRequest) => req.headers.get('x-user-id') || 'demo-user';

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const body = await request.json();

    const validation = OutreachSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.message }, { status: 400 });
    }

    const { jobId, resumeId, recruiterName } = validation.data;

    const [job, resume] = await Promise.all([
      dbGet<Job>(`USER#${userId}`, `JOB#${jobId}`),
      dbGet<Resume>(`USER#${userId}`, `RESUME#${resumeId}`),
    ]);

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });

    const prompt = buildOutreachPrompt(resume.parsed, job, recruiterName);
    const message = await invokeClaude(
      [{ role: 'user', content: prompt }],
      { maxTokens: 512, temperature: 0.5 }
    );

    const auditId = `audit-${uuidv4().split('-')[0]}`;

    return NextResponse.json({
      message: message.trim(),
      auditId,
      disclaimer:
        'AI-generated message. Review and personalize before sending.',
    });
  } catch (err) {
    console.error('[outreach] POST Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
