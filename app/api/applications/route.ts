/**
 * POST /api/applications      — Create application record
 * GET  /api/applications      — List all applications (Kanban data)
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { CreateApplicationSchema } from '@/lib/schemas';
import { dbPut, dbQuery, dbGet } from '@/lib/dynamo/client';
import type { Application } from '@/lib/types/application';
import type { Job } from '@/lib/types/job';

const getUserId = (req: NextRequest) => req.headers.get('x-user-id') || 'demo-user';

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const body = await request.json();

    const validation = CreateApplicationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.message }, { status: 400 });
    }

    const { jobId, resumeId, tailoredResumeId, status, notes, recruiterContactId } = validation.data;

    // Verify job exists for this user
    const job = await dbGet<Job>(`USER#${userId}`, `JOB#${jobId}`);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const applicationId = `app-${uuidv4().split('-')[0]}`;
    const now = new Date().toISOString();

    const application: Application & { PK: string; SK: string } = {
      PK: `USER#${userId}`,
      SK: `APP#${applicationId}`,
      applicationId,
      userId,
      jobId,
      resumeId,
      tailoredResumeId,
      status,
      appliedAt: status === 'Applied' ? now : undefined,
      notes: notes ? [{ noteId: uuidv4().split('-')[0], text: notes, createdAt: now }] : [],
      recruiterContactId,
      createdAt: now,
      updatedAt: now,
    };

    await dbPut(application);

    return NextResponse.json({ applicationId, status, jobId }, { status: 201 });
  } catch (err) {
    console.error('[applications] POST Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    let applications = await dbQuery<Application>(`USER#${userId}`, { skPrefix: 'APP#' });

    if (statusFilter) {
      applications = applications.filter(a => a.status === statusFilter);
    }

    // Enrich with job data for Kanban
    const jobIds = Array.from(new Set(applications.map(a => a.jobId)));
    const jobs = await Promise.all(
      jobIds.map(id => dbGet<Job>(`USER#${userId}`, `JOB#${id}`))
    );
    const jobMap = Object.fromEntries(
      jobs.filter(Boolean).map(j => [j!.jobId, j!])
    );

    const enriched = applications.map(app => ({
      ...app,
      job: jobMap[app.jobId]
        ? {
            title: jobMap[app.jobId]!.title,
            company: jobMap[app.jobId]!.company,
            location: jobMap[app.jobId]!.location,
            c2cStatus: jobMap[app.jobId]!.c2cStatus,
            rateMin: jobMap[app.jobId]!.rateMin,
            rateMax: jobMap[app.jobId]!.rateMax,
            score: jobMap[app.jobId]!.score,
          }
        : null,
    }));

    return NextResponse.json({ applications: enriched, total: enriched.length });
  } catch (err) {
    console.error('[applications] GET Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
