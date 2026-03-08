/**
 * GET  /api/applications/[appId]/ats  — Get ATS score for this application
 * POST /api/applications/[appId]/ats  — Compute / refresh ATS score on-demand
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbUpdate } from '@/lib/dynamo/client';
import { computeATSScore } from '@/lib/ai/scoring';
import type { Application } from '@/lib/types/application';
import type { Resume, TailoredResume } from '@/lib/types/resume';
import type { Job } from '@/lib/types/job';

const getUserId = (req: NextRequest): string | null => req.headers.get('x-user-id');

/**
 * GET — Returns ATS score already stored on the application (or its tailored resume).
 * Checks application.atsScore first, then falls back to tailoredResume.atsScore.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { appId: string } }
) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const app = await dbGet<Application>(`USER#${userId}`, `APP#${params.appId}`);
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  // If score already on application — return it
  if (app.atsScore) {
    return NextResponse.json({
      applicationId: params.appId,
      atsScore: app.atsScore,
      source: 'application',
    });
  }

  // Try to pull from the linked tailored resume
  if (app.tailoredResumeId) {
    const tailored = await dbGet<TailoredResume>(
      `USER#${userId}`,
      `TAILORED#${app.tailoredResumeId}`
    );
    if (tailored?.atsScore) {
      return NextResponse.json({
        applicationId: params.appId,
        atsScore: tailored.atsScore,
        originalAtsScore: (tailored as TailoredResume & { originalAtsScore?: typeof tailored.atsScore }).originalAtsScore,
        source: 'tailored_resume',
        status: tailored.status,
      });
    }
    // Tailoring still in progress
    if (tailored?.status === 'generating') {
      return NextResponse.json({
        applicationId: params.appId,
        atsScore: null,
        message: 'Resume tailoring in progress — check back shortly.',
        status: 'generating',
      });
    }
  }

  return NextResponse.json({
    applicationId: params.appId,
    atsScore: null,
    message: 'No ATS score available. Tailor a resume for this job to generate one.',
  });
}

/**
 * POST — Compute ATS score on-demand using the application's current resume vs job.
 * Stores the result on the application record.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { appId: string } }
) {
  try {
    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const app = await dbGet<Application>(`USER#${userId}`, `APP#${params.appId}`);
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    const resumeId = app.resumeId;
    if (!resumeId) {
      return NextResponse.json(
        { error: 'No resume linked to this application. Attach a resume first.' },
        { status: 400 }
      );
    }

    const [resume, job] = await Promise.all([
      dbGet<Resume>(`USER#${userId}`, `RESUME#${resumeId}`),
      dbGet<Job>(`USER#${userId}`, `JOB#${app.jobId}`),
    ]);

    if (!resume) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    // Determine which text to score:
    // If there's a ready tailored resume, score the tailored version; else score the original.
    let scoreText = resume.rawText;
    let version: 'original' | 'tailored' = 'original';
    let originalAtsScore;

    if (app.tailoredResumeId) {
      const tailored = await dbGet<TailoredResume>(
        `USER#${userId}`,
        `TAILORED#${app.tailoredResumeId}`
      );
      if (tailored?.status === 'ready' && tailored.diff?.length > 0) {
        // Build tailored text from accepted diffs
        const tailoredSections = tailored.diff
          .filter(s => s.accepted !== false)
          .map(s => (Array.isArray(s.tailored) ? s.tailored.join('\n') : s.tailored));
        scoreText = tailoredSections.join('\n') + '\n' + resume.rawText;
        version = 'tailored';
        // Also compute baseline for comparison
        originalAtsScore = computeATSScore(resume.parsed, resume.rawText, job, 'original');
      }
    }

    const atsScore = computeATSScore(resume.parsed, scoreText, job, version);

    // Persist on the application record
    await dbUpdate(`USER#${userId}`, `APP#${params.appId}`, {
      atsScore,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      applicationId: params.appId,
      atsScore,
      originalAtsScore: originalAtsScore ?? null,
      computed: true,
    });
  } catch (err) {
    console.error('[applications/[appId]/ats] POST Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
